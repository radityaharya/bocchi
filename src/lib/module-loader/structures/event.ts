import { ClientEvents } from 'discord.js';

export interface EventOptions<
  T extends keyof ClientEvents = keyof ClientEvents,
> {
  name: T;
  once?: boolean;
  execute(...args: ClientEvents[T]): void | Promise<void>;
}

export default class Event<T extends keyof ClientEvents = keyof ClientEvents> {
  name: EventOptions<T>['name'];
  once: EventOptions<T>['once'];
  execute: EventOptions<T>['execute'];

  constructor(options: EventOptions<T>) {
    this.name = options.name;
    this.once = options.once ?? false;
    this.execute = options.execute;
  }
}
