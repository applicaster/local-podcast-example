import * as fs from 'fs/promises';

/**
 * The module is mocked rather than spied on: `fs/promises` exports are
 * non-configurable under some builds, and `jest.spyOn` then fails outright
 * with "Cannot redefine property". A mock behaves the same everywhere.
 */
jest.mock('fs/promises', () => ({
  ...jest.requireActual('fs/promises'),
  readFile: jest.fn(),
}));

const readFile = fs.readFile as unknown as jest.Mock;
import { PinPersistenceService } from './pin.persistence.service';
import { PinRecord } from './pin.types';

describe('PinPersistenceService', () => {
  const configWith = (config: Record<string, unknown>) =>
    ({
      get: jest.fn((key: string) => {
        const suffix = key.replace('@lib/mock-podcast.config.', '');
        return config[suffix];
      }),
    }) as any;

  const record: PinRecord = {
    profile: '12345',
    pinCode: '1234',
    updatedAt: '2026-09-09T00:00:00.000Z',
  };

  it('returns an empty list when persistence is disabled', async () => {
    const service = new PinPersistenceService(
      configWith({ skipPersistence: true, persistenceBackend: 'file' }),
    );

    await expect(service.loadPins()).resolves.toEqual([]);
  });

  it('does not write when persistence is disabled', async () => {
    const service = new PinPersistenceService(
      configWith({ skipPersistence: true, persistenceBackend: 'file' }),
    );
    const writeSpy = jest
      .spyOn(service as any, 'savePinsToFile')
      .mockResolvedValue(undefined);

    await service.savePins([record]);

    expect(writeSpy).not.toHaveBeenCalled();
  });

  it('falls back to file storage when the backend is file', async () => {
    const service = new PinPersistenceService(
      configWith({ skipPersistence: false, persistenceBackend: 'file' }),
    );
    const writeSpy = jest
      .spyOn(service as any, 'savePinsToFile')
      .mockResolvedValue(undefined);

    await service.savePins([record]);

    expect(writeSpy).toHaveBeenCalledWith([record]);
  });

  describe('loading a malformed pins file', () => {
    const fileService = () =>
      new PinPersistenceService(
        configWith({ skipPersistence: false, persistenceBackend: 'file' }),
      );

    afterEach(() => {
      readFile.mockReset();
    });

    it('falls back to empty state when the file holds an object', async () => {
      readFile.mockResolvedValue('{"userKey":"a","pinCode":"1234"}');

      await expect(fileService().loadPins()).resolves.toEqual([]);
    });

    it('falls back to empty state when the file holds a bare string', async () => {
      readFile.mockResolvedValue('"1234"');

      await expect(fileService().loadPins()).resolves.toEqual([]);
    });

    it('still loads a well-formed array', async () => {
      readFile.mockResolvedValue(JSON.stringify([record]));

      await expect(fileService().loadPins()).resolves.toEqual([record]);
    });
  });
});
