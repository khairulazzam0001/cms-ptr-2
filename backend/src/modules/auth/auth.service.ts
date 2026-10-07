import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(private users: UsersService, private jwt: JwtService) {}

  async login(username: string, password: string) {
    const user = await this.users.validate(username, password);
    if (!user) return null;
    const payload = { sub: user.id, username: user.username };
    return { access_token: await this.jwt.signAsync(payload), username: user.username };
  }
}
