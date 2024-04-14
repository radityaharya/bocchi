import { Command } from '@/lib/module-loader';
import {
  type ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { createErrorEmbed } from '@/lib/embeds';
import fs from 'fs';
import os from 'os';
import path from 'path';
import FormData from 'form-data';
import axios from 'axios';

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

async function downloadImage(url: string): Promise<string> {
  console.log('🚀 ~ downloadImage ~ url:', url);
  let response;
  try {
    response = await axios.get(url, { responseType: 'arraybuffer' });
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to fetch the image at url: ${url}. Error: ${error.message}`,
      );
    }
    throw error;
  }

  const buffer = response.data;

  const tempFilePath = path.join(os.tmpdir(), 'tempImage.jpg');
  try {
    fs.writeFileSync(tempFilePath, buffer);
  } catch (error: any) {
    throw new Error(
      `Failed to write the image to file at path: ${tempFilePath}. Error: ${error.message}`,
    );
  }

  return tempFilePath;
}

async function getAnimeSauce(tempFilePath: string): Promise<TraceMoeResult> {
  console.log('🚀 ~ getAnimeSauce ~ tempFilePath:', tempFilePath);
  const formData = new FormData();
  formData.append('image', fs.createReadStream(tempFilePath));
  const traceResponse = await axios.post(
    'https://api.trace.moe/search?cutBorders',
    formData,
    {
      headers: formData.getHeaders(),
    },
  );
  if (traceResponse.status !== 200)
    throw new Error('Failed to get anime sauce');
  return {
    ...traceResponse.data,
    limit: {
      limit: Number(traceResponse.headers['x-ratelimit-limit']),
      remaining: Number(traceResponse.headers['x-ratelimit-remaining']),
      reset: Number(traceResponse.headers['x-ratelimit-reset']),
    },
  };
}

async function getAnimeDetails(anilistId: number) {
  console.log('🚀 ~ getAnimeDetails ~ getAnimeDetails:', anilistId);
  const anilistResponse = await axios.post(
    'https://graphql.anilist.co',
    {
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
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );
  if (anilistResponse.status !== 200)
    throw new Error('Failed to get anime details');
  return anilistResponse.data;
}

export default new Command({
  data: new SlashCommandBuilder()
    .setName('sauce')
    .setDescription('Get the sauce from a screenshot using trace.moe')
    .addAttachmentOption((option) =>
      option
        .setName('image')
        .setDescription('Image to search for')
        .setRequired(true),
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
        null,
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
          },
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
