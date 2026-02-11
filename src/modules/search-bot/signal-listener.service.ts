import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import ky from 'ky';
import { PinoLogger } from 'nestjs-pino';
import type { SignalWebhookEnvelope } from './interfaces/serpapi.interface';
import { SearchBotService } from './search-bot.service';

const SEARCH_COMMAND_PREFIX = '/search';

@Injectable()
export class SignalListenerService {
  private readonly signalApiUrl: string;
  private readonly signalAccount: string;
  private readonly timeout: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly searchBotService: SearchBotService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(SignalListenerService.name);

    this.signalApiUrl =
      this.configService.get<string>('SIGNAL_API_URL') ||
      'http://localhost:8080';
    this.signalAccount = this.configService.get<string>('SIGNAL_ACCOUNT') || '';
    this.timeout = this.configService.get<number>('BOT_TIMEOUT_MS') || 10_000;

    if (!this.signalAccount) {
      throw new Error(
        'SIGNAL_ACCOUNT is required. Please set it in your .env file.',
      );
    }
  }

  @Cron(CronExpression.EVERY_5_SECONDS, { waitForCompletion: true })
  async pollMessages(): Promise<void> {
    try {
      const url = `${this.signalApiUrl}/v1/receive/${encodeURIComponent(this.signalAccount)}`;
      const messages = await ky
        .get(url, { timeout: this.timeout, retry: 0 })
        .json<SignalWebhookEnvelope[]>();

      if (!Array.isArray(messages) || messages.length === 0) {
        return;
      }

      this.logger.info({ count: messages.length }, 'Received Signal messages');

      for (const msg of messages) {
        void this.handleMessage(msg);
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      this.logger.error({ error }, 'Error polling Signal messages');
    }
  }

  private async getGroupId(groupId: string) {
    if (groupId.startsWith('group.')) {
      return groupId;
    }

    const groups = await ky
      .get(
        `${this.signalApiUrl}/v1/groups/${encodeURIComponent(this.signalAccount)}`,
        { timeout: this.timeout, retry: 0 },
      )
      .json<{ id: string; internal_id: string }[]>();

    const id = groups.find((group) => group.internal_id === groupId)?.id;
    if (!id) {
      throw new Error(`Group not found: ${groupId}`);
    }

    return id;
  }

  private async handleMessage(payload: SignalWebhookEnvelope): Promise<void> {
    const envelope = payload.envelope;
    if (!envelope) return;

    // Support both: dataMessage (from others) and syncMessage.sentMessage (from self)
    const msgData = envelope.dataMessage ?? envelope.syncMessage?.sentMessage;

    if (!msgData?.message) return;

    const message = msgData.message;
    let groupId = msgData.groupInfo?.groupId;

    if (!groupId) return;
    groupId = await this.getGroupId(groupId);

    if (!message.startsWith(SEARCH_COMMAND_PREFIX)) return;

    const keyword = message.slice(SEARCH_COMMAND_PREFIX.length).trim();
    const sender = envelope.sourceNumber || envelope.source || 'unknown';

    this.logger.info(
      { groupId, sender, keyword: keyword || '(empty)' },
      'Received /search command',
    );

    void this.searchBotService
      .handleSearchCommand(groupId, sender, keyword)
      .catch((error: unknown) => {
        this.logger.error(
          { error, groupId, sender, keyword },
          'Unhandled error in search command',
        );
      });
  }
}
