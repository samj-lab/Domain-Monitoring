import { ConfigService } from '@nestjs/config';
import ky, { type HTTPError } from 'ky';
import { PinoLogger } from 'nestjs-pino';
import { INotificationService } from '../interfaces/notification.interface';

const MAX_MESSAGE_LENGTH = 4096;

interface SendResponse {
  timestamp?: number;
  results?: Array<{
    recipientAddress?: { uuid?: string; number?: string };
    type?: string;
  }>;
}

export class SignalNotificationService implements INotificationService {
  private readonly baseUrl: string;
  private readonly account: string;
  private readonly groupId: string;
  private readonly timeout: number;
  private readonly maxRetries: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.baseUrl =
      this.configService.get<string>('SIGNAL_API_URL') ||
      'http://localhost:8080';

    this.account = this.configService.get<string>('SIGNAL_ACCOUNT') || '';
    this.groupId = this.configService.get<string>('SIGNAL_GROUP_ID') || '';
    this.timeout = this.configService.get<number>('BOT_TIMEOUT_MS') || 10_000;
    this.maxRetries = this.configService.get<number>('BOT_RETRY_ATTEMPTS') || 3;
  }

  getProviderName(): string {
    return 'Signal';
  }

  async sendMessage(message: string): Promise<boolean> {
    const correlationId = `sig-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const truncatedMessage = this.truncateMessage(message);

    this.logger.debug(
      {
        correlationId,
        chars: truncatedMessage.length,
        account: this.account,
        groupId: this.groupId,
      },
      'Sending message to Signal group',
    );

    const url = `${this.baseUrl}/v2/send`;
    const payload = {
      message: truncatedMessage,
      number: this.account,
      recipients: [this.groupId],
    };

    try {
      const data = await ky
        .post(url, {
          json: payload,
          timeout: this.timeout,
          retry: {
            limit: this.maxRetries,
            methods: ['post'],
            backoffLimit: 4000,
          },
        })
        .json<SendResponse>();

      this.logger.info({ correlationId }, 'Message sent successfully');

      return data.timestamp !== undefined || data.results !== undefined;
    } catch (error) {
      if (error && typeof error === 'object' && 'response' in error) {
        const httpError = error as HTTPError;
        const errorText = await httpError.response
          .text()
          .catch(() => 'Unknown error');
        this.logger.error(
          { correlationId, status: httpError.response.status, errorText },
          'All attempts failed',
        );
      } else {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(
          { correlationId, errorMessage },
          'All attempts failed',
        );
      }

      return false;
    }
  }

  private truncateMessage(message: string): string {
    if (message.length <= MAX_MESSAGE_LENGTH) {
      return message;
    }

    const truncationNotice = '\n\n... [Message truncated]';
    return (
      message.substring(0, MAX_MESSAGE_LENGTH - truncationNotice.length) +
      truncationNotice
    );
  }
}
