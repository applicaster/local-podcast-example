import { HttpException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { UpstreamService } from './upstream.service';

describe('UpstreamService', () => {
  const build = (get: jest.Mock) => new UpstreamService({ get } as any);
  const req = (headers: Record<string, string>) => ({ headers }) as any;

  it('returns the body the upstream answered with', async () => {
    const get = jest.fn(() => of({ status: 200, data: { ok: true } }));

    await expect(build(get).get('Thing', 'https://demo/x')).resolves.toEqual({
      ok: true,
    });
    expect(get).toHaveBeenCalledWith('https://demo/x', { headers: {} });
  });

  // The upstream authorises per account and per viewer. The mock can mint
  // neither, so it passes on exactly what the client sent — and nothing else:
  // the client's Host and cookies belong to a different server.
  it('forwards the credentials the client sent, and nothing else', async () => {
    const get = jest.fn((_url: string, _config: unknown) =>
      of({ status: 200, data: {} }),
    );

    await build(get).get(
      'Thing',
      'https://demo/x',
      req({
        authorization: 'Bearer real-token',
        'x-viewer-id': 'a3JVE000005wcej2AA',
        accept: 'application/vnd+applicaster.pipes+json',
        host: 'localhost:3000',
        cookie: 'should-not-travel',
      }),
    );

    expect(get.mock.calls[0][1]).toEqual({
      headers: {
        authorization: 'Bearer real-token',
        'x-viewer-id': 'a3JVE000005wcej2AA',
        accept: 'application/vnd+applicaster.pipes+json',
      },
    });
  });

  // A 401 here means the client's token was refused. Turning it into a 500
  // would send whoever is debugging looking in the wrong place.
  it('answers with the upstream own status', async () => {
    const get = jest.fn(() =>
      throwError(() => ({
        message: 'Request failed',
        response: { status: 401, data: { message: 'Unauthorized' } },
      })),
    );

    await expect(build(get).get('Thing', 'https://demo/x')).rejects.toThrow(
      HttpException,
    );
  });

  it('reports a bad gateway when the upstream cannot be reached', async () => {
    const get = jest.fn(() => throwError(() => ({ message: 'ECONNREFUSED' })));

    await expect(
      build(get).get('Thing', 'https://demo/x'),
    ).rejects.toMatchObject({ status: 502 });
  });
});
