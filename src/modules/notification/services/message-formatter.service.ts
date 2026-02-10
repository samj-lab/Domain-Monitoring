import { Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import {
  DomainMonitorLog,
  DomainStatus,
} from '../../database/entities/domain-monitor-log.entity';

dayjs.extend(utc);

const MAX_MESSAGE_LENGTH = 4096;

export interface DomainLatestState {
  domain: string;
  isp: string;
  status: DomainStatus;
  statusText: string;
  error?: Record<string, unknown> | null;
  checkedAt: Date;
}

@Injectable()
export class MessageFormatterService {
  /**
   * Format batch alert message for failed domains (real-time alerts)
   * Groups failures by ISP for better readability
   */
  formatBatchAlertMessage(logs: DomainMonitorLog[]): string {
    if (logs.length === 0) {
      return '';
    }

    // Group failures by ISP
    const byIsp = new Map<string, DomainMonitorLog[]>();
    for (const log of logs) {
      const existing = byIsp.get(log.isp) || [];
      existing.push(log);
      byIsp.set(log.isp, existing);
    }

    let message = `🚨 Domain Failure Alert (${logs.length} ${logs.length === 1 ? 'failure' : 'failures'})\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    for (const [isp, ispLogs] of byIsp) {
      message += `ISP: ${isp}\n`;

      for (const log of ispLogs) {
        message += `  Domain: ${log.domain}\n`;
        message += `  Status: ${log.statusText}\n`;
        if (log.error != null) {
          message += `  Error: ${JSON.stringify(log.error)}\n`;
        }
        message += `\n`;
      }
    }

    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `Checked At: ${dayjs(logs[0].checkedAt).utc().format('YYYY-MM-DD HH:mm:ss')} UTC`;

    return message;
  }

  /**
   * Format domain status report for scheduled 2-hour reports.
   * Shows latest state of each domain grouped by ISP.
   * Returns array of messages (split if exceeds max size).
   *
   * Format:
   * ```
   * 📊 Domain Status Report
   * Period: 2026-02-08 09:00:00 - 2026-02-08 11:00:00 UTC
   * Total: 7 domains | ✅ 3 | ❌ 4
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   *
   * FPT
   *   ❌ blocked-site.com [Error details]
   *   ✅ facebook.com
   * ```
   */
  formatDomainStatusReport(
    domains: DomainLatestState[],
    periodStart: Date,
    periodEnd: Date,
  ): string[] {
    if (domains.length === 0) {
      return [
        `📊 Domain Status Report\n` +
          `Period: ${this.formatDate(periodStart)} - ${this.formatDate(periodEnd)} UTC\n\n` +
          `No monitoring data in the last 2 hours`,
      ];
    }

    // Group by ISP
    const byIsp = new Map<string, DomainLatestState[]>();
    for (const domain of domains) {
      const existing = byIsp.get(domain.isp) || [];
      existing.push(domain);
      byIsp.set(domain.isp, existing);
    }

    // Count stats
    const successCount = domains.filter(
      (d) => d.status === DomainStatus.SUCCESS,
    ).length;
    const failedCount = domains.length - successCount;

    // Build header
    const header =
      `📊 Domain Status Report\n` +
      `Period: ${this.formatDate(periodStart)} - ${this.formatDate(periodEnd)} UTC\n` +
      `Total: ${domains.length} domains | ✅ ${successCount} | ❌ ${failedCount}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Build ISP sections
    const ispSections: string[] = [];
    for (const [isp, ispDomains] of byIsp) {
      let section = `${isp}\n`;

      // Sort: failed first, then by domain name
      ispDomains.sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === DomainStatus.FAILED ? -1 : 1;
        }
        return a.domain.localeCompare(b.domain);
      });

      for (const domain of ispDomains) {
        const statusIcon = domain.status === DomainStatus.SUCCESS ? '✅' : '❌';
        section += `  ${statusIcon} ${domain.domain}`;

        if (domain.status === DomainStatus.FAILED && domain.error != null) {
          section += ` [${JSON.stringify(domain.error)}]`;
        }
        section += `\n`;
      }

      ispSections.push(section);
    }

    // Split into messages if needed
    return this.splitIntoMessages(header, ispSections);
  }

  /**
   * Split content into multiple messages, each under max size
   * Keeps ISP sections together when possible
   */
  private splitIntoMessages(header: string, sections: string[]): string[] {
    const messages: string[] = [];
    let currentMessage = header;
    let partNumber = 1;
    const totalParts = this.estimateTotalParts(header, sections);

    for (const section of sections) {
      // Check if adding this section would exceed max length
      if (currentMessage.length + section.length > MAX_MESSAGE_LENGTH - 50) {
        // Leave room for part indicator
        // Finalize current message with part indicator if needed
        if (totalParts > 1) {
          currentMessage += `\n[Part ${partNumber}/${totalParts}]`;
        }
        messages.push(currentMessage.trim());

        // Start new message
        partNumber++;
        currentMessage = `📊 Domain Status Report (continued)\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      }

      currentMessage += section;
    }

    // Add final message
    if (currentMessage.trim().length > 0) {
      if (totalParts > 1) {
        currentMessage += `\n[Part ${partNumber}/${totalParts}]`;
      }
      messages.push(currentMessage.trim());
    }

    return messages;
  }

  /**
   * Estimate total number of parts needed
   */
  private estimateTotalParts(header: string, sections: string[]): number {
    const totalLength =
      header.length + sections.reduce((sum, s) => sum + s.length, 0);
    return Math.ceil(totalLength / (MAX_MESSAGE_LENGTH - 100));
  }

  private formatDate(date: Date): string {
    return dayjs(date).utc().format('YYYY-MM-DD HH:mm:ss');
  }
}
