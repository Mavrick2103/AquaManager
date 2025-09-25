import { DataSourceOptions } from 'typeorm';
import { User } from '../users/user.entity';
import { Aquarium } from '../aquariums/aquariums.entity';

export const typeOrmConfig = (): DataSourceOptions => ({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 3306),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  entities: [User, Aquarium], // ou autoLoadEntities: true
  synchronize: false,          // désactive en prod
  logging: false,
});
