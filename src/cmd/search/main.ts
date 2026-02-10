import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { SearchAppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(SearchAppModule);

  const logger = app.get(Logger);
  app.useLogger(logger);
  app.enableCors();

  const port = process.env.SEARCH_BOT_PORT || 3001;
  await app.listen(port);

  logger.log({ port }, 'Search Bot started successfully');
}

void bootstrap();
