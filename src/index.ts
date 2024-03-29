import express from 'express';
import bodyParser from 'body-parser';
import helmet from 'helmet';
import { Client } from '@biscxit/discord-module-loader';
import { GatewayIntentBits, Partials } from 'discord.js';
import config from '@/config';
import sequelize from '@/lib/sequelize';
import Conversation from '@/models/conversation';
import Config from '@/models/config';

import { registerRoutes } from '@/webhooks';
import WebhookRoutes from './models/webhookRoutes';
import RssPooler from './models/rss';

const isDev =
  process.argv.some((arg) => arg.includes('ts-node')) ||
  process.env.NODE_ENV === 'development';
console.log('isDev', isDev);
const app: express.Application = express();
const port: number = parseInt(process.env.PORT || '3000');

app.use(helmet());
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
  partials: [Partials.Channel],
});

sequelize
  .authenticate()
  .then(async () => {
    await Conversation.sync();
    await WebhookRoutes.sync();
    await RssPooler.sync();

    await client.initialize(config.discord.token as string);
    const router = await registerRoutes(client);
    app.use('/webhooks', router);

    app.get('/health', (req, res) => {
      res.send('OK');
    });

    app.listen(port, () => {
      console.log(`App listening at http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error(err);
  });
