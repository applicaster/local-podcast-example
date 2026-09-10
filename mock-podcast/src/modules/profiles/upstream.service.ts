import { HttpException, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Request } from 'express';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

/**
 * Headers the upstream needs, named exactly as the Zapp endpoint config
 * produces them: `quick-brick-login-flow.access_token` as a bearer header and
 * `user_account.profile` mapped to `X-VIEWER-ID`. They are forwarded verbatim
 * rather than rebuilt — the mock has no account and could not mint either.
 *
 * Only these travel. Copying the whole set would forward the client's Host and
 * content negotiation for a different server, and the upstream reads nothing
 * else from us.
 */
const FORWARDED_HEADERS = ['authorization', 'x-viewer-id', 'accept'] as const;

/**
 * Fetches a feed from the customer's own backend on behalf of the caller.
 *
 * The mock proxies what the customer already serves rather than reproducing
 * it: their form carries their validation and their save action, their profile
 * list carries whatever was last edited there. Only the parts this mock exists
 * to demonstrate are rewritten on the way through.
 */
@Injectable()
export class UpstreamService {
  private readonly logger = new Logger(UpstreamService.name);

  constructor(private readonly http: HttpService) {}

  /**
   * @param label what to call this request in the log
   * @throws HttpException carrying the upstream's own status
   */
  async get<T>(label: string, url: string, req?: Request): Promise<T> {
    const headers = this.forwardedHeaders(req);

    this.logger.log(
      `${label} upstream="${url}" headers=[${Object.keys(headers).join(', ')}]`,
    );

    try {
      const response = await firstValueFrom(this.http.get<T>(url, { headers }));

      this.logger.log(`${label} upstream answered status=${response.status}`);

      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status ?? 502;

      // Answering with the upstream's own status matters: a 401 here means the
      // token the client sent was refused, and turning that into a 500 would
      // send whoever is debugging looking in the wrong place.
      this.logger.warn(
        `${label} upstream failed status=${status} message="${axiosError.message}"`,
      );

      throw new HttpException(
        axiosError.response?.data || `${label} upstream failed`,
        status,
      );
    }
  }

  private forwardedHeaders(req?: Request): Record<string, string> {
    const headers: Record<string, string> = {};

    for (const name of FORWARDED_HEADERS) {
      const value = req?.headers?.[name];

      if (typeof value === 'string' && value) {
        headers[name] = value;
      }
    }

    return headers;
  }
}
