import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import type { Session } from '@supabase/supabase-js';
import { SUPABASE } from './supabase';

@Injectable({ providedIn: 'root' })
export class AuthStore {
  // A sign-in link opens the app with the session in the URL's fragment. Read here, as the client
  // removes it once it has signed in from it
  private readonly linkToken = new URLSearchParams(location.hash.slice(1)).get('access_token');
  readonly openedFromLink = this.linkToken !== null;
  private readonly client = inject(SUPABASE);
  // Undefined until the client has read the saved session, so nothing shows "Sign in" before then
  private readonly state = signal<Session | null | undefined>(undefined);
  readonly loaded = computed(() => this.state() !== undefined);
  readonly email = computed(() => this.state()?.user.email ?? null);
  private markLoaded!: () => void;
  private readonly loading = new Promise<void>((resolve) => (this.markLoaded = resolve));

  constructor() {
    // The first event is INITIAL_SESSION, sent once the saved session, or one in the URL of a
    // sign-in link, has been read
    const { data } = this.client.auth.onAuthStateChange((_event, session) => {
      this.state.set(session);
      this.markLoaded();
    });
    inject(DestroyRef).onDestroy(() => data.subscription.unsubscribe());
  }

  whenLoaded(): Promise<void> {
    return this.loading;
  }

  // Only the link's own session counts: when signing in from it fails, the client keeps the session
  // the user had before
  signedInFromLink(): boolean {
    return this.linkToken !== null && this.state()?.access_token === this.linkToken;
  }

  async sendLink(email: string): Promise<boolean> {
    try {
      const { error } = await this.client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: document.baseURI },
      });
      return error === null;
    } catch {
      return false;
    }
  }

  // "local" ends this device's session only; the default would sign out every device. The state is
  // set here too, so callers can rely on it once this returns
  async signOut(): Promise<boolean> {
    try {
      const { error } = await this.client.auth.signOut({ scope: 'local' });
      if (error) {
        return false;
      }
    } catch {
      return false;
    }
    this.state.set(null);
    return true;
  }
}
