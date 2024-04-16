import axios from 'axios';
import { truncate } from 'lodash';
import OpenAI from 'openai';
import logger from '@/utils/logger';
import config from '@/config';
import {
  HumanMessage,
  SystemMessage,
  AIMessage,
} from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { getAnimeDetails, getAnimeSauce, TraceMoeResultItem } from './tracemoe';
import {
  getAnalyzedAttachmentMetadataByMessageId,
  setAttachmentMetadata,
} from '@/utils/metadataLogger';
import { MessageContext } from './helpers';

const openai = new OpenAI({
  apiKey: config.openai.api_key,
  baseURL: config.openai.base_url,
});

const chat = new ChatOpenAI({
  apiKey: config.openai.api_key,
  model: config.openai.model,
  configuration: {
    baseURL: config.openai.base_url,
  },
});

const vision = new ChatGoogleGenerativeAI({
  model: 'gemini-pro-vision',
  maxOutputTokens: 2048,
  apiKey: config.google_genai.api_key,
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

async function traceAnimeContext(base64Image: string) {
  let additionalContext = '';

  try {
    const traceResult = await getAnimeSauce({
      base64Image: base64Image,
    });

    const match = traceResult.result.reduce(
      (prev: TraceMoeResultItem | null, current: TraceMoeResultItem) => {
        if (!prev || current.similarity > prev.similarity) {
          return current;
        }
        return prev;
      },
      null,
    );

    if (match) {
      const anilistResult = await getAnimeDetails(match.anilist);
      const anime = {
        title:
          anilistResult.data.Media.title.english ||
          anilistResult.data.Media.title.romaji ||
          anilistResult.data.Media.title.native,
        episode: match.episode,
        episodes: anilistResult.data.Media.episodes,
        genres: anilistResult.data.Media.genres,
        description: anilistResult.data.Media.description,
        characters: anilistResult.data.Media.characters.edges
          .slice(0, 5)
          .map((edge) => {
            const { name, gender, description } = edge.node;
            const truncatedDescription = description
              ? `${description.substring(0, 47)}...`
              : 'No description available';
            return `${name.full} (Gender: ${gender}, Description: ${truncatedDescription})`;
          })
          .join(', ')
          .replace(/, ([^,]*)$/, ' and $1'),
        nextAiringDatetime: new Date(
          anilistResult.data.Media.nextAiringEpisode?.airingAt * 1000,
        ).toLocaleString(),
        relations: anilistResult.data.Media.relations.edges
          .map(
            (edge) =>
              edge.node.title.english ||
              edge.node.title.romaji ||
              edge.node.title.native,
          )
          .join(', '),
        startDate: new Date(
          anilistResult.data.Media.startDate.year,
          anilistResult.data.Media.startDate.month - 1,
          anilistResult.data.Media.startDate.day,
        ).toLocaleDateString(),
        score: anilistResult.data.Media.averageScore,
      };

      additionalContext = `The image is from the anime titled "${anime.title}". This anime falls under the genres: ${anime.genres.join(', ')}. It has an average score of ${anime.score}. The specific scene in the image is from episode ${anime.episode} out of the total ${anime.episodes} episodes. Here is a brief description of the anime: "${anime.description}". The main characters in this anime are ${anime.characters}. The next episode is scheduled to air on ${anime.nextAiringDatetime}. The anime is set to release on ${anime.startDate}. The anime has relations with the following anime or mangas: ${anime.relations}.`;
    }
  } catch (error) {
    console.error('Error tracing anime context:', error);
  }

  return additionalContext;
}

async function generateImageContext(file: string) {
  const additionalContext = await traceAnimeContext(file);
  return additionalContext;
}

async function identifyImage(file: string) {
  const additionalContext = await generateImageContext(file);

  const prompt = `You received an image. Describe the image in detail and extract any useful information from it.`;

  const input = [
    new HumanMessage({
      content: [
        {
          type: 'text',
          text: prompt,
        },
        {
          type: 'image_url',
          image_url: file,
        },
      ],
    }),
  ];
  const res = await vision.invoke(input);
  const response = `The image you received in the discord chat has the following description: ${res.content}. Based on the additional context, it appears that ${additionalContext}. Please provide the user with any relevant information and share your thoughts on the image. If the additional context does not align with the description, please disregard it. If it does align, please provide as much context as possible.`;
  return response;
}
export async function createChatCompletion(
  messages: Array<MessageContext>,
): Promise<CompletionResponse> {
  try {
    const chatMessages = await Promise.all(
      messages.map(async (message) => {
        switch (message.role) {
          case 'system':
            return new SystemMessage(message.content);
          case 'user': {
            if (message.content.startsWith('data:image')) {
              const analyzedAttachment =
                await getAnalyzedAttachmentMetadataByMessageId(message.id);
              let metadata = analyzedAttachment
                ? analyzedAttachment.metadata
                : null;
              if (!metadata) {
                metadata = await identifyImage(message.content as string);
                await setAttachmentMetadata(message.id, metadata);
              }
              return new SystemMessage(metadata);
            }
            return new HumanMessage(message.content);
          }
          case 'assistant':
            return new AIMessage(message.content);
          default:
            throw new Error(`Invalid message role: ${message.role}`);
        }
      }),
    );

    const completion = await chat.invoke(chatMessages);
    const message = completion.content;
    if (message) {
      return {
        status: CompletionStatus.Ok,
        message: truncate(message.toString(), { length: 2000 }),
      };
    }
  } catch (err) {
    logger.error(err, 'Error while processing chat completion');
    return {
      status: CompletionStatus.UnexpectedError,
      message: err instanceof Error ? err.message : (err as string),
    };
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
  botMessage: string,
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
      logger.error(
        { status: err.response.status, data: err.response.data },
        'Axios error with response',
      );
    } else {
      logger.error(err.message, 'Axios error without response');
    }
  } else {
    logger.error(err, 'Unknown error');
  }
}
