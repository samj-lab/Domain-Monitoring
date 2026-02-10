import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SearchBotModule } from '../../modules/search-bot/search-bot.module';
import { SharedModule } from '../../modules/shared.module';

@Module({
  imports: [SharedModule, ScheduleModule.forRoot(), SearchBotModule],
})
export class SearchAppModule {}
