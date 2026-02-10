import { Inject, Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DataSource } from 'typeorm';
import {
  DomainMonitorLog,
  DomainStatus,
} from '../database/entities/domain-monitor-log.entity';
import type { INotificationService } from '../notification/interfaces/notification.interface';
import { NOTIFICATION_SERVICE } from '../notification/interfaces/notification.interface';
import { MessageFormatterService } from '../notification/services/message-formatter.service';
import { CreateDomainLogDto } from './dto/create-domain-log.dto';

dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

export interface SaveLogsResult {
  total: number;
  saved: number;
  ids: string[];
  notificationSent: boolean;
}

@Injectable()
export class DomainMonitorService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(NOTIFICATION_SERVICE)
    private readonly notificationService: INotificationService,
    private readonly messageFormatter: MessageFormatterService,
    @InjectPinoLogger(DomainMonitorService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Parse timestamp from DD/MM/YYYY HH:mm:ss in Vietnam timezone (UTC+7) to UTC Date
   */
  private parseVietnamTimestamp(timestamp: string): Date {
    // Parse as Vietnam timezone (UTC+7), then convert to UTC
    const parsed = dayjs.tz(
      timestamp,
      'DD/MM/YYYY HH:mm:ss',
      'Asia/Ho_Chi_Minh',
    );
    return parsed.utc().toDate();
  }

  async saveLogs(dto: CreateDomainLogDto): Promise<SaveLogsResult> {
    const savedLogs: DomainMonitorLog[] = [];
    const checkedAt = this.parseVietnamTimestamp(dto.timestamp);

    // Use transaction to ensure atomicity for all logs
    await this.dataSource.transaction(async (manager) => {
      const logRepository = manager.getRepository(DomainMonitorLog);

      // Prepare all entities for batch insert
      const logsToInsert = dto.results.map((result) =>
        logRepository.create({
          isp: dto.isp,
          domain: result.url,
          status:
            result.error == null ? DomainStatus.SUCCESS : DomainStatus.FAILED,
          statusText: result.status,
          error:
            result.error != null
              ? (result.error as Record<string, unknown>)
              : null,
          checkedAt,
          reportedError: null,
        }),
      );

      // Batch save all logs at once
      const savedLogsFromDb = await logRepository.save(logsToInsert);
      savedLogs.push(...savedLogsFromDb);

      this.logger.debug(
        { count: savedLogs.length },
        `Batch inserted domain logs`,
      );

      // Aggregate all failed domains and send ONE notification
      const failedDomainLogs = savedLogs.filter(
        (log) => log.status === DomainStatus.FAILED,
      );

      if (failedDomainLogs.length > 0) {
        const alertMessage =
          this.messageFormatter.formatBatchAlertMessage(failedDomainLogs);
        const success =
          await this.notificationService.sendMessage(alertMessage);

        // Batch update all failed logs with notification status
        const failedIds = failedDomainLogs.map((log) => log.id);
        await logRepository.update(failedIds, { reportedError: success });

        // Update local objects for return value
        for (const log of failedDomainLogs) {
          log.reportedError = success;
        }

        this.logger.info(
          {
            failedCount: failedDomainLogs.length,
            notificationSent: success,
          },
          `Sent batch notification for failed domains`,
        );
      }
    });

    return {
      total: dto.results.length,
      saved: savedLogs.length,
      ids: savedLogs.map((log) => log.id),
      notificationSent: savedLogs.some(
        (log) =>
          log.status === DomainStatus.FAILED && log.reportedError === true,
      ),
    };
  }
}
