import { type Client, EmbedBuilder, type TextChannel } from 'discord.js';
import fetch from 'node-fetch';
import Parser from 'rss-parser';
import config from '@/config';
import logger from '@/utils/logger';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const parser = new Parser();

/**
 * Fetches the RSS feed from the provided URL and returns the parsed result.
 * If the feed has not been modified since the last fetch (based on the provided ETag),
 * it returns null.
 *
 * @param feed - The feed object containing the URL and ETag.
 * @returns A Promise that resolves to the parsed result of the RSS feed, or null if the feed has not been modified.
 */
async function fetchRss(feed: any): Promise<any> {
  const headers: { [key: string]: string } = {};
  if (feed.etag) {
    headers['If-None-Match'] = feed.etag;
  }

  const response = await fetch(feed.url, { headers });

  if (response.status === 304) {
    return null;
  }

  feed.etag = response.headers.get('etag') || undefined;
  return await parser.parseString(await response.text());
}

/**
 * Processes the RSS feed and sends a message to the specified channel if there is a new item.
 * @param feed - The RSS feed to process.
 * @param channel - The channel to send the message to.
 * @returns A promise that resolves once the processing is complete.
 */
async function processFeed(feed: any, channel: TextChannel): Promise<void> {
  let rss;

  try {
    rss = await fetchRss(feed);
  } catch (err) {
    logger.error(err, 'Error fetching RSS feed');
    return;
  }

  if (!rss || rss.items.length === 0) {
    return;
  }

  const lastItem = rss.items[0];
  const lastItemDate = new Date(
    lastItem.isoDate || lastItem.pubDate || lastItem.date,
  );

  if (
    feed.lastCheckedString !== lastItem.content &&
    feed.lastCheckedString !== lastItem.contentSnippet
  ) {
    logger.info(`New item in RSS feed <${feed.url}>: ${lastItem.title}`);

    const embed = new EmbedBuilder()
      .setTitle(lastItem.title)
      .setURL(lastItem.link)
      .setDescription(lastItem.contentSnippet || lastItem.content || '')
      .setTimestamp(lastItemDate)
      .setFooter({ text: feed.url })
      .setColor('#0099ff');

    await channel.send({
      content: `New item in RSS feed <${feed.url}>: ${lastItem.title}`,
      embeds: [embed],
    });

    feed.lastCheckedString = lastItem.content || lastItem.contentSnippet || '';
  } else {
    logger.debug(`No new items in RSS feed <${feed.url}>`);
  }

  feed.lastChecked = new Date();
  await feed.save();
}

/**
 * Checks RSS feeds for updates and processes them.
 * @param client - The Discord client.
 * @returns A Promise that resolves when the RSS feeds have been checked and processed.
 */
async function rssPooler(client: Client): Promise<void> {
  logger.info('Checking RSS feeds for updates...');
  try {
    const feeds = await prisma.rssPooler.findMany();
    const channel = (await client.channels.fetch(
      config.discord.rss_channel_id,
    )) as TextChannel;

    await Promise.all(feeds.map((feed) => processFeed(feed, channel)));

    if (feeds.length > 0) {
      logger.debug(`Checked ${feeds.length} RSS feeds for updates.`);
    }
  } catch (err) {
    logger.error(err);
  }
}

export default rssPooler;
