/* eslint-disable @typescript-eslint/ban-types */
import { type Request, type Response, Router } from 'express';
import type { Client } from '@/lib/module-loader';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import logger from '@/utils/logger';
import { runFromSrc } from '@/utils/runFromSrc';
import config from '@/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();
const VALID_METHODS = ['get', 'post', 'put', 'delete'] as const;

type Route = {
  method: (typeof VALID_METHODS)[number];
  path: string;
  handler: (client: Client) => (req: Request, res: Response) => void;
  isProtected: boolean;
  secret?: string;
};

/**
 * Imports a route file and returns an array of Route objects.
 * @param file - The name of the file to import.
 * @param routesPath - The path to the directory containing the route files.
 * @returns A Promise that resolves to an array of Route objects.
 */
async function importRoute(file: string, routesPath: string): Promise<Route[]> {
  try {
    const filePath = path.join(routesPath, file);
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
      ) => (req: Request, res: Response) => void;

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

/**
 * Registers a route in the router with the provided configuration.
 * @param route - The route configuration object.
 * @param client - Discord client object.
 * @param router - The router object.
 * @returns The registered route information.
 */
async function registerRoute(
  route: Route,
  client: Client,
  router: Router,
): Promise<Route> {
  const { method, path: routePath, handler, isProtected, secret } = route;
  const handlers = [
    (req: Request, res: Response, next: () => void) => {
      if (isProtected) {
        const requestSecret =
          req.query.secret || req.headers['x-webhook-secret'];

        if (requestSecret !== secret) {
          res.status(403).send('Forbidden');
          return;
        }
      }
      next();
    },
    handler(client),
  ];
  (
    router[method as keyof Router] as (
      path: string,
      ...handlers: Array<
        (req: Request, res: Response, next: () => void) => void
      >
    ) => void
  )(routePath, ...handlers);

  // Sync route to the database
  const webhookRoute = await prisma.webhookRoutes.upsert({
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

  return {
    method,
    path: routePath,
    handler,
    isProtected,
    secret: webhookRoute.secret || '',
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function deleteRoutes(dbRoutes: any[], currentRoutes: Route[]) {
  const deletedRoutes = dbRoutes.filter((dbRoute) => {
    return !currentRoutes.some((route) => route.path === dbRoute.path);
  });
  const deletePromises = deletedRoutes.map((route) => {
    logger.info(route, 'Deleting route');
    return route.destroy();
  });
  await Promise.all(deletePromises);
}

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

export async function registerRoutes(client: Client) {
  const routesPath = path.join(
    path.resolve(),
    runFromSrc ? 'src' : 'dist',
    'webhooks',
    'routes',
  );
  const routeFiles = fs.readdirSync(routesPath);

  const importedRoutes = await Promise.all(
    routeFiles.map((file) => importRoute(file, routesPath)),
  );

  const dbRoutes = await prisma.webhookRoutes.findMany();
  const routeSecrets = dbRoutes.reduce(
    (acc, route) => {
      acc[route.path] = route.secret || '';
      return acc;
    },
    {} as Record<string, string>,
  );
  for (const route of importedRoutes.flat()) {
    route.secret = routeSecrets[route.path];
  }
  const currentRoutes = importedRoutes.flat();

  await deleteRoutes(dbRoutes, currentRoutes);

  const routePromises = currentRoutes.map((route) =>
    registerRoute(route, client, router),
  );
  const registeredRoutes = await Promise.all(routePromises);

  router.all('*', (req, res) => {
    const matchedRoute = router.stack.find(
      (route) => route.route.path === req.path,
    );
    if (matchedRoute && !matchedRoute.route.methods[req.method.toLowerCase()]) {
      res.status(405).send('Method Not Allowed');
    } else {
      res.status(404).send('Not Found');
    }
  });

  const groupedRoutes = groupRoutes(registeredRoutes);

  const baseUrl = config.bot.base_url;
  const logInfo = Object.entries(groupedRoutes).map(([path, methods]) => {
    return Object.entries(methods).map(([method, { isProtected, secret }]) => {
      return {
        method,
        endpoint: `${baseUrl}/webhooks${path}?secret=${secret}&channelId=[channel_id]`,
        isProtected,
      };
    });
  });

  logger.info(logInfo, 'Registered routes');

  return router;
}
