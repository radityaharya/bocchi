import type { Request, Response } from 'express';
import { Client } from '@biscxit/discord-module-loader';
import { Colors, EmbedBuilder, TextChannel, User } from 'discord.js';
export const path = '/railway';
export const isProtected = true;
export function post(client: Client) {
  return async function (req: Request, res: Response) {
    try {
      const { type, timestamp, project, environment, deployment, meta } =
        req.body;

      if (
        typeof type !== 'string' ||
        typeof timestamp !== 'string' ||
        typeof project !== 'object' ||
        typeof environment !== 'object' ||
        typeof deployment !== 'object'
      ) {
        res.status(400).send('Invalid request body');
        return;
      }

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
