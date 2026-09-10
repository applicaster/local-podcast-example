import { CloudEventsController } from './cloud-events.controller';

describe('CloudEventsController', () => {
  it('answers a successful POST with 200, matching the real backend', () => {
    // libs/brightcove's beacon controller replies res.status(200) on success.
    // Nest would default a @Post() to 201, so the mock pins it explicitly.
    const httpCode = Reflect.getMetadata(
      '__httpCode__',
      CloudEventsController.prototype.handleCloudEvent,
    );

    expect(httpCode).toBe(200);
  });
});
