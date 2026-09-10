import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PinService, RESET_PIN } from './pin.service';
import { PinGrantService } from './pin.grant.service';
import { CLOUD_EVENT_TYPES } from '../../constants/cloud-event-types.constants';

const OWNER = 'owner-profile';

/**
 * The grant service is real rather than mocked: it is the thing under test
 * whenever authority matters, and its only input is the clock.
 */
let grants: PinGrantService;

const buildService = (
  persistence: unknown,
  ownerId: string = OWNER,
): PinService => {
  grants = new PinGrantService();

  return new PinService(persistence as any, grants, {
    ownerId: () => ownerId,
  } as any);
};

describe('PinService', () => {
  const persistence = {
    loadPins: jest.fn(async () => []),
    savePins: jest.fn(async () => undefined),
  };

  let service: PinService;

  beforeEach(async () => {
    jest.clearAllMocks();
    service = buildService(persistence);
    await service.onModuleInit();
  });

  const call = (type: string, data: Record<string, unknown> = {}) =>
    service.handlePinEvent(type, data);

  describe('set', () => {
    it('stores the pin and acknowledges', async () => {
      const ack = await call(CLOUD_EVENT_TYPES.PIN_CODE_SET, {
        pin_code: '1234',
      });

      expect(ack.type).toBe(CLOUD_EVENT_TYPES.EVENT_RECEIVED);
      expect(ack.subject).toBe('PIN was successfully set');
      expect(persistence.savePins).toHaveBeenCalledWith([
        expect.objectContaining({ profile: '', pinCode: '1234' }),
      ]);
    });

    it('rejects a missing pin', async () => {
      await expect(call(CLOUD_EVENT_TYPES.PIN_CODE_SET)).rejects.toThrow(
        new BadRequestException('PIN is required'),
      );
    });

    // Overwriting used to be silent. It now costs the owner's authority —
    // see "replacing an existing pin with set" below.
    it('stores a first pin for a profile that has none', async () => {
      await call(CLOUD_EVENT_TYPES.PIN_CODE_SET, {
        profile: 'fresh',
        pin_code: '2222',
      });

      const ack = await call(CLOUD_EVENT_TYPES.PIN_CODE, {
        profile: 'fresh',
        pin_code: '2222',
      });
      expect(ack.subject).toBe('Valid Pin Code');
    });
  });

  describe('verify', () => {
    it('rejects when no pin is set', async () => {
      await expect(
        call(CLOUD_EVENT_TYPES.PIN_CODE, { pin_code: '1234' }),
      ).rejects.toThrow(new BadRequestException('PIN is not set'));
    });

    it('rejects a wrong pin', async () => {
      await call(CLOUD_EVENT_TYPES.PIN_CODE_SET, { pin_code: '1234' });

      await expect(
        call(CLOUD_EVENT_TYPES.PIN_CODE, { pin_code: '9999' }),
      ).rejects.toThrow(new BadRequestException('Invalid pin code'));
    });

    it('accepts the correct pin', async () => {
      await call(CLOUD_EVENT_TYPES.PIN_CODE_SET, { pin_code: '1234' });

      const ack = await call(CLOUD_EVENT_TYPES.PIN_CODE, { pin_code: '1234' });
      expect(ack.subject).toBe('Valid Pin Code');
      expect(ack.id).toBe('1234');
    });

    it('keeps pins separate per profile', async () => {
      await call(CLOUD_EVENT_TYPES.PIN_CODE_SET, {
        profile: 111,
        pin_code: '1234',
      });

      await expect(
        call(CLOUD_EVENT_TYPES.PIN_CODE, { profile: 222, pin_code: '1234' }),
      ).rejects.toThrow(new BadRequestException('PIN is not set'));
    });
  });

  describe('change', () => {
    beforeEach(async () => {
      await call(CLOUD_EVENT_TYPES.PIN_CODE_SET, { pin_code: '1234' });
    });

    it('verifies the current pin on the verify_current step', async () => {
      const ack = await call(CLOUD_EVENT_TYPES.PIN_CODE_CHANGE, {
        step: 'verify_current',
        current_pin_code: '1234',
      });

      expect(ack.subject).toBe('Valid Pin Code');
    });

    it('falls back to pin_code on the verify_current step', async () => {
      const ack = await call(CLOUD_EVENT_TYPES.PIN_CODE_CHANGE, {
        step: 'verify_current',
        pin_code: '1234',
      });

      expect(ack.subject).toBe('Valid Pin Code');
    });

    it('requires a code on the verify_current step', async () => {
      await expect(
        call(CLOUD_EVENT_TYPES.PIN_CODE_CHANGE, { step: 'verify_current' }),
      ).rejects.toThrow(new BadRequestException('Current PIN is required'));
    });

    it('changes the pin on the default step', async () => {
      const ack = await call(CLOUD_EVENT_TYPES.PIN_CODE_CHANGE, {
        current_pin_code: '1234',
        pin_code: '5678',
      });

      expect(ack.subject).toBe('PIN was successfully changed');

      const verified = await call(CLOUD_EVENT_TYPES.PIN_CODE, {
        pin_code: '5678',
      });
      expect(verified.subject).toBe('Valid Pin Code');
    });

    it('rejects a wrong current pin', async () => {
      await expect(
        call(CLOUD_EVENT_TYPES.PIN_CODE_CHANGE, {
          current_pin_code: '0000',
          pin_code: '5678',
        }),
      ).rejects.toThrow(new BadRequestException('Invalid pin code'));
    });

    it('requires both codes on the confirm_change step', async () => {
      await expect(
        call(CLOUD_EVENT_TYPES.PIN_CODE_CHANGE, { pin_code: '5678' }),
      ).rejects.toThrow(
        new BadRequestException('Current PIN and new PIN are required'),
      );
    });

    it('rejects an unknown step', async () => {
      await expect(
        call(CLOUD_EVENT_TYPES.PIN_CODE_CHANGE, { step: 'nope' }),
      ).rejects.toThrow(
        new BadRequestException('Unsupported change PIN step: nope'),
      );
    });
  });

  it('rejects an unknown event type', async () => {
    await expect(call('com.applicaster.unknown.v1')).rejects.toThrow(
      new BadRequestException(
        'Unsupported PIN event: com.applicaster.unknown.v1',
      ),
    );
  });

  describe('recovery — "forgot PIN"', () => {
    beforeEach(async () => {
      await call(CLOUD_EVENT_TYPES.PIN_CODE_SET, { pin_code: '1234' });
    });

    // The real flow emails the account and the user picks a code. There is no
    // mail server here, so the mock jumps to the end state.
    it('puts the profile on the known reset code', async () => {
      const ack = await call(CLOUD_EVENT_TYPES.PIN_CODE_RECOVERY_REQUESTED);

      expect(ack.subject).toBe('Pin Code Recovery Requested');
      expect(ack.id).toBe('pin_code_recovery_requested');

      const verified = await call(CLOUD_EVENT_TYPES.PIN_CODE, {
        pin_code: RESET_PIN,
      });
      expect(verified.subject).toBe('Valid Pin Code');
    });

    it('leaves the old code no longer working', async () => {
      await call(CLOUD_EVENT_TYPES.PIN_CODE_RECOVERY_REQUESTED);

      await expect(
        call(CLOUD_EVENT_TYPES.PIN_CODE, { pin_code: '1234' }),
      ).rejects.toThrow(new BadRequestException('Invalid pin code'));
    });

    // Not knowing the code is the premise, so this path cannot ask for one.
    it('needs no owner grant', async () => {
      const ack = await call(CLOUD_EVENT_TYPES.PIN_CODE_RECOVERY_REQUESTED);

      expect(ack.subject).toBe('Pin Code Recovery Requested');
    });

    it('works for a profile that had no pin at all', async () => {
      await call(CLOUD_EVENT_TYPES.PIN_CODE_RECOVERY_REQUESTED, {
        profile: 404,
      });

      const verified = await call(CLOUD_EVENT_TYPES.PIN_CODE, {
        profile: 404,
        pin_code: RESET_PIN,
      });
      expect(verified.subject).toBe('Valid Pin Code');
    });

    it('touches no other profile', async () => {
      await call(CLOUD_EVENT_TYPES.PIN_CODE_SET, {
        profile: 777,
        pin_code: '9999',
      });

      await call(CLOUD_EVENT_TYPES.PIN_CODE_RECOVERY_REQUESTED);

      const ack = await call(CLOUD_EVENT_TYPES.PIN_CODE, {
        profile: 777,
        pin_code: '9999',
      });
      expect(ack.subject).toBe('Valid Pin Code');
    });
  });

  describe('reset — the owner giving a profile a new pin', () => {
    beforeEach(async () => {
      await call(CLOUD_EVENT_TYPES.PIN_CODE_SET, { pin_code: '1234' });
      // The owner must hold a PIN for its authority to mean anything — see
      // "when the owner has no pin of their own" below.
      await call(CLOUD_EVENT_TYPES.PIN_CODE_SET, {
        profile: OWNER,
        pin_code: '0000',
      });
    });

    const openWindow = () => grants.issue(OWNER);

    it('refuses without an owner grant', async () => {
      await expect(call(CLOUD_EVENT_TYPES.PIN_CODE_RESET)).rejects.toThrow(
        new ForbiddenException(
          'Account owner authorization is required for this action',
        ),
      );

      const untouched = await call(CLOUD_EVENT_TYPES.PIN_CODE, {
        pin_code: '1234',
      });
      expect(untouched.subject).toBe('Valid Pin Code');
    });

    it('puts the profile on the known reset code once authorised', async () => {
      openWindow();

      const ack = await call(CLOUD_EVENT_TYPES.PIN_CODE_RESET);

      expect(ack.subject).toBe('PIN was successfully reset');

      const verified = await call(CLOUD_EVENT_TYPES.PIN_CODE, {
        pin_code: RESET_PIN,
      });
      expect(verified.subject).toBe('Valid Pin Code');
    });

    // The shape the real backend uses stays reachable, even though no feed
    // sends it: an explicit code wins over the mock's stand-in.
    it('honours an explicit new pin', async () => {
      openWindow();

      await call(CLOUD_EVENT_TYPES.PIN_CODE_RESET, {
        step: 'set_new_pin',
        pin_code: '4321',
      });

      const verified = await call(CLOUD_EVENT_TYPES.PIN_CODE, {
        pin_code: '4321',
      });
      expect(verified.subject).toBe('Valid Pin Code');
    });

    it('resets a profile that never had a pin', async () => {
      openWindow();

      await call(CLOUD_EVENT_TYPES.PIN_CODE_RESET, { profile: 555 });

      const verified = await call(CLOUD_EVENT_TYPES.PIN_CODE, {
        profile: 555,
        pin_code: RESET_PIN,
      });
      expect(verified.subject).toBe('Valid Pin Code');
    });

    // 'initiate' used to clear the pin. It is gone rather than silent, so a
    // client still sending it fails loudly instead of appearing to work.
    it('rejects the step that used to clear the pin', async () => {
      openWindow();

      await expect(
        call(CLOUD_EVENT_TYPES.PIN_CODE_RESET, { step: 'initiate' }),
      ).rejects.toThrow(
        new BadRequestException('Unsupported reset PIN step: initiate'),
      );
    });

    it('rejects an unknown reset step', async () => {
      openWindow();

      await expect(
        call(CLOUD_EVENT_TYPES.PIN_CODE_RESET, { step: 'nope' }),
      ).rejects.toThrow(
        new BadRequestException('Unsupported reset PIN step: nope'),
      );
    });
  });

  describe('the management grant', () => {
    beforeEach(async () => {
      await call(CLOUD_EVENT_TYPES.PIN_CODE_SET, {
        profile: OWNER,
        pin_code: '1234',
      });
    });

    const verifyOwner = (data: Record<string, unknown> = {}) =>
      call(CLOUD_EVENT_TYPES.PIN_CODE, {
        profile: OWNER,
        pin_code: '1234',
        ...data,
      });

    it('opens on a verify that says it is managing', async () => {
      await verifyOwner({ purpose: 'manage' });

      expect(grants.has(OWNER)).toBe(true);
    });

    // Entering a profile and proving parental authority are the same event.
    // Without the marker, unlocking your own profile would grant the right to
    // rewrite everyone else's PIN.
    it('stays shut when the owner merely enters their profile', async () => {
      await verifyOwner();

      expect(grants.has(OWNER)).toBe(false);
    });

    it('stays shut for a profile that is not the owner', async () => {
      await call(CLOUD_EVENT_TYPES.PIN_CODE_SET, {
        profile: 'someone-else',
        pin_code: '5555',
      });

      await call(CLOUD_EVENT_TYPES.PIN_CODE, {
        profile: 'someone-else',
        pin_code: '5555',
        purpose: 'manage',
      });

      expect(grants.has('someone-else')).toBe(false);
      expect(grants.has(OWNER)).toBe(false);
    });

    it('stays shut when the pin was wrong', async () => {
      await expect(
        verifyOwner({ pin_code: '0000', purpose: 'manage' }),
      ).rejects.toThrow(new BadRequestException('Invalid pin code'));

      expect(grants.has(OWNER)).toBe(false);
    });
  });

  describe('replacing an existing pin with set', () => {
    beforeEach(async () => {
      await call(CLOUD_EVENT_TYPES.PIN_CODE_SET, {
        profile: 111,
        pin_code: '1234',
      });
      await call(CLOUD_EVENT_TYPES.PIN_CODE_SET, {
        profile: OWNER,
        pin_code: '0000',
      });
    });

    // Setting a first PIN is open; replacing one is what a reset does, and
    // costs the same authority. Otherwise pin.set.v1 overwrites anyone's PIN.
    it('refuses without an owner grant', async () => {
      await expect(
        call(CLOUD_EVENT_TYPES.PIN_CODE_SET, {
          profile: 111,
          pin_code: '0000',
        }),
      ).rejects.toThrow(
        new ForbiddenException(
          'Account owner authorization is required for this action',
        ),
      );

      const untouched = await call(CLOUD_EVENT_TYPES.PIN_CODE, {
        profile: 111,
        pin_code: '1234',
      });
      expect(untouched.subject).toBe('Valid Pin Code');
    });

    it('allows it once the owner window is open', async () => {
      grants.issue(OWNER);

      const ack = await call(CLOUD_EVENT_TYPES.PIN_CODE_SET, {
        profile: 111,
        pin_code: '0000',
      });

      expect(ack.subject).toBe('PIN was successfully set');
    });

    it('leaves a first pin open to anyone', async () => {
      const ack = await call(CLOUD_EVENT_TYPES.PIN_CODE_SET, {
        profile: 222,
        pin_code: '0000',
      });

      expect(ack.subject).toBe('PIN was successfully set');
    });
  });

  // The owner PIN is optional while theirs is the only profile, so an owner
  // without one is a legitimate state — and a check that cannot be satisfied
  // is not a check, it just makes reset impossible for everybody.
  describe('when the owner has no pin of their own', () => {
    beforeEach(async () => {
      await call(CLOUD_EVENT_TYPES.PIN_CODE_SET, {
        profile: 111,
        pin_code: '1234',
      });
    });

    it('lets a reset through without a grant', async () => {
      const ack = await call(CLOUD_EVENT_TYPES.PIN_CODE_RESET, {
        profile: 111,
      });

      expect(ack.subject).toBe('PIN was successfully reset');
    });

    it('lets an overwrite through without a grant', async () => {
      const ack = await call(CLOUD_EVENT_TYPES.PIN_CODE_SET, {
        profile: 111,
        pin_code: '0000',
      });

      expect(ack.subject).toBe('PIN was successfully set');
    });

    it('says so in the log rather than passing silently', async () => {
      const warn = jest
        .spyOn((service as any).logger, 'warn')
        .mockImplementation(() => undefined);

      await call(CLOUD_EVENT_TYPES.PIN_CODE_RESET, { profile: 111 });

      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('has no PIN to prove'),
      );
    });

    // Nobody carrying master is different from an owner without a PIN: there
    // is no authority to drop, so the refusal stands.
    it('still refuses when the fixture names no owner at all', async () => {
      const ownerless = buildService(persistence, '');
      await ownerless.onModuleInit();
      await ownerless.handlePinEvent(CLOUD_EVENT_TYPES.PIN_CODE_SET, {
        profile: 111,
        pin_code: '1234',
      });

      await expect(
        ownerless.handlePinEvent(CLOUD_EVENT_TYPES.PIN_CODE_RESET, {
          profile: 111,
        }),
      ).rejects.toThrow(
        new ForbiddenException(
          'Account owner authorization is required for this action',
        ),
      );
    });
  });

  describe('logging', () => {
    it('logs the incoming event and the successful outcome', async () => {
      const log = jest
        .spyOn((service as any).logger, 'log')
        .mockImplementation(() => undefined);

      await call(CLOUD_EVENT_TYPES.PIN_CODE_SET, { pin_code: '1234' });

      const lines = log.mock.calls.map((args) => String(args[0]));
      expect(lines.some((line) => line.includes('PIN event received'))).toBe(
        true,
      );
      expect(lines.some((line) => line.includes('PIN event ok'))).toBe(true);
    });

    it('logs a warning with the reason when an event fails', async () => {
      const warn = jest
        .spyOn((service as any).logger, 'warn')
        .mockImplementation(() => undefined);

      await expect(
        call(CLOUD_EVENT_TYPES.PIN_CODE, { pin_code: '1234' }),
      ).rejects.toThrow('PIN is not set');

      const lines = warn.mock.calls.map((args) => String(args[0]));
      expect(lines.some((line) => line.includes('PIN is not set'))).toBe(true);
    });

    it('still returns the ack unchanged while logging', async () => {
      const ack = await call(CLOUD_EVENT_TYPES.PIN_CODE_SET, {
        pin_code: '1234',
      });

      expect(ack.subject).toBe('PIN was successfully set');
    });

    it('logs the request payload it received', async () => {
      const log = jest
        .spyOn((service as any).logger, 'log')
        .mockImplementation(() => undefined);

      await call(CLOUD_EVENT_TYPES.PIN_CODE_SET, { pin_code: '1234' });

      const received = log.mock.calls
        .map((args) => String(args[0]))
        .find((line) => line.includes('PIN event received'));

      expect(received).toContain('request={"pin_code":"1234"}');
    });

    it('logs the full response body it returns on success', async () => {
      const log = jest
        .spyOn((service as any).logger, 'log')
        .mockImplementation(() => undefined);

      const ack = await call(CLOUD_EVENT_TYPES.PIN_CODE_SET, {
        pin_code: '1234',
      });

      const okLine = log.mock.calls
        .map((args) => String(args[0]))
        .find((line) => line.includes('PIN event ok'));

      expect(okLine).toContain('status=200');
      expect(okLine).toContain(`response=${JSON.stringify(ack)}`);
    });

    it('logs the status and response body it returns on failure', async () => {
      const warn = jest
        .spyOn((service as any).logger, 'warn')
        .mockImplementation(() => undefined);

      await expect(
        call(CLOUD_EVENT_TYPES.PIN_CODE, { pin_code: '1234' }),
      ).rejects.toThrow('PIN is not set');

      const failLine = warn.mock.calls
        .map((args) => String(args[0]))
        .find((line) => line.includes('PIN event failed'));

      expect(failLine).toContain('status=400');
      expect(failLine).toContain('PIN is not set');
      expect(failLine).toContain('Bad Request');
    });
  });
});

