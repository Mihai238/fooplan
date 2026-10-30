import { isEmail } from './email';

describe('isEmail', () => {
  it('takes "ana@example.com" and refuses "", "   ", "not-an-email", "ana@", "@example.com", "ana @example.com" and " ana@example.com ", whose spaces the page trims first (#43 4a)', () => {
    expect(isEmail('ana@example.com'), 'ana@example.com').toBe(true);
    for (const value of [
      '',
      '   ',
      'not-an-email',
      'ana@',
      '@example.com',
      'ana @example.com',
      ' ana@example.com ',
    ]) {
      expect(isEmail(value), JSON.stringify(value)).toBe(false);
    }
  });
});
