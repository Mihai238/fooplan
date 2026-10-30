import { Provider } from '@angular/core';
import { SUPABASE } from './app/auth/supabase';
import { FakeSupabase } from './app/auth/testing';

// The root factory would create a real client, which talks to the local stack; a spec that doesn't
// provide its own fake gets one that never returns a session
export default [
  { provide: SUPABASE, useFactory: () => new FakeSupabase().client },
] satisfies Provider[];
