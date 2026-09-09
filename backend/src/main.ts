import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { GlobalExceptionFilter, TransformInterceptor } from './common';

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);

    app.use(helmet());

    app.enableCors({
        origin: process.env.CLIENT_URL || 'http://localhost:3000',
        credentials: true,
    });

    app.setGlobalPrefix('api');

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
