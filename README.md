# Bocchi

Bocchi is a Multipurpose Discord bot written in TypeScript using [Discord.js](https://discord.js.org/). Designed to be run on [🍞Bun](https://bun.sh)

## Features

- Slash Command based.
- Chat with LLM.
- Webhook notification proxy.
- Trace.moe: [anime search from image](https://trace.moe/).
- Subscribe to RSS feeds.

## Setup

Before starting, you'll need a [Discord app](https://discord.com/developers/applications) and get Client ID and Token.

- Docker

  1. Copy `example.env` to `.env` and fill in the required values.

  ```
  cp example.env .env
  ```

  2. Build the Docker image.

  ```
  docker build -t bocchi .
  ```

  3. Run the Docker container.

  ```
  docker run -d -p 6637:6637 --name bocchi --env-file .env bocchi
  ```

- Bun
  1. Copy `example.env` to `.env` and fill in the required values.
  2. Install the dependencies.
  ```
  bun install
  ```
  3. Start the bot.
  ```
  bun run start:prod
  ```

After starting the bot, you can invite it to your server by visiting the URL provided in the console.

## License

[MIT](LICENSE)
