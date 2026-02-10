import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ky, { type HTTPError } from 'ky';
import { PinoLogger } from 'nestjs-pino';
import {
  SerpApiConfig,
  SerpApiResponse,
  SerpApiResult,
} from './interfaces/serpapi.interface';

const SERPAPI_BASE_URL = 'https://serpapi.com/search.json';

export class SerpApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'SerpApiError';
  }
}

@Injectable()
export class SerpApiService {
  private readonly config: SerpApiConfig;
  private readonly timeout: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(SerpApiService.name);

    const apiKey = this.configService.get<string>('SERPAPI_API_KEY');
    if (!apiKey) {
      throw new Error(
        'SERPAPI_API_KEY is required. Please set it in your .env file.',
      );
    }

    this.config = {
      apiKey,
      engine: this.configService.get<string>('SERPAPI_ENGINE') || 'google',
      gl: this.configService.get<string>('SERPAPI_GL') || 'vn',
      hl: this.configService.get<string>('SERPAPI_HL') || 'vi',
      location: this.configService.get<string>('SERPAPI_LOCATION') || 'Vietnam',
      googleDomain:
        this.configService.get<string>('SERPAPI_GOOGLE_DOMAIN') || 'google.com',
      num: this.configService.get<number>('SERPAPI_NUM') || 10,
      device: this.configService.get<string>('SERPAPI_DEVICE_MB') || 'mobile',
    };

    this.timeout =
      this.configService.get<number>('SERPAPI_TIMEOUT_MS') || 15_000;
  }

  async search(keyword: string): Promise<SerpApiResult[]> {
    const params = new URLSearchParams({
      api_key: this.config.apiKey,
      engine: this.config.engine,
      q: keyword,
      gl: this.config.gl,
      hl: this.config.hl,
      location: this.config.location,
      google_domain: this.config.googleDomain,
      num: String(this.config.num),
      device: this.config.device,
      output: 'json',
    });

    const url = `${SERPAPI_BASE_URL}?${params.toString()}`;

    this.logger.debug(
      { keyword, engine: this.config.engine },
      'Searching SerpAPI',
    );

    try {
      const data = await ky
        .get(url, {
          timeout: this.timeout,
          retry: 0,
        })
        .json<SerpApiResponse>();

      if (data.error) {
        throw new SerpApiError(data.error, 'API_ERROR');
      }

      const organicResults = data.organic_results || [];

      const results: SerpApiResult[] = organicResults.map((r) => ({
        position: r.position,
        title: r.title,
        link: r.link,
        snippet: r.snippet,
      }));

      this.logger.info(
        {
          keyword,
          resultsCount: results.length,
          totalResults: data.search_information?.total_results,
        },
        'Search completed',
      );

      return results;
    } catch (error) {
      if (error instanceof SerpApiError) {
        throw error;
      }

      if (error && typeof error === 'object' && 'response' in error) {
        const httpError = error as HTTPError;
        const errorText = await httpError.response
          .text()
          .catch(() => 'Unknown error');
        this.handleHttpError(httpError.response.status, errorText);
      }

      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new SerpApiError(
          `Tìm kiếm bị timeout sau ${this.timeout / 1000}s. Vui lòng thử lại.`,
          'TIMEOUT',
        );
      }

      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new SerpApiError(
        `Lỗi kết nối SerpAPI: ${message}`,
        'NETWORK_ERROR',
      );
    }
  }

  private handleHttpError(status: number, errorText: string): never {
    switch (status) {
      case 401:
        throw new SerpApiError(
          'API key không hợp lệ. Vui lòng kiểm tra SERPAPI_API_KEY.',
          'INVALID_KEY',
        );
      case 403:
        throw new SerpApiError(
          'API key đã hết quota. Vui lòng nạp thêm credits tại serpapi.com.',
          'QUOTA_EXCEEDED',
        );
      case 429:
        throw new SerpApiError(
          'Quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.',
          'RATE_LIMIT',
        );
      default:
        throw new SerpApiError(
          `Lỗi SerpAPI (HTTP ${status}): ${errorText}`,
          'HTTP_ERROR',
        );
    }
  }
}
