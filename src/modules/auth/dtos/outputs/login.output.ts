import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../../../common/enums/user-role.enum';

class AuthUserOutput {
  @ApiProperty() id!: number;
  @ApiProperty() username!: string;
  @ApiProperty({ enum: UserRole }) role!: UserRole;
  @ApiProperty() name!: string;
  @ApiProperty() tenantId!: number;
  @ApiProperty() tenantName!: string;
  @ApiProperty() tenantSlug!: string;
}

export class LoginOutput {
  @ApiProperty() accessToken!: string;
  @ApiProperty({ type: AuthUserOutput }) user!: AuthUserOutput;
}
