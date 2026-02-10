import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchLog } from '../database/entities/search-log.entity';
import { NotificationModule } from '../notification/notification.module';
import { SearchBotService } from './search-bot.service';
import { SerpApiService } from './serpapi.service';
import { SignalListenerService } from './signal-listener.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([SearchLog]),
    NotificationModule,
  ],
  providers: [SerpApiService, SearchBotService, SignalListenerService],
})
export class SearchBotModule {}
