import { ConfigService } from '@nestjs/config';
import ky, { type HTTPError } from 'ky';
import { PinoLogger } from 'nestjs-pino';
import { INotificationService } from '../interfaces/notification.interface';

const MAX_MESSAGE_LENGTH = 4096;

export class VipTalkNotificationService implements INotificationService {
  private readonly baseUrl: string;
  private readonly botToken: string;
  private readonly timeout: number;
  private readonly maxRetries: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.baseUrl =
      this.configService.get<string>('VIPTALK_API_URL') ||
      'https://api.viptalk.org';
    this.botToken = this.configService.get<string>('VIPTALK_BOT_TOKEN') || '';
    this.timeout = this.configService.get<number>('BOT_TIMEOUT_MS') || 10_000;
    this.maxRetries = this.configService.get<number>('BOT_RETRY_ATTEMPTS') || 3;
  }

  getProviderName(): string {
    return 'VipTalk';
  }

  async sendMessage(input: {
    groupId: string;
    message: string;
  }): Promise<boolean> {
    const correlationId = `vtk-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const { groupId, message } = input;
    const truncatedMessage = this.truncateMessage(message);

    this.logger.debug(
      {
        correlationId,
        chars: truncatedMessage.length,
        roomId: groupId,
      },
      'Sending message to VipTalk room',
    );

    const url = `${this.baseUrl}/v1/bot/${this.botToken}/sendMessage`;
    const body = new URLSearchParams({
      text: truncatedMessage,
      roomIds: groupId,
    });

    try {
      await ky.post(url, {
        body: body.toString(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: this.timeout,
        retry: {
          limit: this.maxRetries,
          methods: ['post'],
          backoffLimit: 4000,
        },
      });

      this.logger.info({ correlationId }, 'Message sent successfully');

      return true;
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
