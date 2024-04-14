import type { Request, Response } from 'express';
import type { Client } from '@/lib/module-loader';
import { Colors, EmbedBuilder, type TextChannel, User } from 'discord.js';
export const path = '/railway';
export const isProtected = true;
export function post(client: Client) {
  return async function (req: Request, res: Response) {
    try {
      const {
        type,
        timestamp,
        project,
        environment,
        deployment,
        meta,
        service,
        status,
      } = req.body;

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
        .setTimestamp()
        .setFooter({ text: 'Railway' })
        .setAuthor({
          name: deployment.creator.name,
          iconURL: deployment.creator.avatar,
        })
        .setThumbnail(deployment.creator.avatar)
        .addFields(
          {
            name: 'Type',
            value: type,
          },
          {
            name: 'Project',
            value: `Name: ${project.name}\nID: ${project.id}`,
          },
          {
            name: 'Environment',
            value: `Name: ${environment.name}\nID: ${environment.id}`,
          },
          {
            name: 'Deployment',
            value: `ID: ${deployment.id}\nRegion: ${deployment.meta.serviceManifest.deploy.region}`,
          },
          {
            name: 'Service',
            value: `Name: ${service.name}\nID: ${service.id}`,
          },
          {
            name: 'Status',
            value: status,
          },
        );
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
