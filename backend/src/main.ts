import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { configureApp } from './app.setup';
import { assertJwtConfig } from './config';

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);

    // `.env` is loaded by now (ConfigModule ran while AppModule was created).
    assertJwtConfig();

    configureApp(app);

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
