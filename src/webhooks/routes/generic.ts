import type { Request, Response } from 'express';
import { Client } from '@/lib/module-loader';
import { Colors, EmbedBuilder, TextChannel } from 'discord.js';
import { file as tmpFile } from 'tmp-promise';
import fs from 'fs';
import util from 'util';

const writeFile = util.promisify(fs.writeFile);

export const path = '/generic';
export const isProtected = true;

export function post(client: Client) {
  return async function (req: Request, res: Response) {
    try {
      const channelId = req?.query?.channelId as string;
      if (!channelId) {
        res.status(400).send('Missing channelId query parameter');
        return;
      }

      const channel = (await client.channels.fetch(channelId)) as TextChannel;
      if (!channel) {
        res.status(404).send('Channel not found');
        return;
      }

      const tmp = await tmpFile({ postfix: '.json' });

      const data = JSON.stringify(
        {
          body: req.body,
          headers: req.headers,
        },
        null,
        2,
      );
      await writeFile(tmp.path, data);

      await channel.send({
        files: [tmp.path],
        embeds: [
          new EmbedBuilder()
            .setTitle('Generic Webhook Received')
            .setColor(Colors.Green)
            .setDescription('Here is the request body and headers')
            .setTimestamp()
            .setFooter({ text: 'Generic Webhook' }),
        ],
      });

      await tmp.cleanup();

      res.send('OK');
    } catch (error) {
      console.error(error);
      res.status(500).send('An error occurred');
    }
  };
}
