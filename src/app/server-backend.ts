import type { SupabaseClient } from '@supabase/supabase-js';
import { StorageBackend } from './storage';

const TABLE = 'user_data';
// Without an answer by then, a request fails as one the server refused does
const TIMEOUT = 15_000;

// Keeps each value in the user's row of user_data with its key, which the row-level security of the
// migration lets only that user read and write. The client answers a refused or failed request with
// an error rather than throwing it; read and write reject with it.
// A key's write is sent once the one before it is answered, as two requests may reach the database
// in either order; of the writes waiting meanwhile, only the newest is sent, as each holds the whole
// value. `signedIn` tells whether the user is still signed in: a write for one who isn't is never
// sent, as the client would send it with another session or none, but rejects
export class ServerBackend extends StorageBackend {
  private readonly sending = new Map<string, Promise<void>>();
  private readonly waiting = new Map<string, { value: unknown; write: Promise<void> }>();

  constructor(
    private readonly client: SupabaseClient,
    readonly userId: string,
    private readonly signedIn: () => boolean,
    private readonly timeout = TIMEOUT,
  ) {
    super();
  }

  async read(key: string): Promise<unknown> {
    const { data, error } = await this.client
      .from(TABLE)
      .select('value')
      .eq('user_id', this.userId)
      .eq('key', key)
      .abortSignal(AbortSignal.timeout(this.timeout))
      .maybeSingle();
    if (error) {
      throw error;
    }
    return data?.value ?? null;
  }

  write(key: string, value: unknown): Promise<void> {
    const waiting = this.waiting.get(key);
    if (waiting) {
      waiting.value = value;
      return waiting.write;
    }
    const sending = this.sending.get(key);
    if (!sending) {
      return this.send(key, value);
    }
    const next: { value: unknown; write: Promise<void> } = {
      value,
      write: sending
        .catch(() => undefined)
        .then(() => {
          this.waiting.delete(key);
          return this.send(key, next.value);
        }),
    };
    this.waiting.set(key, next);
    return next.write;
  }

  private send(key: string, value: unknown): Promise<void> {
    const sent = this.upsert(key, value);
    this.sending.set(key, sent);
    const done = () => {
      if (this.sending.get(key) === sent) {
        this.sending.delete(key);
      }
    };
    sent.then(done, done);
    return sent;
  }

  // The column's default sets updated_at only when the row is added
  private async upsert(key: string, value: unknown): Promise<void> {
    if (!this.signedIn()) {
      throw new Error('Not sent: the user has signed out');
    }
    const { error } = await this.client
      .from(TABLE)
      .upsert({ user_id: this.userId, key, value, updated_at: new Date().toISOString() })
      .abortSignal(AbortSignal.timeout(this.timeout));
    if (error) {
      throw error;
    }
  }
}
