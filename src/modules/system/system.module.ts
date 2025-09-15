import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { CacheModule } from '../../common/cache/cache.module';
import { RedisModule } from '../../config/redis.module';

@Module({
  imports: [CacheModule, RedisModule],
  controllers: [HealthController],
})
export class SystemModule {}
