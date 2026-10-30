import { TestBed } from '@angular/core/testing';
import { AuthStore } from './auth-store';
import { FakeSupabase, LINK_FAILED, provideSupabase, sessionFor, SIGN_OUT_FAILED } from './testing';

describe('AuthStore', () => {
  let fake: FakeSupabase;

  beforeEach(() => {
    fake = new FakeSupabase();
    TestBed.configureTestingModule({ providers: [provideSupabase(fake)] });
  });

  afterEach(() => {
    history.replaceState(null, '', '/');
  });

  it('is not loaded and has no email until the client returns the saved session, then has its email and resolves whenLoaded() (#43 2, 7)', async () => {
    const store = TestBed.inject(AuthStore);
    let resolved = false;
    void store.whenLoaded().then(() => (resolved = true));
    await Promise.resolve();
    expect(store.loaded(), 'before').toBe(false);
    expect(store.email(), 'before').toBeNull();
    expect(resolved, 'whenLoaded before').toBe(false);

    fake.load(sessionFor('ana@example.com'));
    await store.whenLoaded();
    expect(store.loaded()).toBe(true);
    expect(store.email()).toBe('ana@example.com');
  });

  it('sends the link with emailRedirectTo the base URL, true when the client succeeds and false when it answers with an error (#43 5, 6)', async () => {
    const store = TestBed.inject(AuthStore);
    expect(await store.sendLink('ana@example.com'), 'sent').toBe(true);
    expect(fake.sent).toEqual([
      { email: 'ana@example.com', options: { emailRedirectTo: document.baseURI } },
    ]);

    fake.sendLink = () => Promise.resolve(LINK_FAILED);
    expect(await store.sendLink('ana@example.com'), 'failed').toBe(false);
  });

  it('signs this device out only, with scope "local", and has no email once signOut() returns, without waiting for the client\'s SIGNED_OUT (#43 8)', async () => {
    fake.load(sessionFor('ana@example.com'));
    fake.signOutEmits = false;
    const store = TestBed.inject(AuthStore);
    expect(await store.signOut()).toBe(true);
    expect(fake.signOuts).toEqual([{ scope: 'local' }]);
    expect(store.email()).toBeNull();
    expect(store.loaded()).toBe(true);
  });

  it('has signed in from a link when it starts on a URL with the session in its fragment and the client returns that session (#43 9)', async () => {
    history.replaceState(null, '', '/#access_token=token&type=magiclink');
    fake.load(sessionFor('ana@example.com', 'token'));
    const store = TestBed.inject(AuthStore);
    await store.whenLoaded();
    expect(store.signedInFromLink()).toBe(true);
  });

  describe('edge cases', () => {
    it('returns false for a send that rejects, as when the network fails (#43 6a)', async () => {
      fake.sendLink = () => Promise.reject(new TypeError('Failed to fetch'));
      expect(await TestBed.inject(AuthStore).sendLink('ana@example.com')).toBe(false);
    });

    it('keeps the email and returns false when signing out answers with an error or rejects (#43 8a)', async () => {
      fake.load(sessionFor('ana@example.com'));
      const store = TestBed.inject(AuthStore);
      fake.signOutResult = () => Promise.resolve(SIGN_OUT_FAILED);
      expect(await store.signOut(), 'error').toBe(false);
      expect(store.email(), 'after an error').toBe('ana@example.com');

      fake.signOutResult = () => Promise.reject(new TypeError('Failed to fetch'));
      expect(await store.signOut(), 'rejected').toBe(false);
      expect(store.email(), 'after a rejection').toBe('ana@example.com');
    });

    it('has not signed in from a link on a reload of a signed-in page, nor when the link brings no session (#43 9a)', async () => {
      fake.load(sessionFor('ana@example.com'));
      const reloaded = TestBed.inject(AuthStore);
      await reloaded.whenLoaded();
      expect(reloaded.signedInFromLink(), 'reload').toBe(false);

      TestBed.resetTestingModule();
      fake = new FakeSupabase();
      TestBed.configureTestingModule({ providers: [provideSupabase(fake)] });
      history.replaceState(null, '', '/#access_token=expired&type=magiclink');
      fake.load(null);
      const expired = TestBed.inject(AuthStore);
      await expired.whenLoaded();
      expect(expired.signedInFromLink(), 'no session').toBe(false);
    });

    it('has not signed in from a link when signing in from it fails and the client keeps the session the user had (#43 9c)', async () => {
      history.replaceState(null, '', '/#access_token=bad&type=magiclink');
      fake.load(sessionFor('ana@example.com', 'earlier-token'));
      const store = TestBed.inject(AuthStore);
      await store.whenLoaded();
      expect(store.openedFromLink).toBe(true);
      expect(store.signedInFromLink()).toBe(false);
    });
  });
});
