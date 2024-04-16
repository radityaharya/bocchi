import { Command } from '@/lib/module-loader';
import {
  type ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { createErrorEmbed } from '@/lib/embeds';
import {
  getAnimeDetails,
  getAnimeSauce,
  TraceMoeResultItem,
} from '@/lib/tracemoe';
import { tempFile } from '@/utils/tempFile';
import fs from 'fs';

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
      const file = await tempFile(input.attachment.url);
      const traceResult = await getAnimeSauce({
        tempFilePath: file.path,
      });
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
      fs.unlinkSync(file.path);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error(error);
      await interaction.editReply({
        embeds: [createErrorEmbed(error.message || 'An error occurred.')],
      });
    }
  },
});
