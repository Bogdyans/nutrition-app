import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const isProduction = process.env.NODE_ENV === 'production';

  // Behind a reverse proxy (nginx/caddy/cloud) X-Forwarded-For carries the real
  // client IP — without this every client shares the proxy's IP for throttling.
  app.set('trust proxy', 1);

  // Security headers. CSP stays off outside production because Swagger UI
  // relies on an inline bootstrap script that the default policy blocks.
  app.use(helmet({ contentSecurityPolicy: isProduction ? undefined : false }));

  // Everything lives under /api, except the public privacy policy page which
  // must be reachable at the bare https://<domain>/privacy URL (app + stores).
  app.setGlobalPrefix('api', {
    exclude: [{ path: 'privacy', method: RequestMethod.GET }],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // API schema is for development only — don't advertise it publicly.
  if (!isProduction) {
    const config = new DocumentBuilder()
      .setTitle('My API')
      .setDescription('API documentation')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(process.env.PORT ?? 3001, '0.0.0.0');
}
bootstrap();
