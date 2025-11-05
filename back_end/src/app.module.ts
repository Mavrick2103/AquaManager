import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmConfig } from './config/typeorm.config';

import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AquariumsModule } from './aquariums/aquariums.module';
import { WaterMeasurementModule } from './water-measurement/water-measurement.module';
import { TaskModule } from './tasks/task.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Accepte d'autres variables non listées et affiche toutes les erreurs d'un coup
      validationOptions: { allowUnknown: true, abortEarly: false },
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),

        DB_HOST: Joi.string().required(),
        DB_PORT: Joi.number().integer().min(1).default(3306),
        DB_USER: Joi.string().required(),
        DB_PASS: Joi.string().allow('').optional(),
        DB_NAME: Joi.string().required(),

        JWT_SECRET: Joi.string().min(16).required(),
        JWT_EXPIRES: Joi.string().default('1h'),     // ex: '15m', '1h'
        JWT_REFRESH_EXPIRES: Joi.string().default('15d'), // ex: '7d', '15d'

        PORT: Joi.number().integer().min(1).default(3000),
      }),
    }),

    TypeOrmModule.forRoot(typeOrmConfig()),

    // Modules applicatifs
    UsersModule,
    AquariumsModule,
    AuthModule,
    WaterMeasurementModule,
    TaskModule,
  ],
})
export class AppModule {}
