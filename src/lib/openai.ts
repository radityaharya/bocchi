import axios from 'axios';
import { truncate } from 'lodash';
import OpenAI from 'openai';

import config from '@/config';

const openai = new OpenAI({
  apiKey: config.openai.api_key,
  baseURL: config.openai.base_url,
});

export enum CompletionStatus {
  Ok = 0,
  Moderated = 1,
  ContextLengthExceeded = 2,
  InvalidRequest = 3,
  UnexpectedError = 4,
}

export interface CompletionResponse {
  status: CompletionStatus;
  message: string;
}

export async function createChatCompletion(
  messages: Array<OpenAI.Chat.ChatCompletionMessageParam>
): Promise<CompletionResponse> {
  try {
    console.log(messages);

    const completion = await openai.chat.completions.create({
      messages,
      model: config.openai.model,
      temperature: Number(config.openai.temperature),
      max_tokens: Number(config.openai.max_tokens),
    });

    const message = completion.choices[0].message;

    if (message) {
      return {
        status: CompletionStatus.Ok,
        message: truncate(message.content?.trim(), { length: 2000 }),
      };
    }
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const error = err.response?.data?.error;

      if (error && error.code === 'context_length_exceeded') {
        return {
          status: CompletionStatus.ContextLengthExceeded,
          message:
            'The request has exceeded the context limit. Try again with a shorter message or start another conversation.',
        };
      } else if (error && error.type === 'invalid_request_error') {
        logError(err);

        return {
          status: CompletionStatus.InvalidRequest,
          message: error.message,
        };
      }
    } else {
      logError(err);

      return {
        status: CompletionStatus.UnexpectedError,
        message: err instanceof Error ? err.message : (err as string),
      };
    }
  }

  return {
    status: CompletionStatus.UnexpectedError,
    message: 'There was an unexpected error while processing your request.',
  };
}

export async function createImage(prompt: string): Promise<CompletionResponse> {
  try {
    const moderation = await openai.moderations.create({
      input: prompt,
    });

    const result = moderation.results[0];

    if (result.flagged) {
      return {
        status: CompletionStatus.Moderated,
        message: 'Your prompt has been blocked by moderation.',
      };
    }

    const image = await openai.images.generate({
      prompt,
    });

    const imageUrl = image.data[0].url;

    if (imageUrl) {
      return {
        status: CompletionStatus.Ok,
        message: imageUrl,
      };
    }
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const error = err.response?.data?.error;

      if (error && error.code === 'context_length_exceeded') {
        return {
          status: CompletionStatus.ContextLengthExceeded,
          message:
            'The request has exceeded the token limit. Try again with a shorter message or start another conversation.',
        };
      } else if (error && error.type === 'invalid_request_error') {
        logError(err);

        return {
          status: CompletionStatus.InvalidRequest,
          message: error.message,
        };
      }
    } else {
      logError(err);

      return {
        status: CompletionStatus.UnexpectedError,
        message: err instanceof Error ? err.message : (err as string),
      };
    }
  }

  return {
    status: CompletionStatus.UnexpectedError,
    message: 'There was an unexpected error processing your request.',
  };
}

export async function generateTitle(
  userMessage: string,
  botMessage: string
): Promise<string> {
  const messages = [
    {
      role: 'system',
      content: 'You are a helpful assistant.',
    },
    {
      role: 'user',
      content: userMessage,
    },
    {
      role: 'assistant',
      content: botMessage,
    },
    {
      role: 'user',
      content: 'Create a title for our conversation in 6 words or less.',
    },
  ] as OpenAI.Chat.ChatCompletionMessageParam[];

  try {
    const completion = await openai.chat.completions.create({
      messages,
      model: config.openai.model,
      temperature: 0.5,
    });

    const message = completion.choices[0].message;

    if (message) {
      let title = message.content?.trim();

      if (title?.startsWith('"') && title.endsWith('"')) {
        title = title.slice(1, -1);
      }

      while (title?.endsWith('.')) {
        title = title.slice(0, -1);
      }

      return title || '';
    }
  } catch (err) {
    logError(err);
  }

  return '';
}

function logError(err: unknown): void {
  if (axios.isAxiosError(err)) {
    if (err.response) {
      console.log(err.response.status);
      console.log(err.response.data);
    } else {
      console.log(err.message);
    }
  } else {
    console.log(err);
  }
}
