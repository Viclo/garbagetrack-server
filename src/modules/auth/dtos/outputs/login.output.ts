import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../../../common/enums/user-role.enum';

class AuthUserOutput {
  @ApiProperty() id!: number;
  @ApiProperty() username!: string;
  @ApiProperty({ enum: UserRole }) role!: UserRole;
  @ApiProperty() name!: string;
}

export class LoginOutput {
  @ApiProperty() accessToken!: string;
  @ApiProperty({ type: AuthUserOutput }) user!: AuthUserOutput;
}
