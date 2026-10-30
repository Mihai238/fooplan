import { Provider } from '@angular/core';
import {
  AuthChangeEvent,
  AuthError,
  AuthOtpResponse,
  Session,
  SignInWithPasswordlessCredentials,
  SignOut,
  SupabaseClient,
} from '@supabase/supabase-js';
import { SUPABASE } from './supabase';

type Listener = (event: AuthChangeEvent, session: Session | null) => void;

export const LINK_SENT: AuthOtpResponse = { data: { user: null, session: null }, error: null };
export const LINK_FAILED: AuthOtpResponse = {
  data: { user: null, session: null },
  error: new AuthError('Email rate limit exceeded', 429),
};
export const SIGN_OUT_FAILED = { error: new AuthError('Failed to fetch') };

// Stands in for the Supabase client, so specs never reach a server. Like the real client, a new
// subscriber gets INITIAL_SESSION once the saved session has been read (load()), and none before
export class FakeSupabase {
  readonly sent: SignInWithPasswordlessCredentials[] = [];
  readonly signOuts: (SignOut | undefined)[] = [];
  sendLink: () => Promise<AuthOtpResponse> = () => Promise.resolve(LINK_SENT);
  signOutResult: () => Promise<{ error: AuthError | null }> = () =>
    Promise.resolve({ error: null });
  // The real client sends SIGNED_OUT before signOut() returns; false lets a test see the store
  // without it
  signOutEmits = true;
  private session: Session | null | undefined = undefined;
  private readonly listeners = new Set<Listener>();

  readonly client = {
    auth: {
      onAuthStateChange: (listener: Listener) => {
        this.listeners.add(listener);
        if (this.session !== undefined) {
          listener('INITIAL_SESSION', this.session);
        }
        return {
          data: { subscription: { unsubscribe: () => this.listeners.delete(listener) } },
        };
      },
      signInWithOtp: (credentials: SignInWithPasswordlessCredentials) => {
        this.sent.push(credentials);
        return this.sendLink();
      },
      signOut: async (options?: SignOut) => {
        this.signOuts.push(options);
        const result = await this.signOutResult();
        if (!result.error && this.signOutEmits) {
          this.emit('SIGNED_OUT', null);
        }
        return result;
      },
    },
  } as unknown as SupabaseClient;

  load(session: Session | null): void {
    this.emit('INITIAL_SESSION', session);
  }

  emit(event: AuthChangeEvent, session: Session | null): void {
    this.session = session;
    this.listeners.forEach((listener) => listener(event, session));
  }
}

export function provideSupabase(fake: FakeSupabase): Provider {
  return { provide: SUPABASE, useValue: fake.client };
}

export function sessionFor(email: string, accessToken = 'access-token'): Session {
  return {
    access_token: accessToken,
    refresh_token: 'refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: 'user-1',
      email,
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '2026-10-30T00:00:00Z',
    },
  };
}

export function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}
