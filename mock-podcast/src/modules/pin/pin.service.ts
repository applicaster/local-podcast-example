import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { CLOUD_EVENT_TYPES } from '../../constants/cloud-event-types.constants';
import { PinPersistenceService } from './pin.persistence.service';
import { PinGrantService } from './pin.grant.service';
import { ProfilesRepository } from '../profiles/profiles.repository';
import { PinAck, PinEventData, PinRecord } from './pin.types';

export const PIN_EVENT_TYPES: ReadonlySet<string> = new Set([
  CLOUD_EVENT_TYPES.PIN_CODE,
  CLOUD_EVENT_TYPES.PIN_CODE_SET,
  CLOUD_EVENT_TYPES.PIN_CODE_CHANGE,
  CLOUD_EVENT_TYPES.PIN_CODE_RESET,
  CLOUD_EVENT_TYPES.PIN_CODE_RECOVERY_REQUESTED,
]);

/** Normalises the profile id, so 12345 and "12345" address one record. */
export const profileKey = (data: PinEventData): string =>
  String(data.profile ?? '');

/**
 * Where a reset or a recovery lands a profile.
 *
 * The real flow emails the account and the user picks their own code. There
 * is no mail server here, so the mock jumps to the end state and uses one
 * well-known code, which is also what makes the flow testable at all.
 */
export const RESET_PIN = '3333';

export const buildPinAck = (subject: string, id: string): PinAck => ({
  specversion: '1.0',
  type: CLOUD_EVENT_TYPES.EVENT_RECEIVED,
  source: 'podcast-server',
  subject,
  id,
  time: new Date().toISOString(),
});

/**
 * Parental control PIN state.
 *
 * PINs are keyed on the PROFILE carried in the event payload, never on the
 * caller. A master profile manages a child profile's PIN by naming that
 * child, so there is deliberately no check that the caller owns the profile
 * it addresses — the mock cannot tell master from child, and the real
 * relationship lives in a backend it does not have.
 */
@Injectable()
export class PinService implements OnModuleInit {
  private readonly logger = new Logger(PinService.name);
  private pins: PinRecord[] = [];

  constructor(
    private readonly persistence: PinPersistenceService,
    private readonly grants: PinGrantService,
    private readonly profiles: ProfilesRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    this.pins = await this.persistence.loadPins();
    this.logger.log(`Initialized with ${this.pins.length} pin record(s)`);
  }

  async handlePinEvent(eventType: string, data: PinEventData): Promise<PinAck> {
    this.logger.log(
      `PIN event received type="${eventType}" step="${
        data.step ?? '-'
      }" profile="${profileKey(data) || '-'}" request=${JSON.stringify(data)}`,
    );

    // No profile means the app-wide PIN, which is a mode in its own right:
    // some apps gate everything behind one code and never send a profile.
    // Logged because the same shape also appears when a per-profile client
    // drops the profile on the way, and the two look identical from here.
    if (!profileKey(data)) {
      this.logger.log(
        `PIN event type="${eventType}" carries no profile — using the app-wide PIN`,
      );
    }

    try {
      const ack = await this.route(eventType, data);
      this.logger.log(
        `PIN event ok type="${eventType}" status=200 subject="${
          ack.subject
        }" response=${JSON.stringify(ack)}`,
      );
      return ack;
    } catch (error) {
      const status = error instanceof HttpException ? error.getStatus() : 500;
      const body =
        error instanceof HttpException
          ? error.getResponse()
          : (error as Error).message;

      this.logger.warn(
        `PIN event failed type="${eventType}" status=${status} response=${JSON.stringify(
          body,
        )}`,
      );
      throw error;
    }
  }

  /**
   * Whether the profile is currently protected.
   *
   * Deliberately reports only presence, never the code itself — the actions
   * feed needs to know which options to offer, nothing more.
   */
  hasPin(profile: string): boolean {
    return this.find(profile) !== undefined;
  }

