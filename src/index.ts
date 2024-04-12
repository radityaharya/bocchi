import express from 'express';
import { resolve } from 'path';
import bodyParser from 'body-parser';
import helmet from 'helmet';
import { Client } from '@/lib/module-loader';
import { ActivityType, GatewayIntentBits, Partials } from 'discord.js';
import config from '@/config';
import sequelize from '@/lib/sequelize';
import Conversation from '@/models/conversation';
// import Config from '@/models/config';
import { runFromSrc } from '@/utils/runFromSrc';

import { registerRoutes } from '@/webhooks';
import WebhookRoutes from './models/webhookRoutes';
import RssPooler from './models/rss';
console.log('runFromSrc', runFromSrc);
const app: express.Application = express();
const port: number = parseInt(process.env.PORT || '3000');

app.use(helmet());
app.use(bodyParser.json());

const client = new Client({
  moduleLoader: {
    eventsDir: resolve(__dirname, runFromSrc ? './events' : '../dist/events'),
    commandsDir: resolve(
      __dirname,
      runFromSrc ? './commands' : '../dist/commands',
    ),
  },
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.GuildScheduledEvent],
});

// Sync models
async function syncModels() {
  await Conversation.sync();
  await WebhookRoutes.sync();
  await RssPooler.sync();
}

// Initialize client
async function initializeClient() {
  await client.initialize(config.discord.token as string);
  client.user?.setActivity('Bocchi the cocck', { type: ActivityType.Custom });
}

// Register routes
async function registerWebhookRoutes() {
  const router = await registerRoutes(client);
  app.use('/webhooks', router);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.send('OK');
});

// Start server
async function startServer() {
  try {
    await sequelize.authenticate();
    await syncModels();
    await initializeClient();
    await registerWebhookRoutes();

    const server = app.listen(port, () => {
      console.log(`App listening at ${config.bot.base_url}`);
    });

    process.on('SIGINT', () => {
      console.log('\nGracefully shutting down');

      server.close(() => {
        console.log('Express server closed');
      });

      sequelize.close().then(() => {
        console.log('Sequelize connection closed');
      });

      process.exit();
    });
  } catch (err) {
    console.error(err);
  }
}

startServer();
