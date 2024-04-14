import { RateLimiterMemory, type RateLimiterRes } from 'rate-limiter-flexible';

import Validation from '@module-loader/structures/validation';
import { createErrorEmbed } from '@module-loader/utils/embeds';

export default new Validation({
  execute: async (command, interaction, client) => {
    if (!command.rateLimiter) {
      return true;
    }

    if (!client.limiters.has(command.data.name)) {
      client.limiters.set(
        command.data.name,
        new RateLimiterMemory(command.rateLimiter),
      );
    }

    const limiter = client.limiters.get(command.data.name) as RateLimiterMemory;

    try {
      await limiter.consume(interaction.user.id);
    } catch (err) {
      const { msBeforeNext } = err as RateLimiterRes;
      const timeLeft = Math.round(msBeforeNext / 1000);

      await interaction.reply({
        embeds: [
          createErrorEmbed(
            `You are being rate limited. Try again in ${timeLeft} seconds.`,
          ),
        ],
        ephemeral: true,
      });

      return false;
    }

    return true;
  },
});