  private async route(eventType: string, data: PinEventData): Promise<PinAck> {
    switch (eventType) {
      case CLOUD_EVENT_TYPES.PIN_CODE:
        return this.verify(data);
      case CLOUD_EVENT_TYPES.PIN_CODE_SET:
        return this.set(data);
      case CLOUD_EVENT_TYPES.PIN_CODE_CHANGE:
        return this.change(data);
      case CLOUD_EVENT_TYPES.PIN_CODE_RESET:
        return this.reset(data);
      case CLOUD_EVENT_TYPES.PIN_CODE_RECOVERY_REQUESTED:
        return this.recover(data);
      default:
        throw new BadRequestException(`Unsupported PIN event: ${eventType}`);
    }
  }

  private async verify(data: PinEventData): Promise<PinAck> {
    const profile = profileKey(data);
    const record = this.find(profile);

    this.logger.debug(
      `PIN check profile="${profile || '-'}" stored="${
        record?.pinCode ?? '<none>'
      }" received="${data.pin_code ?? '<none>'}"`,
    );

    if (!record) {
      throw new BadRequestException('PIN is not set');
    }

    if (!data.pin_code || data.pin_code !== record.pinCode) {
      throw new BadRequestException('Invalid pin code');
    }

    this.grantIfManaging(profile, data);

    return buildPinAck('Valid Pin Code', data.pin_code);
  }

  /**
   * Opens the management window, but only for a verify that says it is one.
   *
   * `purpose` matters because the same event verifies a PIN for two different
   * reasons: entering a profile, and proving parental authority. Without the
   * marker the owner unlocking their own profile would silently gain the
   * right to rewrite everyone else's PIN for the next five minutes.
   */
  private grantIfManaging(profile: string, data: PinEventData): void {
    if (data.purpose !== 'manage') {
      return;
    }

    const owner = this.profiles.ownerId();

    if (!owner || profile !== owner) {
      this.logger.warn(
        `Management verify from profile="${
          profile || '-'
        }" which is not the account owner ("${owner || 'none'}") — no grant`,
      );

      return;
    }

    this.grants.issue(profile);
  }

  /**
   * Refuses anything carrying parental authority without an open window.
   *
   * The check is on the owner rather than on the caller because the mock has
   * no caller: an event names the profile it targets, not who sent it. What
   * cannot be faked is the window itself — it opens only when someone proves
   * the owner's PIN.
   */
  private requireOwnerGrant(action: string): void {
    const owner = this.profiles.ownerId();

    if (owner && this.grants.has(owner)) {
      return;
    }

    // An owner who has turned their own PIN off has no authority to prove,
    // and a check that cannot be satisfied is not a check — it just makes
    // reset impossible for everyone. The requirements call the owner PIN
    // optional while theirs is the only profile, so this state is legitimate;
    // it is also the state that leaves every other profile unprotectable,
    // which is why it is a warning rather than a silent pass.
    if (owner && !this.hasPin(owner)) {
      this.logger.warn(
        `${action} allowed without a grant: the account owner ("${owner}") has no PIN to prove`,
      );

      return;
    }

    this.logger.warn(
      `${action} refused: no active management grant for the account owner ("${
        owner || 'none'
      }")`,
    );

    throw new ForbiddenException(
      'Account owner authorization is required for this action',
    );
  }

  private async set(data: PinEventData): Promise<PinAck> {
    if (!data.pin_code) {
      throw new BadRequestException('PIN is required');
    }

    const profile = profileKey(data);

    // Setting a first PIN is open — there is nothing to protect yet, and this
    // is the ordinary set-pin flow. REPLACING one is a different act: it is
    // what a reset does, so it costs the same authority a reset costs.
    // Without this, `pin.set.v1` overwrites any PIN for anyone who asks.
    if (this.hasPin(profile)) {
      this.requireOwnerGrant(
        `Replacing the PIN of profile="${profile || '-'}"`,
      );
    }

    await this.upsert(profile, data.pin_code);
    return buildPinAck('PIN was successfully set', data.pin_code);
  }

