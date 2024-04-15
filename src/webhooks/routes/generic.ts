import type { Context } from 'hono';
import type { Client } from '@/lib/module-loader';
import { Colors, EmbedBuilder, type TextChannel } from 'discord.js';
import { file as tmpFile } from 'tmp-promise';
import fs from 'fs';
import util from 'util';

const writeFile = util.promisify(fs.writeFile);

export const path = '/generic';
export const isProtected = true;

export function post(client: Client) {
  return async function (c: Context) {
    try {
      const channelId = c.req.query('channelId');

      const channel = (await client.channels.fetch(channelId!)) as TextChannel;
      if (!channel) {
        return c.json({ error: 'Invalid channel ID' }, 400);
      }

      const tmp = await tmpFile({ postfix: '.json' });

      const data = JSON.stringify(
        {
          body: c.body,
          headers: c.req.header,
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

      return c.json({ success: true });
    } catch (error) {
      console.error(error);
      return c.json({ error: 'An error occurred' }, 500);
    }
  };
}
