import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { INotificationService } from '../interfaces/notification.interface';

const MAX_MESSAGE_LENGTH = 4096;
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_RETRY_ATTEMPTS = 3;

export class VipTalkNotificationService implements INotificationService {
  private readonly baseUrl: string;
  private readonly botToken: string;
  private readonly roomId: string;
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
    this.roomId = this.configService.get<string>('VIPTALK_ROOM_ID') || '';
    this.timeout =
      this.configService.get<number>('BOT_TIMEOUT_MS') || DEFAULT_TIMEOUT_MS;
    this.maxRetries =
      this.configService.get<number>('BOT_RETRY_ATTEMPTS') ||
      DEFAULT_RETRY_ATTEMPTS;
  }

  getProviderName(): string {
    return 'VipTalk';
  }

  async sendMessage(message: string): Promise<boolean> {
    const correlationId = `vtk-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const truncatedMessage = this.truncateMessage(message);

    this.logger.debug(
      {
        correlationId,
        chars: truncatedMessage.length,
        roomId: this.roomId,
      },
      'Sending message to VipTalk room',
    );

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const success = await this.attemptSend(
          truncatedMessage,
          correlationId,
          attempt,
        );
        if (success) {
          this.logger.info(
            { correlationId, attempt },
            'Message sent successfully on attempt',
          );
          return true;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(
          {
            correlationId,
            attempt,
            maxRetries: this.maxRetries,
            errorMessage,
          },
          'Attempt failed',
        );

        if (attempt < this.maxRetries) {
          const delay = this.getBackoffDelay(attempt);
          this.logger.info({ correlationId, delay }, 'Retrying');
          await this.sleep(delay);
        }
      }
    }

    this.logger.error(
      { correlationId, maxRetries: this.maxRetries },
      'All attempts failed',
    );
    return false;
  }

  private async attemptSend(
    message: string,
    correlationId: string,
    attempt: number,
  ): Promise<boolean> {
    const url = `${this.baseUrl}/v1/bot/${this.botToken}/sendMessage`;

    // VipTalk uses application/x-www-form-urlencoded
    const body = new URLSearchParams({
      text: message,
      roomIds: this.roomId,
    });

    this.logger.debug(
      { correlationId, attempt, url, roomId: this.roomId },
      'Attempt send via VipTalk REST API',
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${responseText}`);
      }

      // Try to parse response for logging
      try {
        const data = JSON.parse(responseText) as Record<string, unknown>;
        this.logger.debug(
          { correlationId, response: data },
          'VipTalk API response',
        );
      } catch {
        this.logger.debug(
          { correlationId, response: responseText },
          'VipTalk API response',
        );
      }

      return true;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }

      throw error;
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

  private getBackoffDelay(attempt: number): number {
    // Exponential backoff: 1s, 2s, 4s
    return Math.pow(2, attempt - 1) * 1000;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