describe('PinService profile scoping', () => {
  const persistence = {
    loadPins: jest.fn(async () => []),
    savePins: jest.fn(async () => undefined),
  };

  let service: PinService;

  beforeEach(async () => {
    jest.clearAllMocks();
    service = buildService(persistence);
    await service.onModuleInit();
  });

  const call = (type: string, data: Record<string, unknown> = {}) =>
    service.handlePinEvent(type, data);

  it('keeps a separate pin per profile of the same user', async () => {
    await call(CLOUD_EVENT_TYPES.PIN_CODE_SET, {
      profile: 111,
      pin_code: '1111',
    });
    await call(CLOUD_EVENT_TYPES.PIN_CODE_SET, {
      profile: 222,
      pin_code: '2222',
    });

    const first = await call(CLOUD_EVENT_TYPES.PIN_CODE, {
      profile: 111,
      pin_code: '1111',
    });
    expect(first.subject).toBe('Valid Pin Code');

    const second = await call(CLOUD_EVENT_TYPES.PIN_CODE, {
      profile: 222,
      pin_code: '2222',
    });
    expect(second.subject).toBe('Valid Pin Code');
  });

  it("does not let one profile's pin open another", async () => {
    await call(CLOUD_EVENT_TYPES.PIN_CODE_SET, {
      profile: 111,
      pin_code: '1111',
    });

    await expect(
      call(CLOUD_EVENT_TYPES.PIN_CODE, { profile: 222, pin_code: '1111' }),
    ).rejects.toThrow(new BadRequestException('PIN is not set'));
  });

  it('treats a numeric and a string profile id as the same profile', async () => {
    await call(CLOUD_EVENT_TYPES.PIN_CODE_SET, {
      profile: 12345,
      pin_code: '1111',
    });

    const ack = await call(CLOUD_EVENT_TYPES.PIN_CODE, {
      profile: '12345',
      pin_code: '1111',
    });
    expect(ack.subject).toBe('Valid Pin Code');
  });

  it('keeps the profile-less pin separate from a profile pin', async () => {
    await call(CLOUD_EVENT_TYPES.PIN_CODE_SET, { pin_code: '9999' });

    await expect(
      call(CLOUD_EVENT_TYPES.PIN_CODE, { profile: 111, pin_code: '9999' }),
    ).rejects.toThrow(new BadRequestException('PIN is not set'));

    const ack = await call(CLOUD_EVENT_TYPES.PIN_CODE, { pin_code: '9999' });
    expect(ack.subject).toBe('Valid Pin Code');
  });

  it('recovers the requesting profile, not another one', async () => {
    await call(CLOUD_EVENT_TYPES.PIN_CODE_SET, {
      profile: 111,
      pin_code: '1111',
    });
    await call(CLOUD_EVENT_TYPES.PIN_CODE_SET, {
      profile: 222,
      pin_code: '2222',
    });

    await call(CLOUD_EVENT_TYPES.PIN_CODE_RECOVERY_REQUESTED, {
      profile: 111,
    });

    const recovered = await call(CLOUD_EVENT_TYPES.PIN_CODE, {
      profile: 111,
      pin_code: RESET_PIN,
    });
    expect(recovered.subject).toBe('Valid Pin Code');

    const untouched = await call(CLOUD_EVENT_TYPES.PIN_CODE, {
      profile: 222,
      pin_code: '2222',
    });
    expect(untouched.subject).toBe('Valid Pin Code');
  });

  it('changes the pin of the addressed profile only', async () => {
    await call(CLOUD_EVENT_TYPES.PIN_CODE_SET, {
      profile: 111,
      pin_code: '1111',
    });
    await call(CLOUD_EVENT_TYPES.PIN_CODE_SET, {
      profile: 222,
      pin_code: '2222',
    });

    await call(CLOUD_EVENT_TYPES.PIN_CODE_CHANGE, {
      profile: 111,
      current_pin_code: '1111',
      pin_code: '5555',
    });

    const changed = await call(CLOUD_EVENT_TYPES.PIN_CODE, {
      profile: 111,
      pin_code: '5555',
    });
    expect(changed.subject).toBe('Valid Pin Code');

    const untouched = await call(CLOUD_EVENT_TYPES.PIN_CODE, {
      profile: 222,
      pin_code: '2222',
    });
    expect(untouched.subject).toBe('Valid Pin Code');
  });
});

