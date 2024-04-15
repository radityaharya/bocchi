/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Client } from '@/lib/module-loader';
import { Colors, EmbedBuilder, type TextChannel } from 'discord.js';
import { WebhookContext } from '..';
export const path = '/railway';
export const isProtected = true;
export function post(client: Client) {
  return async function (c: WebhookContext) {
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
      } = await c.req.json();

      if (
        typeof type !== 'string' ||
        typeof timestamp !== 'string' ||
        typeof project !== 'object' ||
        typeof environment !== 'object' ||
        typeof deployment !== 'object'
      ) {
        return c.json({ error: 'Invalid request body' }, 400);
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
      const channel = c.var.channel;

      channel.send({ embeds: [embed] });
      return c.json({ success: true });
    } catch (error) {
      console.error(error);
      return c.json({ error: 'An error occurred' }, 500);
    }
  };
}
