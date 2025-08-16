import { DocumentBuilder } from '@nestjs/swagger';

export function buildSwaggerConfig() {
  return new DocumentBuilder()
    .setTitle('MusaidBot API')
    .setDescription('API documentation for MusaidBot')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter JWT token',
        in: 'header',
      },
      'access-token',
    )
    .setContact('Smart Academy', 'https://smartacademy.sa', 'support@smartacademy.sa')
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addServer('http://localhost:5000', 'Local environment')
    .addServer('https://api.musaidbot.com', 'Production')
    .build();
}
