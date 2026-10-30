import { TestBed } from '@angular/core/testing';
import { SUPABASE } from './app/auth/supabase';

describe('test providers', () => {
  it('give every spec a fake Supabase client, never one that reaches the local stack', () => {
    const client = TestBed.inject(SUPABASE) as unknown as Record<string, unknown>;
    expect(client['supabaseUrl']).toBeUndefined();
  });
});
