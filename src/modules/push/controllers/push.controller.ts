import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';

@ApiTags('push')
@Controller('push')
export class PushController {
  constructor(private readonly config: ConfigService) {}

  /**
   * The resident PWA fetches the VAPID public key to call
   * `PushManager.subscribe()`. Public: needed before any resident auth exists.
   */
  @Public()
  @Get('vapid-public-key')
  @ApiOperation({ summary: 'Get the VAPID public key for Web Push subscription' })
  getVapidPublicKey(): { publicKey: string | null } {
    return { publicKey: this.config.get<string>('webpush.publicKey') ?? null };
  }
}
