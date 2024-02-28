import type { Request, Response } from 'express';
import { Client } from '@biscxit/discord-module-loader';
import { Colors, EmbedBuilder, TextChannel } from 'discord.js';

export const path = '/generic';
export const isProtected = true;

export function post(client: Client) {
  return async function (req: Request, res: Response) {
    try {
      const embed = new EmbedBuilder()
        .setTitle('Webhook Data')
        .setColor(Colors.Purple)
        .setDescription('Here are the details of the webhook data:')
        .setTimestamp()
        .setFooter({ text: 'Webhook' });

      embed.addFields({
        name: 'Raw Body',
        value: '```json\n' + JSON.stringify(req.body, null, 2) + '\n```',
      });

      embed.addFields({
        name: 'Headers',
        value: '```json\n' + JSON.stringify(req.headers, null, 2) + '\n```',
      });

      const channelId = req.query.channelId as string | undefined;
      if (!channelId) {
        res.status(400).send('Missing channelId');
        return;
      }

      const channel = (await client.channels.fetch(channelId)) as TextChannel;
      if (!channel) {
        res.status(404).send('Channel not found');
        return;
      }

      channel.send({ embeds: [embed] });
      res.send('OK');
    } catch (error) {
      console.error(error);
      res.status(500).send('An error occurred');
    }
  };
}
