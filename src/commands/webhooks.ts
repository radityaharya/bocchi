import WebhookRoutes from '@/models/webhookRoutes';
import { Command } from '@biscxit/discord-module-loader';
import {
  ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';

import config from '@/config';

const BASE_URL = config.bot.base_url;

export default new Command({
  data: new SlashCommandBuilder()
    .setName('webhooks')
    .setDescription('List all webhooks'),
  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      const webhooks = await WebhookRoutes.findAll();
      const embeds = [];

      for (const [index, webhook] of webhooks.entries()) {
        let webhookUrl = `${BASE_URL}/webhooks${webhook.id}?channelId=${interaction.channelId}`;
        if (webhook.isProtected) {
          webhookUrl += `&secret=${webhook.secret}`;
        }

        const embed = new EmbedBuilder()
          .setColor(Colors.Blue)
          .setTitle(`🌐 Webhook #${index + 1}`)
          .setDescription('Here are the details of the webhook:')
          .addFields(
            {
              name: 'Path',
              value: `\`${webhook.id}\``,
            },
            {
              name: 'Secret',
              value: webhook.secret,
            },
            {
              name: 'Is Protected',
              value: webhook.isProtected ? 'Yes' : 'No',
            },
            {
              name: 'URL',
              value: webhookUrl,
            }
          )
          .setTimestamp()
          .setFooter({
            text: 'Webhooks',
          });

        embeds.push(embed);
      }

      await interaction.reply({
        embeds: embeds,
        fetchReply: true,
      });
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content: 'An error occurred while fetching the webhooks.',
        ephemeral: true,
      });
    }
  },
});
