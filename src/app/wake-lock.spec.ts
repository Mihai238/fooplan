import { TestBed } from '@angular/core/testing';
import { deferred, FakeWakeLock, installWakeLock, settle, unhandledRejections } from './testing';
import { WakeLock } from './wake-lock';

describe('WakeLock', () => {
  let fake: FakeWakeLock;
  let restore: () => void;

  beforeEach(() => {
    fake = new FakeWakeLock();
    restore = installWakeLock(fake);
  });

  afterEach(() => {
    restore();
    Reflect.deleteProperty(document, 'visibilityState');
  });

  it('requests the screen lock once on hold(), not again while held, releases its sentinel once on release(), not again, and requests again on hold() after that (#56 1)', async () => {
    const lock = TestBed.inject(WakeLock);
    await lock.hold();
    expect(fake.requests, 'after hold()').toEqual(['screen']);
    await lock.hold();
    expect(fake.requests, 'after a second hold()').toEqual(['screen']);

    await lock.release();
    expect(fake.sentinels, 'sentinels').toHaveLength(1);
    expect(fake.sentinels[0].releases, 'after release()').toBe(1);
    await lock.release();
    expect(fake.sentinels[0].releases, 'after a second release()').toBe(1);

    await lock.hold();
    expect(fake.requests, 'after hold() again').toEqual(['screen', 'screen']);
  });

  it('lets no error leave hold() on a request rejected with NotAllowedError, holding no sentinel, nor hold() and release() without navigator.wakeLock, nor release() on a sentinel whose release rejects (#56 2)', async () => {
    fake.rejectWith = new DOMException('not allowed', 'NotAllowedError');
    const lock = TestBed.inject(WakeLock);
    const unhandled = await unhandledRejections(() => void lock.hold());
    expect(unhandled, 'rejected request').toEqual([]);
    expect(fake.requests, 'rejected request').toEqual(['screen']);
    expect(fake.sentinels, 'rejected request').toEqual([]);
    await expect(lock.release(), 'release() after a rejected request').resolves.toBeUndefined();

    restore();
    restore = installWakeLock(null);
    expect('wakeLock' in navigator, 'navigator.wakeLock left').toBe(false);
    TestBed.resetTestingModule();
    const without = TestBed.inject(WakeLock);
    await expect(without.hold(), 'hold() without the API').resolves.toBeUndefined();
    await expect(without.release(), 'release() without the API').resolves.toBeUndefined();

    restore();
    fake = new FakeWakeLock();
    fake.releaseRejects = true;
    restore = installWakeLock(fake);
    TestBed.resetTestingModule();
    const rejecting = TestBed.inject(WakeLock);
    await rejecting.hold();
    expect(fake.requests, 'before the rejected release').toEqual(['screen']);
    const unhandledRelease = await unhandledRejections(() => void rejecting.release());
    expect(unhandledRelease, 'rejected release').toEqual([]);
    expect(fake.sentinels[0].releases, 'rejected release').toBe(1);
  });

  it('requests the lock again when the document becomes visible while hold() is in force, but not after release() nor when it becomes hidden (#56 3)', async () => {
    const lock = TestBed.inject(WakeLock);
    await lock.hold();
    await changeVisibility('visible');
    expect(fake.requests, 'visible while held').toEqual(['screen', 'screen']);
    expect(fake.sentinels[0].releases, 'sentinel replaced by the second').toBe(1);

    await lock.release();
    await changeVisibility('visible');
    expect(fake.requests, 'visible after release()').toEqual(['screen', 'screen']);

    await lock.hold();
    expect(fake.requests, 'hold() again').toEqual(['screen', 'screen', 'screen']);
    await changeVisibility('hidden');
    expect(fake.requests, 'hidden while held').toEqual(['screen', 'screen', 'screen']);
  });

  describe('edge cases', () => {
    it('neither requests nor releases anything on release() before any hold(), and requests once on hold() after it (#56 1a)', async () => {
      const lock = TestBed.inject(WakeLock);
      await expect(lock.release()).resolves.toBeUndefined();
      expect(fake.requests, 'after release()').toEqual([]);
      expect(fake.releases(), 'after release()').toBe(0);

      await lock.hold();
      expect(fake.requests, 'after hold()').toEqual(['screen']);
    });

    it('releases a sentinel arriving after release(), once, and holds nothing then: a visible document requests no more (#56 1b)', async () => {
      const answer = deferred<void>();
      fake.beforeAnswer = () => answer.promise;
      const lock = TestBed.inject(WakeLock);
      const held = lock.hold();
      await lock.release();
      answer.resolve();
      await held;
      await settle();
      expect(fake.sentinels, 'sentinels').toHaveLength(1);
      expect(fake.sentinels[0].releases, 'late sentinel').toBe(1);

      await changeVisibility('visible');
      expect(fake.requests, 'visible after release()').toEqual(['screen']);
      await lock.release();
      expect(fake.sentinels[0].releases, 'release() again').toBe(1);
    });

    it('requests once while the request is pending, on a second hold() and on a visible document, and keeps the one sentinel (#56 1c)', async () => {
      const answer = deferred<void>();
      fake.beforeAnswer = () => answer.promise;
      const lock = TestBed.inject(WakeLock);
      const held = lock.hold();
      void lock.hold();
      await changeVisibility('visible');
      expect(fake.requests, 'while pending').toEqual(['screen']);

      answer.resolve();
      await held;
      await settle();
      expect(fake.sentinels, 'sentinels').toHaveLength(1);
      await lock.release();
      expect(fake.sentinels[0].releases, 'release()').toBe(1);
    });

    it('requests again on hold() while a sentinel arriving after release() is still being released, and holds the new one (#56 1d)', async () => {
      const answer = deferred<void>();
      fake.beforeAnswer = () => answer.promise;
      const releasing = deferred<void>();
      fake.beforeRelease = () => releasing.promise;
      const lock = TestBed.inject(WakeLock);
      void lock.hold();
      await lock.release();
      answer.resolve();
      await settle();
      expect(fake.sentinels[0].releases, 'late sentinel being released').toBe(1);

      fake.beforeAnswer = () => Promise.resolve();
      void lock.hold();
      releasing.resolve();
      await settle();
      expect(fake.requests, 'hold() during the late release').toEqual(['screen', 'screen']);
      expect(fake.sentinels, 'sentinels').toHaveLength(2);
      fake.beforeRelease = () => Promise.resolve();
      await lock.release();
      expect(fake.sentinels[1].releases, 'sentinel of the second hold()').toBe(1);
    });

    it('requests again on hold() after hold() whose request was rejected (#56 2a)', async () => {
      fake.rejectWith = new DOMException('not allowed', 'NotAllowedError');
      const lock = TestBed.inject(WakeLock);
      await lock.hold();
      expect(fake.requests, 'rejected hold()').toEqual(['screen']);

      fake.rejectWith = null;
      await lock.hold();
      expect(fake.requests, 'hold() again').toEqual(['screen', 'screen']);
      expect(fake.sentinels, 'sentinel of the second hold()').toHaveLength(1);
    });

    it('requests again on hold() after the browser released the lock and the request on a visible document was rejected (#56 2b)', async () => {
      const lock = TestBed.inject(WakeLock);
      await lock.hold();
      fake.sentinels[0].browserRelease();
      fake.rejectWith = new DOMException('not allowed', 'NotAllowedError');
      await changeVisibility('visible');
      expect(fake.requests, 'rejected request on visible').toEqual(['screen', 'screen']);

      fake.rejectWith = null;
      await lock.hold();
      expect(fake.requests, 'hold() again').toEqual(['screen', 'screen', 'screen']);
      expect(fake.sentinels, 'sentinels').toHaveLength(2);
      await lock.release();
      await lock.hold();
      expect(fake.requests, 'release() and hold()').toEqual([
        'screen',
        'screen',
        'screen',
        'screen',
      ]);
    });

    it('lets no error leave hold() on a request() that throws before it returns a promise, and requests again on the next hold() (#56 2c)', async () => {
      fake.throwWith = new TypeError('request is not a function');
      const lock = TestBed.inject(WakeLock);
      const unhandled = await unhandledRejections(() => void lock.hold());
      expect(unhandled, 'thrown request').toEqual([]);
      expect(fake.requests, 'thrown request').toEqual(['screen']);
      await expect(lock.release(), 'release() after it').resolves.toBeUndefined();

      fake.throwWith = null;
      await lock.hold();
      expect(fake.requests, 'hold() again').toEqual(['screen', 'screen']);
      expect(fake.sentinels, 'sentinel of the second hold()').toHaveLength(1);
    });

    it('requests nothing when the document becomes visible before any hold() (#56 3a)', async () => {
      TestBed.inject(WakeLock);
      await changeVisibility('visible');
      expect(fake.requests).toEqual([]);
    });

    it('requests the lock again when the document becomes visible after hold() whose request was rejected, as hold() is still in force (#56 3b)', async () => {
      fake.rejectWith = new DOMException('document hidden', 'NotAllowedError');
      const lock = TestBed.inject(WakeLock);
      await lock.hold();
      expect(fake.requests, 'rejected hold()').toEqual(['screen']);

      fake.rejectWith = null;
      await changeVisibility('visible');
      expect(fake.requests, 'visible after the rejected hold()').toEqual(['screen', 'screen']);
      expect(fake.sentinels, 'sentinel of the second request').toHaveLength(1);
    });

    it('releases the sentinel of the request made on becoming visible on release(), once, and requests nothing more on becoming visible after it (#56 3c)', async () => {
      const lock = TestBed.inject(WakeLock);
      await lock.hold();
      expect(fake.sentinels, 'sentinel of hold()').toHaveLength(1);
      // The browser released the first lock while the document was hidden
      fake.sentinels[0].browserRelease();
      await changeVisibility('visible');
      expect(fake.sentinels, 'sentinels').toHaveLength(2);
      expect(fake.sentinels[0].releases, 'sentinel the browser released').toBe(0);

      await lock.release();
      expect(fake.sentinels[1].releases, 'sentinel of the second request').toBe(1);
      await changeVisibility('visible');
      expect(fake.requests, 'visible after release()').toEqual(['screen', 'screen']);
    });
  });

  async function changeVisibility(state: DocumentVisibilityState) {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
    document.dispatchEvent(new Event('visibilitychange'));
    await settle();
  }
});
