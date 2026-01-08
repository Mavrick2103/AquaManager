import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export function typeOrmConfig(): TypeOrmModuleOptions {
  const isProd = process.env.NODE_ENV === 'production';

  const syncEnabled = process.env.TYPEORM_SYNC === 'true';
  const loggingEnabled = process.env.TYPEORM_LOGGING === 'true';

  return {
    type: 'mysql',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,

    autoLoadEntities: true,

    // ✅ jamais en prod
    synchronize: syncEnabled && !isProd,

    // ✅ dev: true, prod: via env
    logging: isProd ? loggingEnabled : true,
  };
}
