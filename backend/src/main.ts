// Muat .env SEBELUM modul lain di-import: dekorator (@Module, @UseInterceptors) membaca
// process.env saat import, sebelum ConfigModule.forRoot() sempat jalan.
import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  );
  app.enableCors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:3000', credentials: true });

  // Serve file upload statis: GET /uploads/namafile
  const uploadDir = process.env.UPLOAD_DIR ?? './uploads';
  app.useStaticAssets(join(process.cwd(), uploadDir), { prefix: '/uploads/' });

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Backend CMS jalan di http://localhost:${port}/api`);
}
bootstrap();
