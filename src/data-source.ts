import 'dotenv/config';

import { DataSource, DataSourceOptions } from 'typeorm';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  database: process.env.DATABASE_NAME || 'domain_monitor',
  entities: [__dirname + '/modules/database/entities/*.entity.{ts,js}'],
  migrations: [__dirname + '/modules/database/migrations/*.{ts,js}'],
  synchronize: false,
  logging: process.env.NODE_ENV !== 'production',

  migrationsRun: false,
  migrationsTableName: 'migrations',
  migrationsTransactionMode: 'all',
};

export default new DataSource(dataSourceOptions);
