import { join } from 'path';

import type Client from '@module-loader/structures/client';
import Command from '@module-loader/structures/command';
import Validation from '@module-loader/structures/validation';
import { getFiles, getFilesFromPath } from '@module-loader/utils/helpers';
import logger from '@module-loader/utils/logger';

export async function loadCommands(client: Client): Promise<void> {
  const commands: Array<Command> = await getFiles(
    client.moduleLoader.commandsDir,
  );

  if (!commands.length) {
    logger.info('No commands found.');
    return;
  }

  for (const command of commands) {
    if (!(command instanceof Command)) {
      throw new Error(`Command ${command} is not an instance of Command.`);
    }

    if (!command.data) {
      throw new Error(`Command ${command} does not have a data property.`);
    }

    const name = command.data.name.toLowerCase();

    if (client.commands.has(name)) {
      throw new Error(`Command ${name} already exists.`);
    }

    client.commands.set(name, command);
  }

  logger.info(
    'Loaded %d %s: [%s]',
    commands.length,
    commands.length === 1 ? 'command' : 'commands',
    commands.map((command) => command.data.name).join(', '),
  );
}

export async function deployCommands(client: Client): Promise<void> {
  if (!client.isReady()) {
    throw new Error('Client is not ready.');
  }

  try {
    await client.application.commands.set(
      client.commands.map((command) => command.data),
    );

    logger.info(
      'Deployed %d %s.',
      client.commands.size,
      client.commands.size === 1 ? 'command' : 'commands',
    );
  } catch (err) {
    logger.error(err);
  }
}

export async function loadValidations(client: Client): Promise<void> {
  const validations: Array<Validation> = await getFiles(
    client.moduleLoader.validationsDir,
  );

  if (validations.length) {
    for (const validation of validations) {
      if (!(validation instanceof Validation)) {
        throw new Error(
          `Validation ${validation} is not an instance of Validation.`,
        );
      }

      client.validations.push(validation);
    }

    logger.info(
      'Loaded %d %s.',
      client.validations.length,
      client.validations.length === 1 ? 'validation' : 'validations',
    );
  } else {
    logger.info('No validations found.');
  }

  await loadInternalValidations(client);
}

async function loadInternalValidations(client: Client): Promise<void> {
  const validations: Array<Validation> = await getFilesFromPath(
    join(__dirname, 'validations'),
  );

  if (!validations.length) {
    logger.info('No internal validations found.');
    return;
  }

  let validationCount = 0;

  for (const validation of validations) {
    if (!(validation instanceof Validation)) {
      throw new Error(
        `Validation ${validation} is not an instance of Validation.`,
      );
    }

    client.validations.push(validation);

    validationCount++;
  }

  logger.info(
    'Loaded %d internal %s.',
    validationCount,
    validationCount === 1 ? 'validation' : 'validations',
  );
}
