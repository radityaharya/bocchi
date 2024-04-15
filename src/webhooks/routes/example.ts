/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Context, HonoRequest } from 'hono';
import type { Client } from '@/lib/module-loader';

export const path = '/example';

export const isProtected = true;

export function get(client: Client) {
  return function (c: Context) {
    return c.text('Hello World');
  };
}

export function post(client: Client) {
  return function (c: Context) {
    return c.text('Hello World');
  };
}
