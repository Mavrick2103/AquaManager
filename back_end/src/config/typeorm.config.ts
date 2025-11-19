import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export function typeOrmConfig(): TypeOrmModuleOptions {
  const isProd = process.env.NODE_ENV === 'production';

  return {
    type: 'mysql',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,

    autoLoadEntities: true,

    synchronize: process.env.TYPEORM_SYNC === 'true' && !isProd,

    logging: !isProd,
  };
}
