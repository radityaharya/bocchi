/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Request, Response } from 'express';
import type { Client } from '@/lib/module-loader';

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
