import type { Request, Response } from 'express';
import { Client } from '@biscxit/discord-module-loader';
import { Colors, EmbedBuilder, TextChannel, User } from 'discord.js';
export const path = '/railway';
export const isProtected = true;
export function post(client: Client) {
  return async function (req: Request, res: Response) {
    const { type, timestamp, project, environment, deployment, meta } =
      req.body;
    const embed = new EmbedBuilder()
      .setTitle('Railway Status')
      .setColor(Colors.Purple)
      .setDescription(
        `A status of ${type} has been made to the ${project.name} project`
      )
      .addFields({ name: 'Environment', value: environment.name })
      .addFields({ name: 'Deployed By', value: deployment.creator.name })
      .setThumbnail(deployment.creator.avatar)
      .setTimestamp(new Date(timestamp))
      .setFooter({ text: 'Railway' });

    const channelId = req.query.channelId as string | undefined;
    if (!channelId) {
      res.status(400).send('Missing channelId');
      return;
    }
    const channel = (await client.channels.fetch(channelId)) as TextChannel;
    channel.send({ embeds: [embed] });
    res.send('OK');
  };
}
