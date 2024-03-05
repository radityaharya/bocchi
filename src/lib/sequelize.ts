import { Sequelize } from 'sequelize';

import config from '@/config';

const sequelize = new Sequelize(config.database.url as string, {
  dialect: 'postgres',
  dialectOptions: {
    // ssl: 'require',
    connectTimeout: 5000, // This is in milliseconds. Increase this value as needed.
  },
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

export default sequelize;
