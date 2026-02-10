import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { DatabaseModule } from './database/database.module';
import { NotificationModule } from './notification/notification.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    NotificationModule,
    LoggerModule.forRoot({
      pinoHttp: {
        timestamp: false,
        base: null,
        autoLogging: true,
        quietReqLogger: false,
        quietResLogger: false,
        ...(process.env.NODE_ENV === 'development' && {
          level: 'debug',
          transport: { target: 'pino-pretty', options: { singleLine: true } },
        }),
      },
    }),
  ],
})
export class SharedModule {}
