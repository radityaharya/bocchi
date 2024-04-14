import type {
  ChatInputCommandInteraction,
  ContextMenuCommandInteraction,
  MessageContextMenuCommandInteraction,
  UserContextMenuCommandInteraction,
} from 'discord.js';

import type Client from '@module-loader/structures/client';
import type Command from '@module-loader/structures/command';

export interface ValidationOptions {
  execute(
    command: Command,
    interaction:
      | ChatInputCommandInteraction
      | ContextMenuCommandInteraction
      | MessageContextMenuCommandInteraction
      | UserContextMenuCommandInteraction,
    client: Client,
  ): Promise<boolean>;
}

export default class Validation {
  execute: ValidationOptions['execute'];

  constructor(options: ValidationOptions) {
    this.execute = options.execute;
  }
}
