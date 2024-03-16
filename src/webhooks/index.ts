/* eslint-disable @typescript-eslint/ban-types */
import { Request, Response, Router } from 'express';
import { Client } from '@biscxit/discord-module-loader';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import logger from '@/utils/logger';
import WebhookRoutes from '@/models/webhookRoutes';

const isDev = process.argv.some((arg) => arg.includes('ts-node'));
const router = Router();
const VALID_METHODS = ['get', 'post', 'put', 'delete'] as const;

type Route = {
  method: (typeof VALID_METHODS)[number];
  path: string;
  handler: (client: Client) => (req: Request, res: Response) => void;
  isProtected: boolean;
  secret?: string;
};

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

export async function registerRoutes(client: Client) {
  const routesPath = path.join(
    path.resolve(),
    isDev ? 'src' : 'dist',
    'webhooks',
    'routes',
  );
  const routeFiles = fs.readdirSync(routesPath);
  const routes: Route[] = [];

  const importedRoutes = await Promise.all(
    routeFiles.map((file) => importRoute(file, routesPath)),
  );

  const dbRoutes = await WebhookRoutes.findAll();
  const routeSecrets = dbRoutes.reduce(
    (acc, route) => {
      acc[route.id] = route.secret;
      return acc;
    },
    {} as Record<string, string>,
  );
  importedRoutes.flat().forEach((route) => {
    route.secret = routeSecrets[route.path];
  });
  const currentRoutes = importedRoutes.flat();

  const deletedRoutes = dbRoutes.filter((dbRoute) => {
    return !currentRoutes.some((route) => route.path === dbRoute.path);
  });
  const deletePromises = deletedRoutes.map((route) => {
    logger.info(route, 'Deleting route');
    return route.destroy();
  });
  await Promise.all(deletePromises);

  const routePromises = importedRoutes.flat().map(async (route) => {
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
    const [webhookRoute, created] = await WebhookRoutes.findOrCreate({
      where: { path: routePath },
      defaults: {
        isProtected,
        secret: secret || crypto.randomBytes(5).toString('hex'),
      },
    });

    routes.push({
      method,
      path: routePath,
      handler,
      isProtected,
      secret: webhookRoute.secret,
    });

    if (!created) {
      await webhookRoute.update({ isProtected, secret });
    }
  });

  await Promise.all(routePromises);

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

  const groupedRoutes = routes.reduce(
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

  logger.info(groupedRoutes, 'Registered routes');

  return router;
}
