import { DataTypes, Model } from 'sequelize';

import sequelize from '@/lib/sequelize';

class WebhookRoutes extends Model {
  declare id: string;
  declare protected: boolean;
  declare secret: string;
}

WebhookRoutes.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      primaryKey: true,
    },
    isProtected: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    secret: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  { sequelize }
);

export default WebhookRoutes;
