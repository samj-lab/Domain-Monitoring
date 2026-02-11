import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Repository } from 'typeorm';
import { DomainMonitorLog } from '../../database/entities/domain-monitor-log.entity';
import type { INotificationService } from '../../notification/interfaces/notification.interface';
import { NOTIFICATION_SERVICE } from '../../notification/interfaces/notification.interface';
import {
  DomainLatestState,
  MessageFormatterService,
} from '../../notification/services/message-formatter.service';

@Injectable()
export class SummaryReportService {
  constructor(
    @InjectRepository(DomainMonitorLog)
    private readonly logRepository: Repository<DomainMonitorLog>,
    @Inject(NOTIFICATION_SERVICE)
    private readonly notificationService: INotificationService,
    private readonly messageFormatter: MessageFormatterService,
    @InjectPinoLogger(SummaryReportService.name)
    private readonly logger: PinoLogger,
    private readonly configService: ConfigService,
  ) {}

  private getGroupId(): string {
    if (this.notificationService.getProviderName().toLowerCase() === 'signal') {
      return this.configService.getOrThrow<string>('SIGNAL_GROUP_ID');
    }

    if (
      this.notificationService.getProviderName().toLowerCase() === 'viptalk'
    ) {
      return this.configService.getOrThrow<string>('VIPTALK_ROOM_ID');
    }

    throw new Error('Unsupported notification provider');
  }

  @Cron(CronExpression.EVERY_2_HOURS)
  async handleCron(): Promise<void> {
    this.logger.info('Starting 2-hour domain status report generation...');

    try {
      const periodEnd = new Date();
      const periodStart = new Date(periodEnd.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago

      const latestStates = await this.getDomainStates(periodStart);
      const messages = this.messageFormatter.formatDomainStatusReport(
        latestStates,
        periodStart,
        periodEnd,
      );

      this.logger.info(
        { messageCount: messages.length, domainCount: latestStates.length },
        'Generated domain status report',
      );

      // Send all message parts
      let allSuccess = true;
      for (let i = 0; i < messages.length; i++) {
        const success = await this.notificationService.sendMessage({
          message: messages[i],
          groupId: this.getGroupId(),
        });
        if (!success) {
          allSuccess = false;
          this.logger.warn(
            { part: i + 1, total: messages.length },
            'Failed to send report part',
          );
        }

        // Small delay between messages to avoid rate limiting
        if (i < messages.length - 1) {
          await this.sleep(500);
        }
      }

      if (allSuccess) {
        this.logger.info('Domain status report sent successfully');
      } else {
        this.logger.warn(
          'Some parts of the domain status report failed to send',
        );
      }
    } catch (error) {
      this.logger.error(`Error generating domain status report: ${error}`);
    }
  }

  /**
   * Get the latest state for each domain+ISP combination within the time window.
   *
   * Uses PostgreSQL's DISTINCT ON for efficient "latest row per group" queries.
   * This leverages the composite index on (domain, isp, checkedAt) for optimal performance.
   *
   * @param since - Start of the time window (e.g., 2 hours ago)
   * @returns Array of latest states grouped by domain+ISP
   */
  async getDomainStates(since: Date): Promise<DomainLatestState[]> {
    // PostgreSQL DISTINCT ON selects the first row for each (domain, isp) group
    // Combined with ORDER BY checked_at DESC, this gives us the latest entry per group
    const results = await this.logRepository.query<DomainLatestState[]>(
      `
      SELECT DISTINCT ON (domain, isp)
        domain,
        isp,
        status,
        status_text AS "statusText",
        error,
        checked_at AS "checkedAt"
      FROM domain_monitor_logs
      WHERE checked_at >= $1
      ORDER BY domain, isp, checked_at DESC
      `,
      [since],
    );

    return results;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
