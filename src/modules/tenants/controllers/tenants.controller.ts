import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TenantsService } from '../services/tenants.service';
import { AdminsService } from '../../admins/services/admins.service';
import { CreateTenantInput } from '../dtos/inputs/create-tenant.input';
import { UpdateTenantInput } from '../dtos/inputs/update-tenant.input';
import { TenantOutput } from '../dtos/outputs/tenant.output';
import { CreateAdminInput } from '../../admins/dtos/inputs/create-admin.input';
import { IAdmin } from '../../admins/interfaces/admin.interface';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { UserRole } from '../../../common/enums/user-role.enum';
import { TenantContextService } from '../../../common/context/tenant-context.service';

/**
 * Platform-operator API: onboard and manage municipalities without touching
 * the database. SUPER_ADMIN only — these endpoints operate ACROSS tenants, so
 * the target tenant is always an explicit route param, never taken from the
 * caller's own tenant context.
 */
@ApiTags('tenants')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller('tenants')
export class TenantsController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly adminsService: AdminsService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all municipalities' })
  async findAll(): Promise<TenantOutput[]> {
    const tenants = await this.tenantsService.findAll();
    return tenants.map(TenantOutput.fromEntity);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a municipality by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<TenantOutput> {
    const tenant = await this.tenantsService.findById(id);
    if (!tenant) throw new NotFoundException(`Tenant with ID ${id} not found`);
    return TenantOutput.fromEntity(tenant);
  }

  @Post()
  @ApiOperation({ summary: 'Onboard a new municipality' })
  async create(@Body() input: CreateTenantInput): Promise<TenantOutput> {
    const tenant = await this.tenantsService.create(input);
    return TenantOutput.fromEntity(tenant);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a municipality (name, activation, WhatsApp credentials — token is write-only)',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() input: UpdateTenantInput,
  ): Promise<TenantOutput> {
    const tenant = await this.tenantsService.update(id, input);
    return TenantOutput.fromEntity(tenant);
  }

  @Post(':id/admins')
  @ApiOperation({ summary: 'Create an ADMIN account inside a municipality (its first login)' })
  async createAdmin(
    @Param('id', ParseIntPipe) id: number,
    @Body() input: CreateAdminInput,
  ): Promise<IAdmin> {
    const tenant = await this.tenantsService.findById(id);
    if (!tenant) throw new NotFoundException(`Tenant with ID ${id} not found`);

    return this.tenantContext.runWith(tenant.id, () =>
      this.adminsService.create(input, UserRole.ADMIN),
    );
  }
}
