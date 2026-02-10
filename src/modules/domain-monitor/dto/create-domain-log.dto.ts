import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class DomainResultDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  url: string;

  @IsOptional()
  error: unknown;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  status: string;
}

export class CreateDomainLogDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  isp: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/, {
    message: 'timestamp must be in format DD/MM/YYYY HH:mm:ss',
  })
  timestamp: string;

  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1, { message: 'At least one result is required' })
  @ArrayMaxSize(100, { message: 'Maximum 100 results per request' })
  @Type(() => DomainResultDto)
  results: DomainResultDto[];
}
