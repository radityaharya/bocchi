import { Command } from '@biscxit/discord-module-loader';
import {
  ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { createErrorEmbed } from '@/lib/embeds';
import fetch from 'node-fetch';
import fs from 'fs';
import os from 'os';
import path from 'path';
import FormData from 'form-data';

type TraceMoeResultItem = {
  anilist: number;
  filename: string;
  episode: number | null;
  from: number;
  to: number;
  similarity: number;
  video: string;
  image: string;
};

type TraceMoeResult = {
  frameCount: number;
  error: string;
  result: TraceMoeResultItem[];
  limit: {
    limit: number;
    remaining: number;
    reset: number;
  };
};

/**
 * Downloads an image from the specified URL and saves it to a temporary file.
 * @param url - The URL of the image to download.
 * @returns A promise that resolves to the path of the downloaded image file.
 * @throws An error if the image fails to download.
 */
async function downloadImage(url: string): Promise<string> {
  console.log('🚀 ~ downloadImage ~ url:', url);
  let response;
  try {
    response = await fetch(url);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    throw new Error(
      `Failed to fetch the image at url: ${url}. Error: ${error.message}`
    );
  }

  if (!response.ok)
    throw new Error(
      `Failed to download image. Status: ${response.status} StatusText: ${response.statusText}`
    );

  let buffer;
  try {
    buffer = await response.buffer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    throw new Error(
      `Failed to read the response into buffer. Error: ${error.message}`
    );
  }

  const tempFilePath = path.join(os.tmpdir(), 'tempImage.jpg');
  try {
    fs.writeFileSync(tempFilePath, buffer);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    throw new Error(
      `Failed to write the image to file at path: ${tempFilePath}. Error: ${error.message}`
    );
  }

  return tempFilePath;
}

/**
 * Retrieves anime sauce using the provided image file path.
 * @param tempFilePath - The file path of the image.
 * @returns A Promise that resolves to the TraceMoeResult object containing the anime sauce information.
 * @throws An error if failed to get anime sauce.
 */
async function getAnimeSauce(tempFilePath: string): Promise<TraceMoeResult> {
  console.log('🚀 ~ getAnimeSauce ~ tempFilePath:', tempFilePath);
  const formData = new FormData();
  formData.append('image', fs.createReadStream(tempFilePath));
  const traceResponse = await fetch('https://api.trace.moe/search?cutBorders', {
    method: 'POST',
    body: formData,
    headers: formData.getHeaders(),
  });
  if (!traceResponse.ok) throw new Error('Failed to get anime sauce');
  return {
    ...(await traceResponse.json()),
    limit: {
      limit: Number(traceResponse.headers.get('x-ratelimit-limit')),
      remaining: Number(traceResponse.headers.get('x-ratelimit-remaining')),
      reset: Number(traceResponse.headers.get('x-ratelimit-reset')),
    },
  };
}

// Function to get anime details from Anilist
/**
 * Fetches details of an anime from AniList API.
 * @param anilistId - The AniList ID of the anime.
 * @returns A Promise that resolves to the JSON response containing the anime details.
 * @throws An error if failed to get anime details.
 */
async function getAnimeDetails(anilistId: number) {
  console.log('🚀 ~ getAnimeDetails ~ getAnimeDetails:', anilistId);
  const anilistResponse = await fetch(`https://graphql.anilist.co`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `
        query ($id: Int) {
          Media(id: $id, type: ANIME) {
            title {
              romaji
              english
              native
            }
            siteUrl
            episodes
            genres
            averageScore
          }
        }
      `,
      variables: {
        id: anilistId,
      },
    }),
  });
  if (!anilistResponse.ok) throw new Error('Failed to get anime details');
  return await anilistResponse.json();
}

export default new Command({
  data: new SlashCommandBuilder()
    .setName('sauce')
    .setDescription('Get the sauce from a screenshot using trace.moe')
    .addAttachmentOption((option) =>
      option
        .setName('image')
        .setDescription('Image to search for')
        .setRequired(true)
    ),
  rateLimiter: {
    points: 5,
    duration: 60,
  },
  execute: async (interaction: ChatInputCommandInteraction) => {
    const input = {
      attachment: interaction.options.getAttachment('image'),
    };

    if (
      !input.attachment ||
      !input.attachment.url ||
      !input.attachment.contentType?.startsWith('image')
    ) {
      await interaction.reply({
        embeds: [createErrorEmbed('You must provide a valid image.')],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: false });

    try {
      const tempFilePath = await downloadImage(input.attachment.url);
      const traceResult = await getAnimeSauce(tempFilePath);
      await interaction.editReply({
        content: 'Searching for anime sauce...',
      });
      const match = traceResult.result.reduce(
        (prev: TraceMoeResultItem | null, current: TraceMoeResultItem) => {
          if (!prev || current.similarity > prev.similarity) {
            return current;
          }
          return prev;
        },
        null
      );
      if (!match) {
        await interaction.editReply({
          embeds: [createErrorEmbed('No anime found.')],
        });
        return;
      }
      const anilistResult = await getAnimeDetails(match.anilist);
      await interaction.editReply({
        content: 'Fetching anime details...',
      });
      const anime = {
        title:
          anilistResult.data.Media.title.english ||
          anilistResult.data.Media.title.romaji ||
          anilistResult.data.Media.title.native,
        episode: match.episode,
        episodes: anilistResult.data.Media.episodes,
        genres: anilistResult.data.Media.genres,
        score: anilistResult.data.Media.averageScore,
        video: match.video,
        image: match.image,
      };
      const embed = new EmbedBuilder()
        .setColor(Colors.Blue)
        .setTitle('📺 Anime Sauce')
        .setDescription('Here are the details of the anime:')
        .addFields(
          {
            name: 'Title',
            value: anime.title,
          },
          {
            name: 'Episode',
            value: anime.episode ? anime.episode.toString() : 'Unknown',
          },
          {
            name: 'Total Episodes',
            value: anime.episodes.toString(),
          },
          {
            name: 'Genres',
            value: anime.genres.join(', '),
          },
          {
            name: 'Average Score',
            value: anime.score.toString(),
          }
        )
        .setImage(match.image)
        .setTimestamp()
        .setFooter({
          text: `Powered by trace.moe | limit: ${traceResult.limit.remaining}/${traceResult.limit.limit}`,
        });
      await interaction.editReply({ content: 'Match found!', embeds: [embed] });
      await interaction.followUp({
        files: [{ attachment: match.video, name: 'video.mp4' }],
      });
      fs.unlinkSync(tempFilePath);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error(error);
      await interaction.editReply({
        embeds: [createErrorEmbed(error.message || 'An error occurred.')],
      });
    }
  },
});
