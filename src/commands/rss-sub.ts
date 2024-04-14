import { SlashCommandBuilder } from 'discord.js';
import { Command } from '@/lib/module-loader';
import type { ChatInputCommandInteraction } from 'discord.js';
import Parser from 'rss-parser';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const parser = new Parser();

async function fetchRss(url: string): Promise<any> {
  const response = await axios.get(url);
  return await parser.parseString(response.data);
}

export default new Command({
  data: new SlashCommandBuilder()
    .setName('subscribe')
    .setDescription('Subscribe to an RSS feed')
    .addStringOption((option) =>
      option
        .setName('url')
        .setDescription('The URL of the RSS feed')
        .setRequired(true),
    ),
  execute: async (interaction: ChatInputCommandInteraction) => {
    const url = interaction.options.getString('url');
    if (!url) {
      await interaction.reply('You must provide a URL.');
      return;
    }

    let rss;

    try {
      rss = await fetchRss(url);
    } catch (err) {
      console.error(`Failed to fetch or parse RSS feed at ${url}:`, err);
      await interaction.reply('Failed to fetch or parse the RSS feed.');
      return;
    }

    if (!rss || rss.items.length === 0) {
      await interaction.reply('The RSS feed does not contain any items.');
      return;
    }

    const lastItem = rss.items[0];

    try {
      await prisma.rssPooler.create({
        data: {
          url,
          lastChecked: new Date(),
          lastCheckedString: lastItem.content || lastItem.contentSnippet || '',
        },
      });
      await interaction.reply(`Successfully subscribed to ${url}`);
    } catch (err) {
      console.error(`Failed to subscribe to ${url}:`, err);
      await interaction.reply(
        `Failed to subscribe to ${url}. Please make sure it's a valid RSS feed.`,
      );
    }
  },
});
