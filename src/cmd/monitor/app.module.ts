import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DomainMonitorModule } from '../../modules/domain-monitor/domain-monitor.module';
import { SharedModule } from '../../modules/shared.module';
import { AppController } from './app.controller';

@Module({
  imports: [ScheduleModule.forRoot(), SharedModule, DomainMonitorModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
