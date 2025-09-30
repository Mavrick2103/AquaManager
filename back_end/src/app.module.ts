import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmConfig } from './config/typeorm.config';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AquariumsModule } from './aquariums/aquariums.module';
import { WaterMeasurementModule } from './water-measurement/water-measurement.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DB_HOST: Joi.string().required(),
        DB_PORT: Joi.number().default(3306),
        DB_USER: Joi.string().required(),
        DB_PASS: Joi.string().allow('').optional(),
        DB_NAME: Joi.string().required(),
        JWT_SECRET: Joi.string().min(16).required(),
        JWT_EXPIRES: Joi.string().default('1h'),
        PORT: Joi.number().default(3000),
      }),
    }),
    TypeOrmModule.forRoot(typeOrmConfig()),
    UsersModule,
    AquariumsModule, // ✅
    AuthModule, WaterMeasurementModule,
  ],
})
export class AppModule {}
