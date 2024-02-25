import type { Request, Response } from 'express';
import { Client } from '@biscxit/discord-module-loader';

export const path = '/example';

export function get(client: Client) {
  return function (req: Request, res: Response) {
    res.send('Hello World');
  };
}

export function post(client: Client) {
  return function (req: Request, res: Response) {
    res.send('Hello World');
  };
}
