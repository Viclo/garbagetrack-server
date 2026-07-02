import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';
import { IServiceInfo } from './common/interfaces/service-info.interface';

@ApiTags('health')
@Public()
@Controller()
export class AppController {
  @Get()
  @ApiOperation({ summary: 'Service liveness / root info' })
  getRoot(): IServiceInfo {
    return {
      name: 'GarbageTrack API',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
