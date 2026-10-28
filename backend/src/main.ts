import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { GlobalExceptionFilter, TransformInterceptor } from './common';
import { assertJwtConfig } from './config';

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);

    // `.env` is loaded by now (ConfigModule ran while AppModule was created).
    assertJwtConfig();

    app.use(helmet());

    // Behind a load balancer every request comes from the balancer's IP, which
    // would put all clinics in one rate-limit bucket. Set TRUST_PROXY to the
    // number of proxy hops (usually 1) so `req.ip` is the real client.
    if (process.env.TRUST_PROXY) {
        app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
    }

    app.enableCors({
        origin: process.env.CLIENT_URL || 'http://localhost:3000',
        credentials: true,
    });

    app.setGlobalPrefix('api');

    // Explicit, so it matches the largest field we accept (a ~110 KB photo as a
    // data URL). Express's implicit 100 KB rejected those with a bare 413.
    app.useBodyParser('json', { limit: '300kb' });

    app.useGlobalPipes(
        new ValidationPipe({
            transform: true,
            whitelist: true,
            forbidNonWhitelisted: true,
        }),
    );

    // Both of these existed but were never wired up. The whole client is
    // written against the `{ statusCode, message, data }` envelope, so without
    // the interceptor every paginated response unwrapped to the wrong level
    // and `total` fell back to the current page's length.
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new GlobalExceptionFilter());

    if (process.env.MODE !== 'PROD') {
        const config = new DocumentBuilder()
            .setTitle('DentFlow API')
            .setDescription('Dental Management System API')
            .setVersion('1.0.0')
            .addBearerAuth()
            .build();
        const document = SwaggerModule.createDocument(app, config);
        SwaggerModule.setup('api/docs', app, document);
    }

    const port = process.env.API_PORT || 8000;
    await app.listen(port);
    console.log(`DentFlow API running on port ${port}`);
}

bootstrap();
