import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Username dari JWT (JwtStrategy.validate -> { userId, username }). Dipakai untuk kolom audit.
export const CurrentUsername = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest();
  return req.user?.username;
});
