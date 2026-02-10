import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DomainMonitorLog } from '../database/entities/domain-monitor-log.entity';
import { NotificationModule } from '../notification/notification.module';
import { DomainMonitorController } from './domain-monitor.controller';
import { DomainMonitorService } from './domain-monitor.service';
import { SummaryReportService } from './services/summary-report.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([DomainMonitorLog]),
    NotificationModule,
  ],
  controllers: [DomainMonitorController],
  providers: [DomainMonitorService, SummaryReportService],
  exports: [DomainMonitorService],
})
export class DomainMonitorModule {}
