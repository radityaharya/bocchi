import pino from 'pino';

const transport = pino.transport({
  target: 'pino-pretty',
  options: {
    colorize: true,
    ignore: 'pid,hostname',
    translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
  },
});

const logger = pino(transport);

export default logger;