  private async change(data: PinEventData): Promise<PinAck> {
    const step = data.step ?? 'confirm_change';

    if (step === 'verify_current') {
      const verifyPin = data.current_pin_code || data.pin_code;

      if (!verifyPin) {
        throw new BadRequestException('Current PIN is required');
      }

      return this.verify({ pin_code: verifyPin, profile: data.profile });
    }

    // Disabling is a change to no PIN at all: the caller knows the current
    // code and wants protection off. It rides on the change event rather than
    // a new type, because a new type would have to be invented in the shared
    // cloud-events list, where the real backend has no such thing.
    if (step === 'disable') {
      // `current_pin_code` is optional on purpose. The client gates this
      // behind a verify-pin action whose Cancel stops the action chain, so a
      // disable event only ever reaches us once the PIN was entered. When the
      // code is sent anyway — from curl, or a client that does not gate — it
      // is still checked, so the lax path is never the only path.
      if (data.current_pin_code) {
        await this.verify({
          pin_code: data.current_pin_code,
          profile: data.profile,
        });
      }

      await this.remove(profileKey(data));

      return buildPinAck('PIN was successfully disabled', 'pin_disabled');
    }

    if (step !== 'confirm_change') {
      throw new BadRequestException(`Unsupported change PIN step: ${step}`);
    }

    if (!data.current_pin_code || !data.pin_code) {
      throw new BadRequestException('Current PIN and new PIN are required');
    }

    await this.verify({
      pin_code: data.current_pin_code,
      profile: data.profile,
    });
    await this.upsert(profileKey(data), data.pin_code);

    return buildPinAck('PIN was successfully changed', data.pin_code);
  }

  /**
   * The account owner giving a profile a new PIN without knowing the old one.
   *
   * This is parental authority, so it needs the owner's window open — and
   * that is the whole difference between this and the profile's own actions.
   * The target may be any profile, child or adult: the requirements limit who
   * authorises a reset, not who can be reset.
   *
   * With no `pin_code` the profile lands on {@link RESET_PIN}, standing in for
   * the code the user would pick from the email. An explicit one is honoured,
   * which keeps the shape the real backend uses reachable from curl.
   */
  private async reset(data: PinEventData): Promise<PinAck> {
    const step = data.step ?? 'set_new_pin';

    if (step !== 'set_new_pin') {
      throw new BadRequestException(`Unsupported reset PIN step: ${step}`);
    }

    const profile = profileKey(data);
    this.requireOwnerGrant(`Resetting the PIN of profile="${profile || '-'}"`);

    const pinCode = data.pin_code || RESET_PIN;
    await this.upsert(profile, pinCode);

    this.logger.log(
      `PIN reset for profile="${
        profile || '-'
      }" — an email inviting a new code would go out; the mock set "${pinCode}"`,
    );

    return buildPinAck('PIN was successfully reset', pinCode);
  }

  /**
   * "Forgot PIN" — the account is emailed a way back in.
   *
   * Needs no authorisation on purpose: not knowing the code is the entire
   * premise. In the real flow that is safe because the email reaches the
   * account owner and nobody else. The mock has no mail server, so it jumps
   * straight to the end state and sets {@link RESET_PIN} — which does mean
   * that here, unlike in the real product, anyone holding the device can put
   * a known code on a profile.
   */
  private async recover(data: PinEventData): Promise<PinAck> {
    const profile = profileKey(data);
    await this.upsert(profile, RESET_PIN);

    this.logger.log(
      `PIN recovery for profile="${
        profile || '-'
      }" — an email inviting a new code would go out; the mock set "${RESET_PIN}"`,
    );

    return buildPinAck(
      'Pin Code Recovery Requested',
      'pin_code_recovery_requested',
    );
  }

  private find(profile: string): PinRecord | undefined {
    return this.pins.find((record) => String(record.profile ?? '') === profile);
  }

  private async upsert(profile: string, pinCode: string): Promise<void> {
    const updatedAt = new Date().toISOString();
    const existing = this.find(profile);

    if (existing) {
      existing.pinCode = pinCode;
      existing.updatedAt = updatedAt;
    } else {
      this.pins.push({ profile, pinCode, updatedAt });
    }

    await this.persistence.savePins(this.pins);
    this.logger.log(
      `PIN stored for profile="${profile || '-'}" pin="${pinCode}"`,
    );
  }

  private async remove(profile: string): Promise<void> {
    this.pins = this.pins.filter(
      (record) => String(record.profile ?? '') !== profile,
    );
    await this.persistence.savePins(this.pins);
  }
}
