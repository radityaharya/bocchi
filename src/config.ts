import dotenv from 'dotenv';

dotenv.config();

const config = {
  node_env: process.env.NODE_ENV || 'production',
  port: process.env.PORT || 3000,
  bot: {
    name: process.env.BOT_NAME || 'Bocchi',
    instruction:
      process.env.BOT_INSTRUCTION || 'You are Bocchi, a helpful assistant.',
    invite_url: `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&permissions=8&scope=bot`,
    thread_prefix: process.env.BOT_THREAD_PREFIX || '💬',
    prune_interval: process.env.BOT_PRUNE_INTERVAL || 0,
    base_url:
      process.env.BASE_URL ||
      (process.env.RAILWAY_PUBLIC_DOMAIN
        ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
        : `http://localhost:${process.env.PORT}`),
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  discord: {
    client_id: process.env.DISCORD_CLIENT_ID,
    token: process.env.DISCORD_TOKEN,
    rss_channel_id: process.env.DISCORD_RSS_CHANNEL_ID as string,
    guild_id: process.env.DISCORD_GUILD_ID as string,
  },
  openai: {
    api_key: process.env.OPENAI_API_KEY,
    base_url: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
    temperature: process.env.OPENAI_TEMPERATURE || 0.7,
    max_tokens: process.env.OPENAI_MAX_TOKENS || 500,
    system_prompt:
      process.env.OPENAI_SYSTEM_PROMPT || 'You are a helpful assistant.',
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const validateConfig = (config: any) => {
  if (
    !config.database.url ||
    !config.discord.client_id ||
    !config.discord.token ||
    !config.discord.rss_channel_id ||
    !config.discord.guild_id ||
    !config.openai.api_key
  ) {
    throw new Error(
      'Missing environment variables. Make sure the following are set: DATABASE_URL, DISCORD_CLIENT_ID, DISCORD_TOKEN, OPENAI_API_KEY.',
    );
  }
};

export default config;
