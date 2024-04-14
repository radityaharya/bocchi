import type {
  ChatInputCommandInteraction,
  ContextMenuCommandBuilder,
  ContextMenuCommandInteraction,
  MessageContextMenuCommandInteraction,
  PermissionResolvable,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  UserContextMenuCommandInteraction,
} from 'discord.js';

import type { RateLimiterOptions } from '@module-loader/types/rate-limiter-options';
import type Client from '@module-loader/structures/client';

export interface CommandOptions {
  data:
    | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>
    | SlashCommandSubcommandsOnlyBuilder
    | ContextMenuCommandBuilder;
  userPermissions?: PermissionResolvable;
  botPermissions?: PermissionResolvable;
  rateLimiter?: RateLimiterOptions;
  execute(
    interaction:
      | ChatInputCommandInteraction
      | ContextMenuCommandInteraction
      | MessageContextMenuCommandInteraction
      | UserContextMenuCommandInteraction,
    client: Client,
  ): Promise<void>;
}

export default class Command {
  data: CommandOptions['data'];
  userPermissions: CommandOptions['userPermissions'];
  botPermissions: CommandOptions['botPermissions'];
  rateLimiter: CommandOptions['rateLimiter'];
  execute: CommandOptions['execute'];

  constructor(options: CommandOptions) {
    this.data = options.data;
    this.userPermissions = options.userPermissions;
    this.botPermissions = options.botPermissions;
    this.rateLimiter = options.rateLimiter;
    this.execute = options.execute;
  }
}
