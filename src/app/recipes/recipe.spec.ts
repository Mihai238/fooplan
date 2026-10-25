import { servingsMessage } from './recipe';

describe('servingsMessage', () => {
  it('reads servings.one for 1 and servings.other with the number for any other number', () => {
    expect(servingsMessage(1)).toEqual({ id: 'servings.one', params: { servings: 1 } });
    expect(servingsMessage(2)).toEqual({ id: 'servings.other', params: { servings: 2 } });
    expect(servingsMessage(12)).toEqual({ id: 'servings.other', params: { servings: 12 } });
  });
});
