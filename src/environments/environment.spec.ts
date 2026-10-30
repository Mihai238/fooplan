import { environment } from './environment';

describe('environment', () => {
  it('is the local Supabase stack in the tests, as for npm start, through the development fileReplacements (#43 11)', () => {
    expect(environment.supabaseUrl).toBe('http://127.0.0.1:54321');
    expect(environment.supabaseKey).toBe('sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH');
  });
});
