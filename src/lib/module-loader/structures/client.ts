import {
  Collection,
  Client as DiscordClient,
  type ClientOptions as DiscordClientOptions,
  Events,
  type Interaction,
} from 'discord.js';
import type { RateLimiterMemory } from 'rate-limiter-flexible';

import {
  deployCommands,
  loadCommands,
  loadValidations,
} from '@module-loader/handlers/commands';
import { loadEvents } from '@module-loader/handlers/events';
import type Command from '@module-loader/structures/command';
import type Validation from '@module-loader/structures/validation';
import { createErrorEmbed } from '@module-loader/utils/embeds';
import logger from '@module-loader/utils/logger';

export interface ModuleLoaderOptions {
  eventsDir?: string;
  commandsDir?: string;
  validationsDir?: string;
}

export interface ClientOptions extends DiscordClientOptions {
  moduleLoader?: ModuleLoaderOptions;
}

export default class Client extends DiscordClient {
  moduleLoader: Required<ModuleLoaderOptions> = {
    eventsDir: 'events',
    commandsDir: 'commands',
    validationsDir: 'validations',
  };

  commands: Collection<string, Command> = new Collection();
  limiters: Collection<string, RateLimiterMemory> = new Collection();
  validations: Array<Validation> = [];

  constructor(options: ClientOptions) {
    const { moduleLoader: moduleLoaderOptions, ...clientOptions } = options;

    super(clientOptions);

    if (moduleLoaderOptions) {
      this.moduleLoader = { ...this.moduleLoader, ...moduleLoaderOptions };
    }

    this.once(Events.ClientReady, async () => {
      await deployCommands(this);
    });

    this.on(Events.InteractionCreate, async (interaction: Interaction) => {
      await this.handleCommandInteraction(interaction);
    });
  }

  async initialize(token: string): Promise<void> {
    await Promise.all([
      loadEvents(this),
      loadCommands(this),
      loadValidations(this),
    ]);

    await this.login(token);
  }

  private async handleCommandInteraction(
    interaction: Interaction,
  ): Promise<void> {
    if (
      !interaction.isChatInputCommand() &&
      !interaction.isContextMenuCommand() &&
      !interaction.isMessageContextMenuCommand() &&
      !interaction.isUserContextMenuCommand()
    ) {
      return;
    }

    const commandName = interaction.commandName.toLowerCase();
    const command = this.commands.get(commandName);

    if (!command) {
      logger.error('No command matching %s was found.', commandName);
      return;
    }

    let isValid = true;

    for (const validation of this.validations) {
      isValid = await validation.execute(command, interaction, this);

      if (!isValid) {
        break;
      }
    }

    if (!isValid) {
      const embed = createErrorEmbed('This command cannot be executed.');

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ embeds: [embed], ephemeral: true });
      } else if (interaction.deferred) {
        await interaction.editReply({ embeds: [embed] });
      }

      return;
    }

    try {
      await command.execute(interaction, this);
    } catch (err) {
      logger.error(err);

      const embed = createErrorEmbed('Unknown error.');

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ embeds: [embed], ephemeral: true });
      } else {
        await interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }
  }
}
