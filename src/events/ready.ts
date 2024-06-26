import { Event } from '@/lib/module-loader';
import Cron from 'croner';
import { type Client, Events } from 'discord.js';

import config from '@/config';
import pruneThreads from '@/jobs/prune-threads';
import rssPooler from '@/jobs/rss-pooler';
import { isApiError } from '@/lib/helpers';

export default new Event({
  name: Events.ClientReady,
  once: true,
  execute: async (client: Client) => {
    if (!client.user) {
      return;
    }

    process.on('uncaughtException', (err) => {
      console.error(err);

      if (!isApiError(err)) {
        process.exit(1);
      }
    });

    const job = Cron('* * * * *', async () => {
      await pruneThreads(client);
      await rssPooler(client);
    });

    console.log(`\nLogged in as ${client.user.tag}!`);
    console.log(
      `You can invite this bot with the following URL: ${config.bot.invite_url}\n`,
    );

    await job.trigger();
  },
});
