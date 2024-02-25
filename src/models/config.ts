import { DataTypes, Model } from 'sequelize';

import sequelize from '@/lib/sequelize';

class Config extends Model {
  declare id: string;
  declare environment: string;
  declare config: {
    model: string;
  };
}

Config.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      primaryKey: true,
    },
    environment: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    config: {
      type: DataTypes.JSON,
      allowNull: false,
    },
  },
  { sequelize }
);

export default Config;
