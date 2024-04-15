/* eslint-disable @typescript-eslint/ban-types */
import { Context, Hono } from 'hono';
import { createFactory } from 'hono/factory';
import type { Client } from '@/lib/module-loader';
import fs from 'fs';
import { join, resolve } from 'path';
import crypto from 'crypto';
import logger from '@/utils/logger';
import config from '@/config';
import { PrismaClient } from '@prisma/client';
import { Env, HandlerResponse } from 'hono/types';
import { type TextChannel } from 'discord.js';

interface WebhookVars extends Env {
  Variables: {
    channel: TextChannel;
    client: Client;
  };
}
export type WebhookContext = Context<WebhookVars>;
type Route = {
  method: (typeof VALID_METHODS)[number];
  path: string;
  handler: (client: Client) => (c: WebhookContext) => HandlerResponse<unknown>;
  isProtected: boolean;
  secret?: string;
};

const factory = createFactory();

const prisma = new PrismaClient();

const VALID_METHODS = ['get', 'post', 'put', 'delete'] as const;

/**
 * Imports a route file and returns an array of Route objects.
 * @param file - The name of the file to import.
 * @param routesPath - The path to the directory containing the route files.
 * @returns A Promise that resolves to an array of Route objects.
 */
async function loadRoute(file: string, routesPath: string): Promise<Route[]> {
  try {
    const filePath = join(routesPath, file);
    const stats = fs.statSync(filePath);

    if (stats.isDirectory()) {
      throw new Error(`File ${file} is a directory`);
    }

    const routeExports = await import(filePath);
    const routePath = routeExports.path;
    const routeHandlers = Object.fromEntries(
      Object.entries(routeExports).filter(([key]) => key !== 'path'),
    );

    if (typeof routePath !== 'string') {
      throw new Error(`Invalid path '${routePath}' in file ${file}`);
    }

    const methodHandlerPairs = Object.entries(routeHandlers).filter(
      ([method, handler]) =>
        VALID_METHODS.includes(method as (typeof VALID_METHODS)[number]) &&
        typeof handler === 'function',
    );

    if (methodHandlerPairs.length === 0) {
      throw new Error(`No valid handler function exported in file ${file}`);
    }

    return methodHandlerPairs.map(([method, handler]) => {
      const typedHandler = handler as (
        client: Client,
      ) => (c: Context) => HandlerResponse<unknown>;

      return {
        method: method as (typeof VALID_METHODS)[number],
        path: routePath,
        handler: typedHandler,
        isProtected: routeExports.isProtected || false,
      };
    });
  } catch (error) {
    logger.error(error, `Failed to import route file ${file}`);
    return [];
  }
}

async function registerRoute(
  route: Route,
  client: Client,
  router: Hono<WebhookVars>,
) {
  const { method, path: routePath, handler, isProtected, secret } = route;

  const handlers = factory.createHandlers(
    M_ValidateMethod(method),
    M_Secret(isProtected, secret),
    M_Discord(client),
    handler(client),
  );

  (router[method as keyof Hono] as Function)(routePath, ...handlers);

  await prisma.webhookRoutes.upsert({
    where: { path: routePath },
    create: {
      path: routePath,
      isProtected,
      secret: secret || crypto.randomBytes(5).toString('hex'),
    },
    update: {
      isProtected,
      secret,
    },
  });

  return route;
}

/**
 * File based route initialization.
 *
 * @param client - Discord client object.
 * @returns Hono instance with registered routes.
 */
export async function registerRoutes(client: Client) {
  const routesPath = join(resolve(), 'src', 'webhooks', 'routes');
  const routeFiles = fs.readdirSync(routesPath);
  const WebhookRouter = new Hono<WebhookVars>();

  const importedRoutes = (
    await Promise.all(routeFiles.map((file) => loadRoute(file, routesPath)))
  ).flat();
  const dbRoutes = await prisma.webhookRoutes.findMany();

  const routeSecrets: { [key: string]: string } = dbRoutes.reduce(
    (acc, route) => ({ ...acc, [route.path]: route.secret || '' }),
    {},
  );

  importedRoutes.forEach((route) => {
    route.secret = routeSecrets[route.path];
  });

  const registeredRoutes = await Promise.all(
    importedRoutes.map((route) => registerRoute(route, client, WebhookRouter)),
  );

  const dbPaths = dbRoutes.map((route) => route.path);
  const definedPaths = registeredRoutes.map((route) => route.path);
  const pathsToRemove = dbPaths.filter((path) => !definedPaths.includes(path));

  logger.info(pathsToRemove, 'Removing Webhook routes from database');
  await prisma.webhookRoutes.deleteMany({
    where: {
      path: {
        in: pathsToRemove,
      },
    },
  });

  const groupedRoutes = groupRoutes(registeredRoutes);
  const baseUrl = config.bot.base_url;

  const logInfo = Object.entries(groupedRoutes).flatMap(([path, methods]) =>
    Object.entries(methods).map(([method, { isProtected, secret }]) => ({
      method,
      endpoint: `${baseUrl}/webhooks${path}?secret=${secret}&channelId=[channel_id]`,
      isProtected,
    })),
  );

  logger.info(logInfo, 'Registered routes');

  return WebhookRouter;
}

const M_Secret = (isProtected: boolean, secret: string | undefined) => {
  return factory.createMiddleware(async (c: Context, next) => {
    if (isProtected) {
      const requestSecret =
        c.req.query('secret') || c.req.header('x-webhook-secret');
      if (requestSecret !== secret) {
        return c.json({ message: 'Unauthorized' }, 401);
      }
    }
    await next();
  });
};

const M_ValidateMethod = (method: string) => {
  return factory.createMiddleware(async (c: Context, next) => {
    if (!VALID_METHODS.includes(method as (typeof VALID_METHODS)[number])) {
      return c.json({ message: 'Method not supported' }, 405);
    }
    if (c.req.method !== method.toUpperCase()) {
      return c.json({ message: 'Method not allowed' }, 405);
    }
    await next();
  });
};

const M_Discord = (client: Client) => {
  return factory.createMiddleware(async (c: Context, next) => {
    const channelId = c.req.query('channelId');
    if (!channelId) {
      return c.json({ error: 'Missing channelId query parameter' }, 400);
    }

    const channel = (await client.channels.fetch(channelId)) as TextChannel;
    if (!channel) {
      return c.json({ error: 'Invalid channel ID' }, 400);
    }

    c.set('channel', channel);
    c.set('client', client);

    await next();
  });
};

function groupRoutes(routes: Route[]) {
  return routes.reduce(
    (acc, route) => {
      if (!acc[route.path]) {
        acc[route.path] = {};
      }
      acc[route.path][route.method] = {
        handler: route.handler,
        isProtected: route.isProtected,
        secret: route.secret || '',
      };
      return acc;
    },
    {} as Record<
      string,
      Record<
        string,
        { handler: Function; isProtected: boolean; secret: string }
      >
    >,
  );
}
