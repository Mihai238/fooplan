import { TestBed } from '@angular/core/testing';
import { deferred } from './testing';
import { SaveStatus } from './save-status';

describe('SaveStatus', () => {
  let status: SaveStatus;

  beforeEach(() => {
    status = TestBed.inject(SaveStatus);
  });

  it('has failed once a write rejects, and not once a write started after it resolves (#45 7)', async () => {
    expect(status.failed(), 'before any write').toBe(false);

    status.track('fooplan.plan', Promise.reject(new Error('not saved')));
    await settled();
    expect(status.failed(), 'after the rejection').toBe(true);

    status.track('fooplan.plan', Promise.resolve());
    await settled();
    expect(status.failed(), 'after the later write').toBe(false);
  });

  describe('edge cases', () => {
    it('stays failed when a write started before the rejected one resolves after it, until a write started after it resolves (#45 7d)', async () => {
      const earlier = deferred<void>();
      status.track('fooplan.plan', earlier.promise);
      status.track('fooplan.plan', Promise.reject(new Error('not saved')));
      await settled();
      expect(status.failed(), 'after the rejection').toBe(true);

      earlier.resolve();
      await settled();
      expect(status.failed(), 'after the earlier write').toBe(true);

      status.track('fooplan.plan', Promise.resolve());
      await settled();
      expect(status.failed(), 'after a later write').toBe(false);
    });

    it('stays failed after a rejected fooplan.recipes write when a later fooplan.plan write resolves, until a later fooplan.recipes write resolves (#45 7g)', async () => {
      status.track('fooplan.recipes', Promise.reject(new Error('not saved')));
      status.track('fooplan.plan', Promise.resolve());
      await settled();
      expect(status.failed(), 'after the plan write').toBe(true);

      status.track('fooplan.recipes', Promise.resolve());
      await settled();
      expect(status.failed(), 'after the later recipes write').toBe(false);
    });

    it('is not failed after reset(), also when a write started before it rejects afterwards (#45 7h)', async () => {
      status.track('fooplan.plan', Promise.reject(new Error('not saved')));
      await settled();
      const pending = deferred<void>();
      status.track(
        'fooplan.removed',
        pending.promise.then(() => Promise.reject(new Error('not saved'))),
      );

      status.reset();
      expect(status.failed(), 'after reset').toBe(false);
      pending.resolve();
      await settled();
      expect(status.failed(), 'after the earlier write rejected').toBe(false);

      status.track('fooplan.plan', Promise.reject(new Error('not saved')));
      await settled();
      expect(status.failed(), 'after a write started after reset').toBe(true);
    });
  });

  function settled() {
    return new Promise((resolve) => setTimeout(resolve));
  }
});
