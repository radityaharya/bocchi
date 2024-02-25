import { Sequelize } from 'sequelize';

import config from '@/config';

const sequelize = new Sequelize(config.database.url as string, {
  dialect: 'mariadb',
  dialectOptions: {
    ssl: false,
    connectTimeout: 5000, // This is in milliseconds. Increase this value as needed.
  },
  logging: false,
  pool: {
    max: 5, // maximum number of connection in pool
    min: 0, // minimum number of connection in pool
    acquire: 30000, // maximum time, in milliseconds, that pool will try to get connection before throwing error
    idle: 10000, // maximum time, in milliseconds, that a connection can be idle before being released
  },
});

export default sequelize;