describe('PinService master profile managing another profile', () => {
  const persistence = {
    loadPins: jest.fn(async () => []),
    savePins: jest.fn(async () => undefined),
  };

  let service: PinService;

  beforeEach(async () => {
    jest.clearAllMocks();
    service = buildService(persistence);
    await service.onModuleInit();
  });

  const call = (type: string, data: Record<string, unknown> = {}) =>
    service.handlePinEvent(type, data);

  // The profile in the payload says WHOSE pin is being touched, not who is
  // asking. A master profile manages a child's pin by naming the child, so
  // there is deliberately no ownership check to satisfy.
  it('sets a pin for the named profile whoever sends the event', async () => {
    await call(CLOUD_EVENT_TYPES.PIN_CODE_SET, {
      profile: 999,
      pin_code: '4321',
    });

    expect(persistence.savePins).toHaveBeenCalledWith([
      expect.objectContaining({ profile: '999', pinCode: '4321' }),
    ]);

    const ack = await call(CLOUD_EVENT_TYPES.PIN_CODE, {
      profile: 999,
      pin_code: '4321',
    });
    expect(ack.subject).toBe('Valid Pin Code');
  });

  it('changes a child pin from the master flow', async () => {
    await call(CLOUD_EVENT_TYPES.PIN_CODE_SET, {
      profile: 999,
      pin_code: '4321',
    });

    const ack = await call(CLOUD_EVENT_TYPES.PIN_CODE_CHANGE, {
      profile: 999,
      current_pin_code: '4321',
      pin_code: '8765',
    });
    expect(ack.subject).toBe('PIN was successfully changed');

    const verified = await call(CLOUD_EVENT_TYPES.PIN_CODE, {
      profile: 999,
      pin_code: '8765',
    });
    expect(verified.subject).toBe('Valid Pin Code');
  });

  it('does not depend on who calls - the same payload always hits the same record', async () => {
    await call(CLOUD_EVENT_TYPES.PIN_CODE_SET, {
      profile: 999,
      pin_code: '4321',
    });

    const fresh = buildService({
      loadPins: jest.fn(async () => [
        { profile: '999', pinCode: '4321', updatedAt: 'x' },
      ]),
      savePins: jest.fn(async () => undefined),
    } as any);
    await fresh.onModuleInit();

    const ack = await fresh.handlePinEvent(CLOUD_EVENT_TYPES.PIN_CODE, {
      profile: 999,
      pin_code: '4321',
    });
    expect(ack.subject).toBe('Valid Pin Code');
  });
});

