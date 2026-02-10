import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import {
  INotificationService,
  NOTIFICATION_SERVICE,
} from './interfaces/notification.interface';
import { MessageFormatterService } from './services/message-formatter.service';
import { SignalNotificationService } from './services/signal-notification.service';
import { VipTalkNotificationService } from './services/viptalk-notification.service';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: NOTIFICATION_SERVICE,
      useFactory: (configService: ConfigService): INotificationService => {
        const provider =
          configService.get<string>('NOTIFICATION_PROVIDER') || 'signal';

        switch (provider.toLowerCase()) {
          case 'signal':
          default: {
            const signalLogger = new PinoLogger({});
            signalLogger.setContext(SignalNotificationService.name);
            return new SignalNotificationService(configService, signalLogger);
          }
          case 'viptalk': {
            const viptalkLogger = new PinoLogger({});
            viptalkLogger.setContext(VipTalkNotificationService.name);
            return new VipTalkNotificationService(configService, viptalkLogger);
          }
        }
      },
      inject: [ConfigService],
    },
    MessageFormatterService,
  ],
  exports: [NOTIFICATION_SERVICE, MessageFormatterService],
})
export class NotificationModule {}
