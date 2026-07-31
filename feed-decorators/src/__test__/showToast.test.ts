import { ActionsBuilder } from '../actions-builder';
import { validateActionPayload } from '../action-validators';
import { ShowToastActionSchema } from '../zod-definitions';

describe('showToast Action', () => {
  it('validates showToast payload with required message', () => {
    expect(validateActionPayload('showToast', { message: 'Added to queue' })).toBe(
      true,
    );
    expect(validateActionPayload('showToast', {})).toBe(false);
  });

  it('builds showToast action via ActionsBuilder', () => {
    const builder = new ActionsBuilder().showToast('Added to queue');
    const actions = builder.build();

    expect(actions).toEqual([
      {
        type: 'showToast',
        options: { message: 'Added to queue' },
      },
    ]);

    const result = ShowToastActionSchema.safeParse(actions[0]);
    expect(result.success).toBe(true);
  });

  it('builds and validates showToast action with style and timeout options', () => {
    const builder = new ActionsBuilder().showToast('Added to queue', {
      timeout: 5000,
      style: {
        backgroundColor: '#1A1A1A',
        color: '#FFFFFF',
        fontSize: 14,
      },
    });
    const actions = builder.build();

    expect(actions).toEqual([
      {
        type: 'showToast',
        options: {
          message: 'Added to queue',
          timeout: 5000,
          style: {
            backgroundColor: '#1A1A1A',
            color: '#FFFFFF',
            fontSize: 14,
          },
        },
      },
    ]);

    const result = ShowToastActionSchema.safeParse(actions[0]);
    expect(result.success).toBe(true);
  });
});
