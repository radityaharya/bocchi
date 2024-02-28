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
      const embed = new EmbedBuilder()
        .setColor(Colors.Blue)
        .setTitle('🌐 Webhooks')
        .setDescription('Here are all the registered webhooks:')
        .setTimestamp()
        .setFooter({
          text: 'Webhooks',
        });

      const webhooks = await WebhookRoutes.findAll();

      webhooks.forEach((webhook, index) => {
        let webhookUrl = `${BASE_URL}/webhooks${webhook.id}?channelId=${interaction.channelId}`;
        if (webhook.isProtected) {
          webhookUrl += `&secret=${webhook.secret}`;
        }
        embed.addFields(
          {
            name: `🔗 Webhook #${index + 1}`,
            value: `**Path:** \`${webhook.id}\`\n**Secret:** ${
              webhook.secret
            }\n**Is Protected:** ${
              webhook.isProtected ? 'Yes' : 'No'
            }\n**URL:** ${webhookUrl}`,
          },
          {
            name: '\u200B',
            value: '\u200B',
          }
        );
      });

      await interaction.reply({
        embeds: [embed],
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
