import { TestBed } from '@angular/core/testing';
import { LocalStorageBackend, StorageBackend } from './storage';

describe('LocalStorageBackend', () => {
  let backend: LocalStorageBackend;

  beforeEach(() => {
    localStorage.clear();
    backend = new LocalStorageBackend();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is the backend the app gets by default (#44 8c)', () => {
    expect(TestBed.inject(StorageBackend)).toBeInstanceOf(LocalStorageBackend);
  });

  it('reads the JSON saved under a key as its value, and null for a key with nothing saved or text that is not JSON (#44 8a)', async () => {
    localStorage.setItem('fooplan.plan', JSON.stringify({ people: 2, days: [] }));
    localStorage.setItem('fooplan.removed', 'not json');

    expect(await backend.read('fooplan.plan')).toEqual({ people: 2, days: [] });
    expect(await backend.read('fooplan.removed'), 'not JSON').toBeNull();
    expect(await backend.read('fooplan.recipes'), 'nothing saved').toBeNull();
  });

  it('saves a value as JSON under its key, read back as the same value (#44 8b)', async () => {
    const recipes = [{ name: 'Quick Dal', servings: 4, ingredients: [] }];

    await backend.write('fooplan.recipes', recipes);
    expect(localStorage.getItem('fooplan.recipes')).toBe(JSON.stringify(recipes));
    expect(await backend.read('fooplan.recipes')).toEqual(recipes);
  });

  describe('edge cases', () => {
    it('resolves a write without saving, rather than rejecting, when storage is blocked or full (#44 8d)', async () => {
      const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('quota exceeded', 'QuotaExceededError');
      });

      await expect(backend.write('fooplan.plan', { people: 2 })).resolves.toBeUndefined();
      expect(setItem, 'write not tried').toHaveBeenCalledWith('fooplan.plan', '{"people":2}');
      expect(localStorage.getItem('fooplan.plan')).toBeNull();
    });

    it('reads null, rather than rejecting, when storage is blocked (#44 8e)', async () => {
      localStorage.setItem('fooplan.plan', JSON.stringify({ people: 2 }));
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError');
      });

      await expect(backend.read('fooplan.plan')).resolves.toBeNull();
    });
  });
});
