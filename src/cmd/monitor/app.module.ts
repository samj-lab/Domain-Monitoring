import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import { DatabaseModule } from '../../modules/database/database.module';
import { DomainMonitorModule } from '../../modules/domain-monitor/domain-monitor.module';
import { NotificationModule } from '../../modules/notification/notification.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    DomainMonitorModule,
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
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
