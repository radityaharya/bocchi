import { format } from 'date-fns/format';
import {
  type Collection,
  DiscordAPIError,
  type Message,
  MessageType,
  type ThreadChannel,
} from 'discord.js';
import GPT3Tokenizer from 'gpt3-tokenizer';
import type OpenAI from 'openai';

import config from '@/config';

export function buildContext(
  messages: Array<any>,
  userMessage: string,
  instruction?: string,
): Array<any> {
  let finalInstruction = instruction;

  if (!finalInstruction || finalInstruction === 'Default') {
    finalInstruction = config.bot.instruction;
  }

  finalInstruction = finalInstruction.trim();

  if (!finalInstruction.endsWith('.')) {
    finalInstruction += '.';
  }

  const systemMessageContext = {
    role: 'system',
    content: `${finalInstruction} The current date is ${format(new Date(), 'PPP')}.`,
    name: 'system',
  };

  const userMessageContext = {
    role: 'user',
    content: userMessage,
  };

  if (messages.length === 0) {
    return [systemMessageContext, userMessageContext];
  }

  let tokenCount = 0;

  const contexts = [];
  const maxTokens = Number(config.openai.max_tokens) * messages.length;
  const tokenizer = new GPT3Tokenizer({ type: 'gpt3' });

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    const content = message.content as string;
    const encoded = tokenizer.encode(content);

    tokenCount += encoded.text.length;

    if (tokenCount > maxTokens) {
      contexts.push({
        role: message.role,
        content: content.slice(0, tokenCount - maxTokens),
      });

      break;
    }

    contexts.push({
      role: message.role,
      content,
    });
  }

  return [systemMessageContext, ...contexts, userMessageContext];
}

export function buildThreadContext(
  messages: Collection<string, Message>,
  userMessage: string,
  botId: string,
): Array<OpenAI.Chat.ChatCompletionMessageParam> {
  if (messages.size === 0) {
    return buildContext([], userMessage);
  }

  const initialMessage = messages.last();

  if (
    !initialMessage ||
    initialMessage.embeds.length !== 1 ||
    initialMessage.embeds[0].fields.length !== 2
  ) {
    return buildContext([], userMessage);
  }

  const embed = initialMessage.embeds[0];

  const prompt =
    embed.fields[0].name === 'Message' ? embed.fields[0].value : '';

  const behavior =
    embed.fields[1].name === 'Behavior' ? embed.fields[1].value : '';

  if (!prompt || !behavior) {
    return buildContext([], userMessage);
  }

  const context = [
    { role: 'user', content: prompt, name: 'user' },
    ...messages
      .filter(
        (message) =>
          message.type === MessageType.Default &&
          message.content &&
          message.embeds.length === 0 &&
          (message.mentions.members?.size ?? 0) === 0,
      )
      .map((message) => {
        return {
          role: 'function',
          content: message.content,
          name: 'someName',
        };
      })
      .reverse(),
  ];

  return buildContext(context, userMessage, behavior);
}

export function buildDirectMessageContext(
  messages: Collection<string, Message>,
  userMessage: string,
  botId: string,
): Array<OpenAI.Chat.ChatCompletionMessageParam> {
  if (messages.size === 0) {
    return buildContext([], userMessage);
  }

  const context = messages
    .filter(
      (message) =>
        message.type === MessageType.Default &&
        message.content &&
        message.embeds.length === 0 &&
        (message.mentions.members?.size ?? 0) === 0,
    )
    .map((message) => {
      return {
        role: message.author.id === botId ? 'assistant' : 'user',
        content: message.content,
      };
    })
    .reverse();

  return buildContext(context, userMessage);
}

export async function detachComponents(
  messages: Collection<string, Message>,
  botId: string,
): Promise<void> {
  try {
    await Promise.all(
      messages.map((message) => {
        if (message.author.id === botId && message.components.length > 0) {
          return message.edit({ components: [] });
        }
      }),
    );
  } catch (err) {
    logError(err);
  }
}

// TODO: Notify user if the thread could not be deleted.
export async function destroyThread(channel: ThreadChannel): Promise<void> {
  try {
    const starterMessage = await channel.fetchStarterMessage();

    await channel.delete();

    if (starterMessage) {
      await starterMessage.delete();
    }
  } catch (err) {
    logError(err);
  }
}

export function getThreadPrefix(): string {
  return config.bot.thread_prefix ? `${config.bot.thread_prefix} ` : '';
}

export function isApiError(err: unknown): err is DiscordAPIError {
  return err instanceof DiscordAPIError;
}

export function logError(err: unknown, apiErrors = false): void {
  if (isApiError(err) && !apiErrors) {
    return;
  }

  console.error(err);
}
