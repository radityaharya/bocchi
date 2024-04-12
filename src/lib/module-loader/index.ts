/**
 * The module-loader and its import are adapted from the discord-module-loader project on GitHub:
 * https://github.com/capibawa/discord-module-loader
 **/

import Client from '@module-loader/structures/client';
import Command from '@module-loader/structures/command';
import Event from '@module-loader/structures/event';
import { RateLimiterOptions } from '@module-loader/types/rate-limiter-options';

export { Client, Command, Event, type RateLimiterOptions };
