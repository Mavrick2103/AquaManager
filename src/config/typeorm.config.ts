/**
 * typeorm.config.ts
 * -------------------
 * Configuration de la base MySQL pour TypeORM.
 * - Lit les infos de connexion dans .env
 * - Déclare les entités (ici User)
 * - synchronize: true en DEV pour créer/mettre à jour les tables automatiquement
 */
import { DataSourceOptions } from 'typeorm';
import { User } from '../users/user.entity';

export const typeOrmConfig = (): DataSourceOptions => ({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 3306),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  entities: [User],
  synchronize: false, // ⚠️ à désactiver en prod
  logging: false,
});
