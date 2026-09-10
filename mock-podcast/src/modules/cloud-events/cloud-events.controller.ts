import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { isUserLoggedIn } from '../../utils';
import { CloudEventsService } from './cloud-events.service';

@Controller('cloud-events')
export class CloudEventsController {
  constructor(private readonly cloudEventsService: CloudEventsService) {}

  /**
   * POST /cloud-events
   * 
   * Main Cloud Events ingestion router. Receives standardized JSON Cloud Events dispatched by Zapp client renderers.
   * Requires Bearer Token authorization.
   * 
   * Supported Cloud Event types:
   * - `com.applicaster.collection.add.v1`: Add track item to collection
   * - `com.applicaster.collection.add.collection.v1`: Copy all items from source collection to target
   * - `com.applicaster.collection.remove.v1`: Remove item from collection
   * - `com.applicaster.collection.delete.v1`: Delete collection
   * - `com.applicaster.collection.create.v1`: Create new collection (optionally adding initial track)
   * - `com.applicaster.collection.rename.v1`: Rename custom collection
   * - `com.applicaster.collection.reorder.v1`: Update track ordering in collection
   * - `com.applicaster.video.started.v1`: Log playback start event
   * - `com.applicaster.video.stopped.v1`: Log playback stop event
   * - `com.applicaster.pin.v1`: Verify parental control PIN
   * - `com.applicaster.pin.set.v1`: Set parental control PIN
   * - `com.applicaster.pin.change.v1`: Change PIN (steps: verify_current, confirm_change, disable)
   * - `com.applicaster.pin.reset.v1`: Reset PIN to a known code (needs an owner grant)
   * - `com.applicaster.pin.recovery.requested.v1`: "Forgot PIN" — reset without authorisation
   * 
   * @param body Cloud Event JSON payload complying with CloudEvents 1.0 specification.
   */
  // Nest answers POST with 201 by default; the real backend replies 200 on
  // success, so the mock must too — a client keying off the status would
  // otherwise see a difference that only exists locally.
  @Post()
  @HttpCode(200)
  async handleCloudEvent(
    @Req() req: Request,
    @Body() body: Record<string, any>,
  ) {
    if (!isUserLoggedIn(req)) {
      throw new UnauthorizedException(
        'Authorization header with Bearer token is required',
      );
    }

    return this.cloudEventsService.handleEvent(body);
  }
}
