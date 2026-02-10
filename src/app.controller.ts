import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { ApiKeyGuard } from './modules/domain-monitor/guards/api-key.guard';

@Controller()
export class AppController {
  private readonly apiUrl: string;

  constructor(private readonly configService: ConfigService) {
    // Default to localhost for local dev, use Docker service name in containers
    this.apiUrl = this.configService.get<string>(
      'SIGNAL_API_URL',
      'http://localhost:8080',
    );
  }

  @Get()
  getHello() {
    return { msg: 'Hello World!' };
  }

  @Get('signal/qrcode')
  @UseGuards(ApiKeyGuard)
  async getSignalQrCode(@Res() res: Response) {
    try {
      const response = await fetch(
        `${this.apiUrl}/v1/qrcodelink?device_name=domain-monitor`,
      );

      if (!response.ok) {
        return res.status(response.status).json({
          error: 'Failed to fetch QR code',
          status: response.status,
          message: await response.text(),
        });
      }

      const contentType = response.headers.get('content-type') || '';

      // If it's an image, pipe it directly
      if (contentType.includes('image')) {
        res.setHeader('Content-Type', contentType);
        const buffer = Buffer.from(await response.arrayBuffer());
        return res.send(buffer);
      }

      // Otherwise return as JSON/text
      const data = await response.text();
      try {
        return res.json(JSON.parse(data));
      } catch {
        return res.send(data);
      }
    } catch (error) {
      return res.status(500).json({
        error: 'Failed to connect to Signal CLI',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
