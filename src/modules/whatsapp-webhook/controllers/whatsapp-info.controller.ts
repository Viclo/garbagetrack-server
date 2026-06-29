import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WhatsAppApiService } from '../../notifications/services/whatsapp-api.service';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { UserRole } from '../../../common/enums/user-role.enum';

interface IBusinessNumberResponse {
  displayPhoneNumber: string | null;
  verifiedName: string | null;
}

@ApiTags('whatsapp')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('whatsapp')
export class WhatsappInfoController {
  constructor(private readonly whatsAppApiService: WhatsAppApiService) {}

  @Get('business-number')
  @ApiOperation({
    summary: 'Resolve the WhatsApp business number from Meta credentials (for the registration QR)',
  })
  async getBusinessNumber(): Promise<IBusinessNumberResponse> {
    const info = await this.whatsAppApiService.getBusinessPhone();
    return {
      displayPhoneNumber: info?.displayPhoneNumber ?? null,
      verifiedName: info?.verifiedName ?? null,
    };
  }
}
