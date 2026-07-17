import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentRoute = createParamDecorator(
  (data: any, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const protocol = request.get('x-forwarded-proto') || request.protocol;
    const host = request.get('x-forwarded-host') || request.get('host');

    try {
      const parsedUrl = new URL(request.url, `${protocol}://${host}`);
      parsedUrl.searchParams.delete('ctx');
      return parsedUrl.toString();
    } catch (error) {
      console.log('Failed to parse URL in CurrentRoute:', error);
      return `${protocol}://${host}${request.url}`;
    }
  },
);
