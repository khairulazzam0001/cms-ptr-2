import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

// Satu sumber secret untuk sign (JwtModule) & verify (strategy). Fail fast bila kosong.
export function jwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET belum di-set di backend/.env');
  return s;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret(),
    });
  }
  async validate(payload: { sub: number; username: string }) {
    return { userId: payload.sub, username: payload.username };
  }
}
