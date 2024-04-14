import type { Request, Response } from 'express';
import type { Client } from '@/lib/module-loader';
import {
  Colors,
  EmbedBuilder,
  type TextChannel,
  GuildScheduledEventPrivacyLevel,
  GuildScheduledEventEntityType,
} from 'discord.js';
import config from '@/config';
export const path = '/uptimekuma';
export const isProtected = true;

interface Heartbeat {
  monitorID: number;
  status: number;
  time: string;
  msg: string;
  ping: number;
  important: boolean;
  duration: number;
  timezone: string;
  timezoneOffset: string;
  localDateTime: string;
}

interface Tag {
  id: number;
  monitor_id: number;
  tag_id: number;
  value: string;
  name: string;
  color: string;
}

interface Monitor {
  id: number;
  name: string;
  description: string | null;
  pathName: string;
  parent: number;
  childrenIDs: number[];
  url: string;
  method: string;
  hostname: string;
  port: number | null;
  maxretries: number;
  weight: number;
  active: boolean;
  forceInactive: boolean;
  type: string;
  timeout: number;
  interval: number;
  retryInterval: number;
  resendInterval: number;
  keyword: string | null;
  invertKeyword: boolean;
  expiryNotification: boolean;
  ignoreTls: boolean;
  upsideDown: boolean;
  packetSize: number;
  maxredirects: number;
  accepted_statuscodes: string[];
  dns_resolve_type: string;
  dns_resolve_server: string;
  dns_last_result: string | null;
  docker_container: string;
  docker_host: string | null;
  proxyId: number | null;
  notificationIDList: Record<string, boolean>;
  tags: Tag[];
  maintenance: boolean;
  mqttTopic: string;
  mqttSuccessMessage: string;
  databaseQuery: string | null;
  authMethod: string | null;
  grpcUrl: string | null;
  grpcProtobuf: string | null;
  grpcMethod: string | null;
  grpcServiceName: string | null;
  grpcEnableTls: boolean;
  radiusCalledStationId: string | null;
  radiusCallingStationId: string | null;
  game: string | null;
  gamedigGivenPortOnly: boolean;
  httpBodyEncoding: string | null;
  jsonPath: string | null;
  expectedValue: string | null;
  kafkaProducerTopic: string | null;
  kafkaProducerBrokers: string[];
  kafkaProducerSsl: boolean;
  kafkaProducerAllowAutoTopicCreation: boolean;
  kafkaProducerMessage: string | null;
  screenshot: string | null;
  includeSensitiveData: boolean;
}

interface UptimeKumaPayload {
  heartbeat: Heartbeat;
  monitor: Monitor;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createUptimeKumaEmbed(reqBody: any): EmbedBuilder {
  const { heartbeat, monitor } = reqBody;
  const isUp = heartbeat.status === 1;
  const color = isUp ? Colors.Green : Colors.Red;
  const status = isUp ? 'Up' : 'Down';

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`UptimeKuma - ${monitor.name} is ${status}`)
    .addFields(
      { name: 'Monitor ID', value: String(heartbeat.monitorID) },
      { name: 'Monitor URL', value: monitor.url },
      { name: 'Monitor Duration', value: String(heartbeat.duration) },
      { name: 'Monitor Reason', value: heartbeat.msg },
    )
    .setTimestamp();

  return embed;
}

async function createUptimeEvent(client: Client, body: UptimeKumaPayload) {
  const isUp = body.heartbeat.status === 1;
  const statusText = isUp ? 'Up' : 'Down';

  const guild = await client.guilds.fetch(config.discord.guild_id);

  const events = await guild.scheduledEvents.fetch();

  for (const event of events.values()) {
    await event.delete();
  }

  const startTime = new Date();
  startTime.setSeconds(startTime.getSeconds() + 2);
  const endTime = new Date(startTime.getTime() + body.heartbeat.duration);
  endTime.setSeconds(endTime.getSeconds() + 60);

  guild.scheduledEvents.create({
    name: `Monitor ${body.monitor.name} is ${statusText}`,
    description: `Monitor ${body.monitor.name} is ${statusText}`,
    scheduledEndTime: endTime,
    scheduledStartTime: startTime,
    privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
    entityType: GuildScheduledEventEntityType.External,
    entityMetadata: {
      location: 'UptimeKuma',
    },
  });
}
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

      await channel.send({
        embeds: [createUptimeKumaEmbed(req.body)],
      });

      await createUptimeEvent(client, req.body as UptimeKumaPayload);

      res.send('OK');
    } catch (error) {
      console.error(error);
      res.status(500).send('An error occurred');
    }
  };
}
