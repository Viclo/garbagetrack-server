import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Admin } from '../../modules/admins/entities/admin.entity';
import { Driver } from '../../modules/drivers/entities/driver.entity';

/**
 * Usernames are unique per tenant in the database (roadmap A2) so two
 * municipalities can each have an "admin". But login from the bare apex —
 * anyone can log in there and get redirected to their own subdomain — does a
 * lookup with no tenant context (admins checked before drivers). If two rows
 * anywhere shared a username, that lookup would be ambiguous and could
 * authenticate the wrong account. Rather than tighten the DB constraint back
 * to global (losing the per-tenant flexibility), this is checked once, at
 * creation time, across both tables and every tenant.
 */
@Injectable()
export class UsernameRegistryService {
  constructor(
    @InjectRepository(Admin) private readonly adminsRepo: Repository<Admin>,
    @InjectRepository(Driver) private readonly driversRepo: Repository<Driver>,
  ) {}

  async isTaken(username: string): Promise<boolean> {
    const [admin, driver] = await Promise.all([
      this.adminsRepo.findOne({ where: { username } }),
      this.driversRepo.findOne({ where: { username } }),
    ]);
    return admin != null || driver != null;
  }
}
