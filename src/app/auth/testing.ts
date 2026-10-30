import { Provider } from '@angular/core';
import {
  AuthChangeEvent,
  AuthError,
  AuthOtpResponse,
  PostgrestError,
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
export const DATA_FAILED = new PostgrestError({
  message: 'TypeError: Failed to fetch',
  details: '',
  hint: '',
  code: '',
});

// What the server answers a request without a session: user_data grants nothing to anon
const PERMISSION_DENIED = new PostgrestError({
  message: 'permission denied for table user_data',
  details: '',
  hint: '',
  code: '42501',
});

const ABORTED = new PostgrestError({
  message: 'AbortError: signal timed out',
  details: '',
  hint: '',
  code: '',
});

const REFUSED = new PostgrestError({
  message: 'new row violates row-level security policy for table "user_data"',
  details: '',
  hint: '',
  code: '42501',
});

export interface UserDataRow {
  user_id: string;
  key: string;
  value: unknown;
  updated_at: string;
}

// Stands in for the Supabase client, so specs never reach a server. Like the real client, a new
// subscriber gets INITIAL_SESSION once the saved session has been read (load()), and none before.
// Its user_data table holds `rows` and, like the row-level security of the migration, shows and
// takes only the rows of the session's user, as the session was when the request was sent; without
// a session it refuses the request. beforeRead and beforeWrite hold a request, or fail it by
// rejecting, before the server answers
export class FakeSupabase {
  readonly tables: string[] = [];
  rows: UserDataRow[] = [];
  readError: PostgrestError | null = null;
  writeError: PostgrestError | null = null;
  beforeRead: (key: string) => Promise<void> = () => Promise.resolve();
  beforeWrite: (row: UserDataRow) => Promise<void> = () => Promise.resolve();
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
    from: (table: string) => {
      this.tables.push(table);
      return this.query();
    },
  } as unknown as SupabaseClient;

  saveRow(key: string, value: unknown, userId = 'user-1'): void {
    this.rows = [
      ...this.rows.filter((row) => row.user_id !== userId || row.key !== key),
      { user_id: userId, key, value, updated_at: '2026-10-30T00:00:00.000Z' },
    ];
  }

  row(key: string, userId = 'user-1'): UserDataRow | undefined {
    return this.rows.find((row) => row.user_id === userId && row.key === key);
  }

  load(session: Session | null): void {
    this.emit('INITIAL_SESSION', session);
  }

  emit(event: AuthChangeEvent, session: Session | null): void {
    this.session = session;
    this.listeners.forEach((listener) => listener(event, session));
  }

  // The calls ServerBackend makes: select('value').eq(...).eq(...).abortSignal(signal).maybeSingle()
  // and upsert(row).abortSignal(signal). An aborted request is answered with an error, as the real
  // client does
  private query() {
    const filters: [keyof UserDataRow, unknown][] = [];
    let signal: AbortSignal | undefined;
    const builder = {
      select: () => builder,
      eq: (column: keyof UserDataRow, value: unknown) => {
        filters.push([column, value]);
        return builder;
      },
      abortSignal: (abort: AbortSignal) => {
        signal = abort;
        return builder;
      },
      maybeSingle: () => {
        const userId = this.session?.user.id;
        const key = String(filters.find(([column]) => column === 'key')?.[1]);
        return this.answer(
          signal,
          () => this.beforeRead(key),
          () => {
            if (this.readError) {
              return { data: null, error: this.readError };
            }
            if (userId === undefined) {
              return { data: null, error: PERMISSION_DENIED };
            }
            const row = this.rows.find(
              (candidate) =>
                candidate.user_id === userId &&
                filters.every(([column, value]) => candidate[column] === value),
            );
            return { data: row ? { value: structuredClone(row.value) } : null, error: null };
          },
        );
      },
      upsert: (row: UserDataRow) => {
        const userId = this.session?.user.id;
        const saved = structuredClone(row);
        const request = {
          abortSignal: (abort: AbortSignal) => {
            signal = abort;
            return request;
          },
          then: <T>(
            resolve: (result: { data: null; error: PostgrestError | null }) => T,
            reject: (reason: unknown) => T,
          ) =>
            this.answer(
              signal,
              () => this.beforeWrite(saved),
              () => this.upserted(saved, userId),
            ).then(resolve, reject),
        };
        return request;
      },
    };
    return builder;
  }

  private async answer<T>(
    signal: AbortSignal | undefined,
    hold: () => Promise<void>,
    respond: () => T,
  ): Promise<T | { data: null; error: PostgrestError }> {
    try {
      await new Promise<void>((resolve, reject) => {
        signal?.addEventListener('abort', () => reject(ABORTED));
        hold().then(resolve, reject);
      });
    } catch (error) {
      return { data: null, error: error as PostgrestError };
    }
    return respond();
  }

  private upserted(
    row: UserDataRow,
    userId: string | undefined,
  ): { data: null; error: PostgrestError | null } {
    if (this.writeError) {
      return { data: null, error: this.writeError };
    }
    if (userId === undefined) {
      return { data: null, error: PERMISSION_DENIED };
    }
    if (row.user_id !== userId) {
      return { data: null, error: REFUSED };
    }
    this.rows = [
      ...this.rows.filter((other) => other.user_id !== row.user_id || other.key !== row.key),
      row,
    ];
    return { data: null, error: null };
  }
}

export function provideSupabase(fake: FakeSupabase): Provider {
  return { provide: SUPABASE, useValue: fake.client };
}

export function sessionFor(
  email: string,
  accessToken = 'access-token',
  userId = 'user-1',
): Session {
  return {
    access_token: accessToken,
    refresh_token: 'refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: userId,
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
