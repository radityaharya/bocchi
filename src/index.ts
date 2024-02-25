import express from 'express';
import bodyParser from 'body-parser';
import { Client } from '@biscxit/discord-module-loader';
import { GatewayIntentBits } from 'discord.js';
import config from '@/config';
import sequelize from '@/lib/sequelize';
import Conversation from '@/models/conversation';
import Config from '@/models/config';

import { registerRoutes } from '@/webhooks';
import WebhookRoutes from './models/webhookRoutes';

const isDev = process.argv.some((arg) => arg.includes('ts-node'));

const app: express.Application = express();

const port: number = parseInt(process.env.PORT || '3000');

app.use(bodyParser.json());

const client = new Client({
  moduleLoader: {
    eventsDir: isDev ? 'src/events' : 'dist/events',
    commandsDir: isDev ? 'src/commands' : 'dist/commands',
  },
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  // partials: [Partials.Channel],
});

sequelize
  .authenticate()
  .then(async () => {
    await Conversation.sync();
    await WebhookRoutes.sync();

    await client.initialize(config.discord.token as string);
    const router = await registerRoutes(client);
    app.use('/webhooks', router);

    app.listen(port, () => {
      console.log(`App listening at http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error(err);
  });
