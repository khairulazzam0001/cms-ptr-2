import { Body, Controller, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './login.dto';
import { Public } from '../../common/decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto) {
    const res = await this.auth.login(dto.username, dto.password);
    if (!res) throw new UnauthorizedException('Username / password salah');
    return res;
  }
}
