import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminsService } from '../services/admins.service';
import { CreateAdminInput } from '../dtos/inputs/create-admin.input';
import { UpdateAdminInput } from '../dtos/inputs/update-admin.input';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { UserRole } from '../../../common/enums/user-role.enum';
import { IAdmin } from '../interfaces/admin.interface';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { IJwtPayload } from '../../../common/interfaces/jwt-payload.interface';

@ApiTags('admins')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admins')
export class AdminsController {
  constructor(private readonly adminsService: AdminsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new admin account' })
  create(@Body() input: CreateAdminInput): Promise<IAdmin> {
    return this.adminsService.create(input);
  }

  @Get()
  @ApiOperation({ summary: 'List all admins' })
  findAll(): Promise<IAdmin[]> {
    return this.adminsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an admin by ID' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<IAdmin> {
    return this.adminsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an admin' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() input: UpdateAdminInput,
    @CurrentUser() user: IJwtPayload,
  ): Promise<IAdmin> {
    // The caller's own id goes down so the service can refuse the two moves
    // that lock a municipality out of its own panel.
    return this.adminsService.update(id, input, user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an admin' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: IJwtPayload): Promise<void> {
    return this.adminsService.remove(id, user.sub);
  }
}
