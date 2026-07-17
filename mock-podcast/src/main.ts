import { NestFactory } from '@nestjs/core';
import { MockPodcastModule } from './mock-podcast.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(MockPodcastModule);
  const logger = new Logger('Bootstrap');

  app.enableCors();

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Server is running on: http://localhost:${port}`);
}
bootstrap();
