import { servingsText } from './recipe';

describe('servingsText', () => {
  it('reads "1 serving" for 1 and "<N> servings" for any other number', () => {
    expect(servingsText(1)).toBe('1 serving');
    expect(servingsText(2)).toBe('2 servings');
    expect(servingsText(12)).toBe('12 servings');
  });
});
