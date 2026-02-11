import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PinoLogger } from 'nestjs-pino';
import type { Repository } from 'typeorm';
import {
  SearchLog,
  SearchStatus,
} from '../database/entities/search-log.entity';
import type { INotificationService } from '../notification/interfaces/notification.interface';
import { NOTIFICATION_SERVICE } from '../notification/interfaces/notification.interface';
import { SerpApiResult } from './interfaces/serpapi.interface';
import { SerpApiError, SerpApiService } from './serpapi.service';

const HELP_MESSAGE = `📖 Hướng dẫn sử dụng Search Bot

Cú pháp: /search <từ khóa>

Ví dụ:
  /search python tutorial

Bot sẽ tìm kiếm trên Google và trả về danh sách các kết quả hàng đầu.`;

@Injectable()
export class SearchBotService {
  constructor(
    private readonly serpApiService: SerpApiService,
    @Inject(NOTIFICATION_SERVICE)
    private readonly notificationService: INotificationService,
    @InjectRepository(SearchLog)
    private readonly searchLogRepository: Repository<SearchLog>,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(SearchBotService.name);
  }

  async handleSearchCommand(
    groupId: string,
    sender: string,
    keyword: string,
  ): Promise<void> {
    // Empty keyword → send help
    if (!keyword || keyword.trim().length === 0) {
      await this.sendReply(groupId, HELP_MESSAGE);
      return;
    }

    const trimmedKeyword = keyword.trim();
    const startTime = Date.now();

    this.logger.info(
      { groupId, sender, keyword: trimmedKeyword },
      'Processing /search command',
    );

    try {
      const results = await this.serpApiService.search(trimmedKeyword);
      const durationMs = Date.now() - startTime;

      if (results.length === 0) {
        const noResultsMessage = `🔍 Không tìm thấy kết quả cho: ${trimmedKeyword}`;
        await this.sendReply(groupId, noResultsMessage);
        await this.logSearch({
          groupId,
          sender,
          keyword: trimmedKeyword,
          resultsCount: 0,
          results: [],
          responseText: noResultsMessage,
          status: SearchStatus.SUCCESS,
          durationMs,
        });
        return;
      }

      const responseText = this.formatResults(trimmedKeyword, results);
      await this.sendReply(groupId, responseText);

      await this.logSearch({
        groupId,
        sender,
        keyword: trimmedKeyword,
        resultsCount: results.length,
        results: results as unknown as Record<string, unknown>[],
        responseText,
        status: SearchStatus.SUCCESS,
        durationMs,
      });
    } catch (error: unknown) {
      const durationMs = Date.now() - startTime;
      const errorMessage = this.formatError(error);

      this.logger.error(
        { groupId, sender, keyword: trimmedKeyword, error },
        'Search failed',
      );

      await this.sendReply(groupId, errorMessage);

      await this.logSearch({
        groupId,
        sender,
        keyword: trimmedKeyword,
        resultsCount: 0,
        results: null,
        responseText: errorMessage,
        status: SearchStatus.ERROR,
        errorMessage: error instanceof Error ? error.message : String(error),
        durationMs,
      });
    }
  }

  private formatResults(keyword: string, results: SerpApiResult[]): string {
    const header = `🔍 Kết quả tìm kiếm: ${keyword}\n`;
    const items = results
      .map((r) => `${r.position}. ${r.title}\n${r.link}`)
      .join('\n\n');

    return `${header}\n${items}`;
  }

  private formatError(error: unknown): string {
    if (error instanceof SerpApiError) {
      return `⚠️ ${error.message}`;
    }

    return '❌ Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.';
  }

  private async sendReply(groupId: string, message: string): Promise<void> {
    const sent = await this.notificationService.sendMessage({
      groupId,
      message,
    });
    if (!sent) {
      this.logger.error({ groupId }, 'Failed to send reply to Signal group');
    }
  }

  private async logSearch(data: {
    groupId: string;
    sender: string;
    keyword: string;
    resultsCount: number;
    results: Record<string, unknown>[] | null;
    responseText: string;
    status: SearchStatus;
    errorMessage?: string;
    durationMs: number;
  }): Promise<void> {
    try {
      const log = this.searchLogRepository.create({
        groupId: data.groupId,
        sender: data.sender,
        keyword: data.keyword,
        resultsCount: data.resultsCount,
        results: data.results,
        responseText: data.responseText,
        status: data.status,
        errorMessage: data.errorMessage || null,
        durationMs: data.durationMs,
      });
      await this.searchLogRepository.save(log);
    } catch (error: unknown) {
      this.logger.error({ error, data }, 'Failed to log search to database');
    }
  }
}
