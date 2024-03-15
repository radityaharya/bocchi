import { DataTypes, Model } from 'sequelize';
import sequelize from '@/lib/sequelize';

class RssPooler extends Model {
  declare id: string;
  declare url: string;
  declare lastChecked: Date;
  declare lastCheckedString: string | undefined;
  declare etag: string | undefined;
}

RssPooler.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      primaryKey: true,
    },
    url: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    lastChecked: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    lastCheckedString: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    etag: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  { sequelize }
);

export default RssPooler;
