import { inject, Injectable } from '@angular/core';
import { AuthStore } from './auth/auth-store';
import { SUPABASE } from './auth/supabase';
import { ServerBackend } from './server-backend';
import { LocalStorageBackend, StorageBackend } from './storage';

// The browser's localStorage while signed out, the user's account while signed in. A read waits for
// the saved session, so the first load already reads from the right place. A write goes where the
// last read went: a change made after the session changed, before the stores load again, belongs to
// the data read before, and must not end up in the other place
@Injectable({ providedIn: 'root' })
export class SessionBackend extends StorageBackend {
  private readonly auth = inject(AuthStore);
  private readonly client = inject(SUPABASE);
  private readonly local = new LocalStorageBackend();
  private server: ServerBackend | undefined;
  private backend: StorageBackend = this.local;

  async read(key: string): Promise<unknown> {
    await this.auth.whenLoaded();
    this.backend = this.backendFor(this.auth.userId());
    return this.backend.read(key);
  }

  write(key: string, value: unknown): Promise<void> {
    return this.backend.write(key, value);
  }

  // The same user keeps the same ServerBackend, which orders the writes of each key
  private backendFor(userId: string | null): StorageBackend {
    if (userId === null) {
      return this.local;
    }
    if (this.server?.userId !== userId) {
      this.server = new ServerBackend(this.client, userId, () => this.auth.userId() === userId);
    }
    return this.server;
  }
}
