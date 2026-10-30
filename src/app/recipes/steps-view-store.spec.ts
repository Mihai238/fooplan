import { TestBed } from '@angular/core/testing';
import { DEFAULT_SETTINGS } from '../plan/plan';
import { PlanStore, RANDOM, TODAY } from '../plan/plan-store';
import { seededRandom } from '../plan/testing';
import { StepsViewStore } from './steps-view-store';
import { STEPS_VIEW_KEY } from './testing';

describe('StepsViewStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows steps with nothing saved, all after set("all") saved as the plain text all in fooplan.stepsView, steps for other, list, "" or "all" with the quotes saved, all without throwing when saving fails, and steps when reading fails', () => {
    let store = createStore();
    expect(store.view(), 'nothing saved').toBe('steps');
    store.set('all');
    expect(store.view(), 'after set("all")').toBe('all');
    expect(localStorage.getItem(STEPS_VIEW_KEY)).toBe('all');

    for (const value of ['other', 'list', '', '"all"']) {
      localStorage.setItem(STEPS_VIEW_KEY, value);
      expect(reload().view(), `saved ${JSON.stringify(value)}`).toBe('steps');
    }

    localStorage.clear();
    store = reload();
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError');
    });
    expect(() => store.set('all'), 'failed write').not.toThrow();
    expect(setItem, 'no write tried').toHaveBeenCalled();
    expect(store.view(), 'failed write').toBe('all');
    setItem.mockRestore();

    localStorage.setItem(STEPS_VIEW_KEY, 'all');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('storage blocked', 'SecurityError');
    });
    expect(reload().view(), 'failed read').toBe('steps');
  });

  describe('edge cases', () => {
    it('reads fooplan.stepsView once, when created, and not again on view() or set()', () => {
      const getItem = vi.spyOn(Storage.prototype, 'getItem');
      const store = createStore();
      localStorage.setItem(STEPS_VIEW_KEY, 'all');
      expect(store.view(), 'saved after creation').toBe('steps');
      store.set('all');
      store.set('steps');
      store.view();
      expect(getItem.mock.calls.filter(([key]) => key === STEPS_VIEW_KEY)).toHaveLength(1);
    });

    it('keeps all and steps after a reload, saved as all and steps', () => {
      createStore().set('all');
      const reloaded = reload();
      expect(reloaded.view(), 'all after a reload').toBe('all');
      reloaded.set('steps');
      expect(localStorage.getItem(STEPS_VIEW_KEY)).toBe('steps');
      expect(reload().view(), 'steps after a reload').toBe('steps');
    });

    it('keeps all, also saved, after "New plan"', () => {
      TestBed.configureTestingModule({
        providers: [
          { provide: RANDOM, useValue: seededRandom(1) },
          { provide: TODAY, useValue: () => '2026-10-24' },
        ],
      });
      const store = createStore();
      store.set('all');
      TestBed.inject(PlanStore).newPlan(DEFAULT_SETTINGS);
      expect(store.view()).toBe('all');
      expect(localStorage.getItem(STEPS_VIEW_KEY)).toBe('all');
      expect(reload().view(), 'after a reload').toBe('all');
    });

    it('reads ALL, " all" and "all " saved in fooplan.stepsView as steps, where it reads all as all', () => {
      localStorage.setItem(STEPS_VIEW_KEY, 'all');
      expect(createStore().view(), 'saved all').toBe('all');
      for (const value of ['ALL', ' all', 'all ']) {
        localStorage.setItem(STEPS_VIEW_KEY, value);
        expect(reload().view(), `saved ${JSON.stringify(value)}`).toBe('steps');
      }
    });

    it('shows steps again after a reload when saving all failed', () => {
      const store = createStore();
      const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('quota exceeded', 'QuotaExceededError');
      });
      store.set('all');
      expect(store.view(), 'before the reload').toBe('all');
      setItem.mockRestore();
      expect(localStorage.getItem(STEPS_VIEW_KEY)).toBeNull();
      expect(reload().view()).toBe('steps');
    });
  });

  // A fresh injector reading the same localStorage, as a page reload would
  function reload(): StepsViewStore {
    TestBed.resetTestingModule();
    return createStore();
  }

  function createStore(): StepsViewStore {
    return TestBed.inject(StepsViewStore);
  }
});
