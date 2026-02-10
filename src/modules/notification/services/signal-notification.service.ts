import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { INotificationService } from '../interfaces/notification.interface';

const MAX_MESSAGE_LENGTH = 4096;
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_RETRY_ATTEMPTS = 3;

interface SendResponse {
  timestamp?: number;
  results?: Array<{
    recipientAddress?: { uuid?: string; number?: string };
    type?: string;
  }>;
}

interface ErrorResponse {
  error?: string;
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
    this.timeout =
      this.configService.get<number>('BOT_TIMEOUT_MS') || DEFAULT_TIMEOUT_MS;
    this.maxRetries =
      this.configService.get<number>('BOT_RETRY_ATTEMPTS') ||
      DEFAULT_RETRY_ATTEMPTS;
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
    // Use the REST API v2/send endpoint
    // See: https://github.com/bbernhard/signal-cli-rest-api/blob/master/doc/EXAMPLES.md
    const url = `${this.baseUrl}/v2/send`;

    const payload = {
      message,
      number: this.account,
      recipients: [this.groupId],
    };

    this.logger.debug(
      { correlationId, attempt, url, recipients: payload.recipients },
      'Attempt send via REST API',
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseText = await response.text();

      if (!response.ok) {
        // Try to parse error response
        try {
          const errorData = JSON.parse(responseText) as ErrorResponse;
          throw new Error(
            `HTTP ${response.status}: ${errorData.error || response.statusText}`,
          );
        } catch {
          throw new Error(`HTTP ${response.status}: ${responseText}`);
        }
      }

      // Parse successful response
      const data = JSON.parse(responseText) as SendResponse;

      this.logger.debug(
        { correlationId, response: data },
        'Signal API response',
      );

      // Success if we got a timestamp or results
      return data.timestamp !== undefined || data.results !== undefined;
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
