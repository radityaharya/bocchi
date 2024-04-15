import { resolve } from 'path';
import { Client } from '@/lib/module-loader';
import { ActivityType, GatewayIntentBits, Partials } from 'discord.js';
import config from '@/config';
import { registerRoutes } from '@/webhooks';
import { Hono } from 'hono';
import { logger } from 'hono/logger';

const app = new Hono();
app.use(logger());
const port: number = parseInt(process.env.PORT || '3000');

const client = new Client({
  moduleLoader: {
    eventsDir: resolve(__dirname, './events'),
    commandsDir: resolve(__dirname, './commands'),
    validationsDir: resolve(__dirname, './validations'),
  },
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.GuildScheduledEvent],
});

// Initialize client
async function initializeClient() {
  await client.initialize(config.discord.token as string);
  client.user?.setActivity('Bocchi the cocck', { type: ActivityType.Custom });
}

// Register routes
async function registerWebhookRoutes() {
  const router = await registerRoutes(client);
  app.route('/webhooks', router);
}

// Health check endpoint
app.get('/health', (c) => c.text('OK'));

// Start server
async function startServer() {
  try {
    await initializeClient();
    await registerWebhookRoutes();

    process.on('SIGINT', () => {
      console.log('\nGracefully shutting down');

      client.destroy();

      process.exit();
    });
  } catch (err) {
    console.error(err);
  }
}

startServer();

export default {
  port,
  fetch: app.fetch,
};
