import { TestBed } from '@angular/core/testing';
import { RecentItemsStore } from './recent-items-store';
import { RECENT_ITEMS_KEY } from './testing';

describe('RecentItemsStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('holds nothing without fooplan.recentItems, saves remember("milk") as ["milk"], forgets it with forget("MILK"), and reads ["coffee"] saved before it was created', () => {
    const store = createStore();
    expect(store.items(), 'nothing saved').toEqual([]);

    store.remember('milk');
    expect(store.items(), 'after remember').toEqual(['milk']);
    expect(localStorage.getItem(RECENT_ITEMS_KEY)).toBe('["milk"]');

    store.forget('MILK');
    expect(store.items(), 'after forget').toEqual([]);
    expect(localStorage.getItem(RECENT_ITEMS_KEY)).toBe('[]');

    localStorage.setItem(RECENT_ITEMS_KEY, '["coffee"]');
    expect(reload().items(), 'saved before').toEqual(['coffee']);
  });

  describe('edge cases', () => {
    it('keeps the item in items() without throwing when saving fails, and holds nothing after a reload then', () => {
      const store = createStore();
      const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('quota exceeded', 'QuotaExceededError');
      });
      expect(() => store.remember('milk'), 'failed write').not.toThrow();
      expect(setItem, 'no write tried').toHaveBeenCalled();
      expect(store.items()).toEqual(['milk']);
      setItem.mockRestore();
      expect(reload().items(), 'after a reload').toEqual([]);
    });

    it('holds nothing for a saved value that is not JSON or not a list of strings, or when reading fails, where it reads ["coffee"]', () => {
      for (const value of ['milk', '{}', '["milk", 3]', '"milk"']) {
        localStorage.setItem(RECENT_ITEMS_KEY, value);
        expect(reload().items(), `saved ${value}`).toEqual([]);
      }

      localStorage.setItem(RECENT_ITEMS_KEY, '["coffee"]');
      expect(reload().items(), 'saved ["coffee"]').toEqual(['coffee']);
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('storage blocked', 'SecurityError');
      });
      expect(reload().items(), 'failed read').toEqual([]);
    });

    it('writes nothing for forget of an item not remembered, remember of a blank text, or remember of the item already first', () => {
      const store = createStore();
      store.remember('milk');
      const setItem = vi.spyOn(Storage.prototype, 'setItem');
      store.forget('tea');
      store.remember('   ');
      store.remember(' milk ');
      expect(setItem).not.toHaveBeenCalled();
      expect(store.items()).toEqual(['milk']);
    });

    it('keeps the most recent first across a reload, trimmed, with the latest spelling', () => {
      const store = createStore();
      store.remember('milk');
      store.remember(' coffee ');
      store.remember('Milk');
      expect(store.items()).toEqual(['Milk', 'coffee']);
      expect(localStorage.getItem(RECENT_ITEMS_KEY)).toBe('["Milk","coffee"]');
      expect(reload().items(), 'after a reload').toEqual(['Milk', 'coffee']);
    });

    it('reads a saved list as parseRecentItems does: trimmed, without blanks and later duplicates', () => {
      localStorage.setItem(RECENT_ITEMS_KEY, '[" Milk ", "milk", "", "coffee"]');
      expect(createStore().items()).toEqual(['Milk', 'coffee']);
    });
  });

  // A fresh injector reading the same localStorage, as a page reload would
  function reload(): RecentItemsStore {
    TestBed.resetTestingModule();
    return createStore();
  }

  function createStore(): RecentItemsStore {
    return TestBed.inject(RecentItemsStore);
  }
});
