import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: 'http://localhost:3002', // 프론트엔드 주소
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3003);
}

void bootstrap();
