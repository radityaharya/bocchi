import { Event } from '@/lib/module-loader';
import {
  ChannelType,
  type Client,
  Colors,
  type DMChannel,
  EmbedBuilder,
  Events,
  type Message,
  MessageType,
  RESTJSONErrorCodes,
  type ThreadChannel,
} from 'discord.js';
import { delay, isEmpty, truncate } from 'lodash';

import config from '@/config';
// import { createActionRow, createRegenerateButton } from '@/lib/buttons';
import {
  // buildContext,
  buildDirectMessageContext,
  buildThreadContext,
  detachComponents,
  getThreadPrefix,
  isApiError,
} from '@/lib/helpers';
import {
  type CompletionResponse,
  CompletionStatus,
  createChatCompletion,
} from '@/lib/llm';
import { PrismaClient } from '@prisma/client';
import logger from '@/utils/logger';
import { tempFile } from '@/utils/tempFile';

const prisma = new PrismaClient();

async function handleThreadMessage(
  client: Client<true>,
  channel: ThreadChannel,
  message: Message,
) {
  if (channel.archived || channel.locked) {
    logger.info('Thread is archived or locked');
    return;
  }

  const prefix = getThreadPrefix().trim();

  logger.info('🗨️Thread Message Received', {
    prefix,
    channelName: channel.name,
    messageContent: message.content,
  });

  if (prefix && !channel.name.startsWith(prefix)) {
    logger.info('Thread does not have the correct prefix');
    return;
  }

  delay(async () => {
    if (isLastMessageStale(message, channel.lastMessage, client.user.id)) {
      return;
    }

    try {
      const messages = await channel.messages.fetch({ before: message.id });

      await channel.sendTyping();

      if (message.attachments.size > 0) {
        const attachment = message.attachments.first();
        if (attachment) {
          const file = await tempFile(attachment.url);
          message.content = `data:${file.mimeType};base64,${file.base64}`;
        }
      }

      const typingInterval = setInterval(() => {
        channel.sendTyping();
      }, 5000);

      const completion = await createChatCompletion(
        buildThreadContext(messages, message, client.user.id),
      );

      clearInterval(typingInterval);

      if (completion.status !== CompletionStatus.Ok) {
        await handleFailedRequest(
          channel,
          message,
          completion.message,
          completion.status === CompletionStatus.UnexpectedError,
        );

        return;
      }

      if (isLastMessageStale(message, channel.lastMessage, client.user.id)) {
        return;
      }

      await detachComponents(messages, client.user.id);

      await channel.send({
        content: completion.message,
        // components: [createActionRow(createRegenerateButton())],
      });

      const pruneInterval = Number(config.bot.prune_interval);

      if (pruneInterval > 0) {
        await prisma.conversation.updateMany({
          where: {
            channelId: channel.id,
          },
          data: {
            expiresAt: new Date(
              Date.now() + 3600000 * Math.ceil(pruneInterval),
            ),
          },
        });
      }
    } catch (err) {
      if (
        !(isApiError(err) && err.code === RESTJSONErrorCodes.MissingPermissions)
      ) {
        console.error(err);
      }
    }
  }, 2000);
}

async function handleDirectMessage(
  client: Client<true>,
  channel: DMChannel,
  message: Message,
) {
  delay(async () => {
    logger.info('DM received:', message.content);
    if (isLastMessageStale(message, channel.lastMessage, client.user.id)) {
      return;
    }

    const messages = await channel.messages.fetch({ before: message.id });

    // TODO: temp
    if (message.content === '!prune') {
      await Promise.all(
        messages.map((message) => {
          if (message.author.id === client.user.id) {
            return message.delete();
          }
        }),
      );
      return;
    }

    await channel.sendTyping();

    if (message.attachments.size > 0) {
      const attachment = message.attachments.first();
      if (attachment) {
        const file = await tempFile(attachment.url);
        message.content = `data:${file.mimeType};base64,${file.base64}`;
      }
    }

    const typingInterval = setInterval(() => {
      channel.sendTyping();
    }, 5000);

    const completion = await createChatCompletion(
      buildDirectMessageContext(messages, message, client.user.id),
    );

    clearInterval(typingInterval);

    if (completion.status !== CompletionStatus.Ok) {
      await handleFailedRequest(
        channel,
        message,
        completion.message,
        completion.status === CompletionStatus.UnexpectedError,
      );

      return;
    }

    if (isLastMessageStale(message, channel.lastMessage, client.user.id)) {
      return;
    }

    if (completion.message.includes('```')) {
      await channel.send({
        content: completion.message,
      });
    } else {
      await splitSend(completion, channel);
    }

    await detachComponents(messages, client.user.id);
  }, 2000);
}

export default new Event({
  name: Events.MessageCreate,
  execute: async (message: Message) => {
    const client = message.client;

    if (
      message.author.id === client.user.id ||
      message.type !== MessageType.Default ||
      (!message.content && !message.attachments.size) ||
      !isEmpty(message.embeds) ||
      !isEmpty(message.mentions.members)
    ) {
      return;
    }

    const channel = message.channel;
    switch (channel.type) {
      case ChannelType.DM:
        handleDirectMessage(
          client,
          channel.partial ? await channel.fetch() : channel,
          message,
        );
        break;
      case ChannelType.PublicThread:
        handleThreadMessage(client, channel, message);
        break;
      case ChannelType.PrivateThread:
        handleThreadMessage(client, channel, message);
        break;
      default:
        return;
    }
  },
});

async function splitSend(completion: CompletionResponse, channel: DMChannel) {
  const split_keys = ['%%%%', '\\.', '!', '\\?', '\\n', '\\r', '\\t'];
  const split_regex = new RegExp(split_keys.join('|'), 'g');
  const raw_split_messages = completion.message.split(split_regex);
  const split_messages = [];
  let temp_message = '';

  for (const message of raw_split_messages) {
    const trimmedMessage = message.trim();
    if (trimmedMessage.length <= 1 && temp_message !== '') {
      temp_message += ` ${trimmedMessage}`;
    } else {
      if (temp_message !== '') {
        split_messages.push(temp_message);
        temp_message = '';
      }
      temp_message = trimmedMessage;
    }
  }
  if (temp_message !== '') {
    split_messages.push(temp_message);
  }

  for (const message of split_messages) {
    if (message.trim() !== '') {
      await channel.sendTyping();
      await new Promise((resolve) =>
        setTimeout(resolve, (message.length / 30) * 1000),
      );
      await channel.send({
        content: message,
      });
    }
  }
}

function isLastMessageStale(
  message: Message,
  lastMessage: Message | null,
  botId: string,
): boolean {
  return (
    lastMessage !== null &&
    lastMessage.id !== message.id &&
    lastMessage.author.id !== botId
  );
}

async function handleFailedRequest(
  channel: DMChannel | ThreadChannel,
  message: Message,
  error: string,
  queueDeletion = false,
): Promise<void> {
  // if (channel instanceof ThreadChannel) {
  //   try {
  //     await message.delete();
  //   } catch (err) {
  //     console.error(err);
  //   }
  // }

  const embed = await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle('Failed to generate a response')
        .setDescription(error)
        .setFields({
          name: 'Message',
          value: truncate(message.content, { length: 200 }),
        }),
    ],
  });

  if (queueDeletion) {
    delay(async () => {
      await embed.delete();
    }, 8000);
  }
}
