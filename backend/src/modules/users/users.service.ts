import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  findByUsername(username: string) {
    return this.repo.findOne({ where: { username } });
  }

  async validate(username: string, password: string): Promise<User | null> {
    const user = await this.findByUsername(username);
    if (!user) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    return ok ? user : null;
  }

  async ensureSingleAdmin(username: string, plainPassword: string) {
    let admin = await this.findByUsername(username);
    const hash = await bcrypt.hash(plainPassword, 10);
    if (!admin) {
      admin = this.repo.create({ username, passwordHash: hash });
    } else {
      admin.passwordHash = hash; // reset tiap seed agar pasti bisa login
    }
    return this.repo.save(admin);
  }
}
