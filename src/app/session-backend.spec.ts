import { TestBed } from '@angular/core/testing';
import { DATA_FAILED, FakeSupabase, provideSupabase, sessionFor } from './auth/testing';
import { deferred } from './testing';
import { PlanStore } from './plan/plan-store';
import { day, LUNCH, picked, planOf } from './plan/testing';
import { RecipeStore } from './recipes/recipe-store';
import { PLAIN_RICE, QUICK_DAL, RECIPES_KEY, storeOwnRecipes } from './recipes/testing';
import { SessionBackend } from './session-backend';
import { StorageBackend } from './storage';

const KEYS = ['fooplan.plan', 'fooplan.removed', 'fooplan.recipes'];

describe('SessionBackend', () => {
  let fake: FakeSupabase;

  beforeEach(() => {
    localStorage.clear();
    fake = new FakeSupabase();
    TestBed.configureTestingModule({
      providers: [provideSupabase(fake), { provide: StorageBackend, useExisting: SessionBackend }],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the stores from localStorage without a session, never calling the client's from, and from the account with one, neither reading nor writing the three keys in localStorage (#45 3)", async () => {
    const browserPlan = planOf([
      day('2026-10-24', picked('Spaghetti carbonara'), picked('Quick Dal')),
    ]);
    localStorage.setItem('fooplan.plan', JSON.stringify(browserPlan));
    localStorage.setItem('fooplan.removed', JSON.stringify(['Niçoise salad']));
    storeOwnRecipes(QUICK_DAL);
    fake.load(null);
    const store = TestBed.inject(PlanStore);

    await store.load();
    expect(store.plan(), 'signed out').toEqual(browserPlan);
    expect(store.removed()).toEqual(['Niçoise salad']);
    expect(TestBed.inject(RecipeStore).own()).toEqual([QUICK_DAL]);
    expect(fake.tables, 'from() signed out').toEqual([]);

    const accountPlan = planOf([day('2026-10-26', picked('Fish tacos'), picked('Pizza toast'))]);
    fake.saveRow('fooplan.plan', accountPlan);
    fake.saveRow('fooplan.removed', ['Bean burritos']);
    fake.emit('SIGNED_IN', sessionFor('ana@example.com'));
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    await store.load();
    expect(store.plan(), 'signed in').toEqual(accountPlan);
    expect(store.removed()).toEqual(['Bean burritos']);
    expect(TestBed.inject(RecipeStore).own()).toEqual([]);
    expect(fake.tables.length, 'from() signed in').toBeGreaterThanOrEqual(3);
    store.removeRecipe('Potato goulash');
    await new Promise((resolve) => setTimeout(resolve));
    expect(fake.row('fooplan.removed')?.value).toEqual(['Bean burritos', 'Potato goulash']);
    expect(
      getItem.mock.calls.filter(([key]) => KEYS.includes(key)),
      'read',
    ).toEqual([]);
    expect(
      setItem.mock.calls.filter(([key]) => KEYS.includes(key)),
      'written',
    ).toEqual([]);
  });

  describe('edge cases', () => {
    it('reads nothing until the client has returned the saved session, then reads the account (#45 3a)', async () => {
      localStorage.setItem(
        'fooplan.plan',
        JSON.stringify(
          planOf([day('2026-10-24', picked('Spaghetti carbonara'), picked('Fish tacos'))]),
        ),
      );
      const accountPlan = planOf([day('2026-10-26', picked('Fish tacos'), picked('Pizza toast'))]);
      fake.saveRow('fooplan.plan', accountPlan);
      const getItem = vi.spyOn(Storage.prototype, 'getItem');
      const store = TestBed.inject(PlanStore);

      const loading = store.load();
      await new Promise((resolve) => setTimeout(resolve));
      expect(store.ready(), 'ready before the session').toBe(false);
      expect(fake.tables, 'from() before the session').toEqual([]);
      expect(
        getItem.mock.calls.filter(([key]) => KEYS.includes(key)),
        'read',
      ).toEqual([]);

      fake.load(sessionFor('ana@example.com'));
      await loading;
      expect(store.plan()).toEqual(accountPlan);
      expect(
        getItem.mock.calls.filter(([key]) => KEYS.includes(key)),
        'read',
      ).toEqual([]);
    });

    it('loads from localStorage again once the session has gone away, without calling from (#45 3b)', async () => {
      const browserPlan = planOf([
        day('2026-10-24', picked('Spaghetti carbonara'), picked('Fish tacos')),
      ]);
      localStorage.setItem('fooplan.plan', JSON.stringify(browserPlan));
      fake.load(sessionFor('ana@example.com'));
      const store = TestBed.inject(PlanStore);
      await store.load();
      expect(store.plan(), 'signed in').not.toEqual(browserPlan);

      fake.emit('SIGNED_OUT', null);
      const queried = fake.tables.length;
      await store.load();
      expect(store.plan(), 'signed out').toEqual(browserPlan);
      expect(fake.tables.length, 'from() signed out').toBe(queried);
    });

    it('keeps sending the writes of one user through one ServerBackend across loads, so a write after a reload waits for the one before it (#45 3f)', async () => {
      fake.load(sessionFor('ana@example.com'));
      const store = TestBed.inject(PlanStore);
      await store.load();
      const first = deferred<void>();
      const sent: unknown[] = [];
      fake.beforeWrite = (row) => {
        if (row.key !== 'fooplan.removed') {
          return Promise.resolve();
        }
        sent.push(row.value);
        return sent.length === 1 ? first.promise : Promise.resolve();
      };

      store.removeRecipe('Bean burritos');
      await store.reload();
      store.removeRecipe('Potato goulash');
      await new Promise((resolve) => setTimeout(resolve));
      expect(sent, 'sent before the first is answered').toEqual([['Bean burritos']]);
      first.resolve();
      await new Promise((resolve) => setTimeout(resolve));
      expect(sent, 'sent once the first is answered').toEqual([
        ['Bean burritos'],
        ['Potato goulash'],
      ]);
      expect(fake.row('fooplan.removed')?.value).toEqual(['Potato goulash']);
    });

    it('writes nothing to localStorage for a change made after the session has gone away and before the stores load again (#45 3c)', async () => {
      fake.load(sessionFor('ana@example.com'));
      const store = TestBed.inject(PlanStore);
      await store.load();
      const setItem = vi.spyOn(Storage.prototype, 'setItem');

      fake.emit('SIGNED_OUT', null);
      store.pick(LUNCH, store.plan().days[0].lunch.suggestions[0]);
      store.removeRecipe('Bean burritos');
      await new Promise((resolve) => setTimeout(resolve));
      expect(setItem.mock.calls.filter(([key]) => KEYS.includes(key))).toEqual([]);
    });
  });
});
