import { ApiProperty } from '@nestjs/swagger';
import { Tenant } from '../../entities/tenant.entity';

export class TenantOutput {
  @ApiProperty() id!: number;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;

  static fromEntity(tenant: Tenant): TenantOutput {
    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      isActive: tenant.isActive,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }
}