describe('PinService disable', () => {
  const persistence = {
    loadPins: jest.fn(async () => []),
    savePins: jest.fn(async () => undefined),
  };

  let service: PinService;

  beforeEach(async () => {
    jest.clearAllMocks();
    service = buildService(persistence);
    await service.onModuleInit();
    await service.handlePinEvent(CLOUD_EVENT_TYPES.PIN_CODE_SET, {
      profile: 111,
      pin_code: '1111',
    });
  });

  const call = (type: string, data: Record<string, unknown> = {}) =>
    service.handlePinEvent(type, data);

  it('removes the pin once the current one checks out', async () => {
    const ack = await call(CLOUD_EVENT_TYPES.PIN_CODE_CHANGE, {
      step: 'disable',
      profile: 111,
      current_pin_code: '1111',
    });

    expect(ack.subject).toBe('PIN was successfully disabled');

    await expect(
      call(CLOUD_EVENT_TYPES.PIN_CODE, { profile: 111, pin_code: '1111' }),
    ).rejects.toThrow(new BadRequestException('PIN is not set'));
  });

  it('refuses a wrong current pin and keeps protection on', async () => {
    await expect(
      call(CLOUD_EVENT_TYPES.PIN_CODE_CHANGE, {
        step: 'disable',
        profile: 111,
        current_pin_code: '0000',
      }),
    ).rejects.toThrow(new BadRequestException('Invalid pin code'));

    const still = await call(CLOUD_EVENT_TYPES.PIN_CODE, {
      profile: 111,
      pin_code: '1111',
    });
    expect(still.subject).toBe('Valid Pin Code');
  });

  // The client gates disable behind a verify-pin action, and a cancelled
  // verify stops the action chain — so the event only arrives once the PIN
  // was entered, and it does not have to carry it.
  it('disables without a current pin when the client already verified', async () => {
    const ack = await call(CLOUD_EVENT_TYPES.PIN_CODE_CHANGE, {
      step: 'disable',
      profile: 111,
    });

    expect(ack.subject).toBe('PIN was successfully disabled');

    await expect(
      call(CLOUD_EVENT_TYPES.PIN_CODE, { profile: 111, pin_code: '1111' }),
    ).rejects.toThrow(new BadRequestException('PIN is not set'));
  });

  it('disables only the named profile', async () => {
    await call(CLOUD_EVENT_TYPES.PIN_CODE_SET, {
      profile: 222,
      pin_code: '2222',
    });

    await call(CLOUD_EVENT_TYPES.PIN_CODE_CHANGE, {
      step: 'disable',
      profile: 111,
      current_pin_code: '1111',
    });

    const survivor = await call(CLOUD_EVENT_TYPES.PIN_CODE, {
      profile: 222,
      pin_code: '2222',
    });
    expect(survivor.subject).toBe('Valid Pin Code');
  });
});

