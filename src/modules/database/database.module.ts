import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DomainMonitorLog } from './entities/domain-monitor-log.entity';
import { SearchLog } from './entities/search-log.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DATABASE_HOST', 'localhost'),
        port: configService.get<number>('DATABASE_PORT', 5432),
        username: configService.get<string>('DATABASE_USER', 'postgres'),
        password: configService.get<string>('DATABASE_PASSWORD', 'postgres'),
        database: configService.get<string>('DATABASE_NAME', 'domain_monitor'),
        entities: [DomainMonitorLog, SearchLog],
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        synchronize: false,
        logging: configService.get<string>('NODE_ENV') !== 'production',
      }),
    }),
    TypeOrmModule.forFeature([DomainMonitorLog, SearchLog]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
