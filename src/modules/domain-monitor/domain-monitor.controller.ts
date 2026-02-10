import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { DomainMonitorService } from './domain-monitor.service';
import { CreateDomainLogDto } from './dto/create-domain-log.dto';
import { ApiKeyGuard } from './guards/api-key.guard';

@Controller('/domain-monitoring')
export class DomainMonitorController {
  constructor(private readonly domainMonitorService: DomainMonitorService) {}

  @Post()
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  async create(@Body() createDomainLogDto: CreateDomainLogDto) {
    const result = await this.domainMonitorService.saveLogs(createDomainLogDto);

    return {
      success: true,
      total: result.total,
      saved: result.saved,
      ids: result.ids,
      notificationSent: result.notificationSent,
      message: `Successfully saved ${result.saved} logs`,
    };
  }
}