describe('PinService hasPin', () => {
  const persistence = {
    loadPins: jest.fn(async () => []),
    savePins: jest.fn(async () => undefined),
  };

  let service: PinService;

  beforeEach(async () => {
    jest.clearAllMocks();
    service = buildService(persistence);
    await service.onModuleInit();
  });

  it('reports whether a profile has a pin', async () => {
    expect(service.hasPin('111')).toBe(false);

    await service.handlePinEvent(CLOUD_EVENT_TYPES.PIN_CODE_SET, {
      profile: 111,
      pin_code: '1111',
    });

    expect(service.hasPin('111')).toBe(true);
    expect(service.hasPin('222')).toBe(false);
  });

  it('tracks the profile-less record separately', async () => {
    await service.handlePinEvent(CLOUD_EVENT_TYPES.PIN_CODE_SET, {
      pin_code: '9999',
    });

    expect(service.hasPin('')).toBe(true);
    expect(service.hasPin('111')).toBe(false);
  });
});

describe('PinService notes the app-wide PIN', () => {
  const persistence = {
    loadPins: jest.fn(async () => []),
    savePins: jest.fn(async () => undefined),
  };

  let service: PinService;

  beforeEach(async () => {
    jest.clearAllMocks();
    service = buildService(persistence);
    await service.onModuleInit();
  });

  const lines = (spy: jest.SpyInstance) =>
    spy.mock.calls.map((args) => String(args[0]));

  it('says so when an event arrives with no profile (app-wide PIN)', async () => {
    const log = jest
      .spyOn((service as any).logger, 'log')
      .mockImplementation(() => undefined);

    await service.handlePinEvent(CLOUD_EVENT_TYPES.PIN_CODE_SET, {
      pin_code: '2222',
    });

    expect(lines(log).some((line) => line.includes('carries no profile'))).toBe(
      true,
    );
  });

  it('stays quiet when the profile is there', async () => {
    const log = jest
      .spyOn((service as any).logger, 'log')
      .mockImplementation(() => undefined);

    await service.handlePinEvent(CLOUD_EVENT_TYPES.PIN_CODE_SET, {
      profile: 'a3JVE000007CgIn2AK',
      pin_code: '2222',
    });

    expect(lines(log).some((line) => line.includes('carries no profile'))).toBe(
      false,
    );
  });

  it('still stores the record, the note does not block', async () => {
    jest
      .spyOn((service as any).logger, 'log')
      .mockImplementation(() => undefined);

    const ack = await service.handlePinEvent(CLOUD_EVENT_TYPES.PIN_CODE_SET, {
      pin_code: '2222',
    });

    expect(ack.subject).toBe('PIN was successfully set');
    expect(persistence.savePins).toHaveBeenCalledWith([
      expect.objectContaining({ profile: '', pinCode: '2222' }),
    ]);
  });
});
