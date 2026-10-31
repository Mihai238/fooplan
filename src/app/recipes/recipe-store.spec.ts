import { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LanguageStore } from '../language-store';
import { SaveStatus } from '../save-status';
import { DEFAULT_SETTINGS } from '../plan/plan';
import { PlanStore, RANDOM, TODAY } from '../plan/plan-store';
import { seededRandom } from '../plan/testing';
import { LocalStorageBackend, StorageBackend } from '../storage';
import { deferred, RejectingBackend, ThrowingOnceBackend, unhandledRejections } from '../testing';
import { checkRecipe } from './own-recipe';
import { Ingredient, Recipe } from './recipe';
import { recipeSlug } from './recipe-slug';
import { RecipeStore } from './recipe-store';
import { RECIPES } from './recipes';
import { ownRecipe, PLAIN_RICE, QUICK_DAL, RECIPES_KEY, storeOwnRecipes } from './testing';

describe('RecipeStore', () => {
  let store: RecipeStore;

  beforeEach(async () => {
    localStorage.clear();
    store = await createStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('offers the built-in recipes followed by the own ones in the order added in all(), and only the own ones in own()', () => {
    store.add(ownRecipe("Grandma's Soup"));
    store.add(QUICK_DAL);

    expect(store.own()).toEqual([ownRecipe("Grandma's Soup"), QUICK_DAL]);
    expect(store.all()).toEqual([...RECIPES, ownRecipe("Grandma's Soup"), QUICK_DAL]);
  });

  it('keeps the own recipes after a reload and "New plan", saved in fooplan.recipes in the order added without `own`', async () => {
    store.add(QUICK_DAL);
    store.add(PLAIN_RICE);
    const saved = [QUICK_DAL, PLAIN_RICE].map(({ name, servings, ingredients }) => ({
      name,
      servings,
      ingredients,
    }));
    expect(storedRecipes()).toEqual(saved);

    store = await reload();
    expect(store.own(), 'after a reload').toEqual([QUICK_DAL, PLAIN_RICE]);
    const plan = TestBed.inject(PlanStore);
    await plan.load();
    plan.newPlan(DEFAULT_SETTINGS);
    expect(store.own(), 'after "New plan"').toEqual([QUICK_DAL, PLAIN_RICE]);
    expect(storedRecipes(), 'saved after "New plan"').toEqual(saved);
  });

  it('loads only the valid entry from a list holding entries named "Spaghetti carbonara" or " Quick Dal", with 13 servings, 31 ingredients, the ingredient "Onion", the amount 1.234, the unit kg or no ingredients, and a second entry of the valid name', async () => {
    const valid = stored(QUICK_DAL);
    localStorage.setItem(
      RECIPES_KEY,
      JSON.stringify([
        { ...valid, name: 'Spaghetti carbonara' },
        { ...valid, name: 'Thirteen servings', servings: 13 },
        { ...valid, name: ' Quick Dal' },
        { ...valid, name: 'Long list', ingredients: ingredients(31) },
        {
          ...valid,
          name: 'Capital onion',
          ingredients: [{ name: 'Onion', amount: 1, unit: 'pc' }],
        },
        {
          ...valid,
          name: 'Fine amount',
          ingredients: [{ name: 'rice', amount: 1.234, unit: 'g' }],
        },
        { ...valid, name: 'Kilo rice', ingredients: [{ name: 'rice', amount: 1, unit: 'kg' }] },
        { ...valid, name: 'No ingredients', ingredients: [] },
        valid,
        { ...valid, servings: 2 },
      ]),
    );

    expect((await reload()).own()).toEqual([QUICK_DAL]);
  });

  it('loads no own recipe from {} or text that is not JSON, where it loads a stored list', async () => {
    storeOwnRecipes(QUICK_DAL);
    expect((await reload()).own(), 'stored list').toEqual([QUICK_DAL]);
    for (const text of ['{}', 'not json']) {
      localStorage.setItem(RECIPES_KEY, text);
      const reloaded = await reload();
      expect(reloaded.own(), text).toEqual([]);
      expect(reloaded.all(), text).toEqual(RECIPES);
    }
  });

  it('keeps the amount 1.15 of an own recipe checked with the amount 1,15 after a reload', async () => {
    const checked = checkRecipe(
      {
        name: 'Quick Dal',
        servings: '4',
        ingredients: [{ amount: '1,15', unit: 'pc', name: 'onion' }],
      },
      store.all(),
    );
    expect('recipe' in checked, '1,15 not taken').toBe(true);
    const recipe: Recipe = { ...(checked as { recipe: Recipe }).recipe, own: true };
    expect(recipe.ingredients[0].amount).toBe(1.15);
    store.add(recipe);

    expect((await reload()).own()).toEqual([
      { ...QUICK_DAL, ingredients: [{ name: 'onion', amount: 1.15, unit: 'pc' }] },
    ]);
  });

  it('loads an entry with an extra `steps` key as an own recipe without steps', async () => {
    localStorage.setItem(
      RECIPES_KEY,
      JSON.stringify([{ ...stored(QUICK_DAL), steps: ['Cook the dal.', 'Serve it.'] }]),
    );

    expect((await reload()).own()).toStrictEqual([QUICK_DAL]);
  });

  it('finds the own recipe "Quick Dal" by the slug quick-dal once added and after a reload, and no recipe for no-such-dal', async () => {
    store.add(QUICK_DAL);
    expect(store.bySlug('quick-dal')).toEqual(QUICK_DAL);
    expect(store.bySlug('no-such-dal')).toBeUndefined();

    store = await reload();
    expect(store.bySlug('quick-dal'), 'after a reload').toEqual(QUICK_DAL);
    expect(store.bySlug('no-such-dal'), 'after a reload').toBeUndefined();
  });

  it('replaces "Grandma\'s Soup" by "Red Soup" in its place before "Quick Dal", as an own recipe found by red-soup and no longer by grandmas-soup, saved in fooplan.recipes in that order and kept after a reload', async () => {
    store.add(ownRecipe("Grandma's Soup"));
    store.add(QUICK_DAL);

    // As the form passes it: checked, without `own`
    store.replace("Grandma's Soup", stored(ownRecipe('Red Soup', 2)));
    expect(store.own()).toEqual([ownRecipe('Red Soup', 2), QUICK_DAL]);
    expect(store.all()).toEqual([...RECIPES, ownRecipe('Red Soup', 2), QUICK_DAL]);
    expect(store.bySlug('red-soup')).toEqual(ownRecipe('Red Soup', 2));
    expect(store.bySlug('grandmas-soup')).toBeUndefined();
    expect(storedRecipes()).toEqual([stored(ownRecipe('Red Soup', 2)), stored(QUICK_DAL)]);

    store = await reload();
    expect(store.own(), 'after a reload').toEqual([ownRecipe('Red Soup', 2), QUICK_DAL]);
  });

  it('removes "Quick Dal" from own(), all(), bySlug and fooplan.recipes, keeping the other own recipes in their order, also after a reload', async () => {
    store.add(ownRecipe("Grandma's Soup"));
    store.add(QUICK_DAL);
    store.add(PLAIN_RICE);

    store.remove('Quick Dal');
    expect(store.own()).toEqual([ownRecipe("Grandma's Soup"), PLAIN_RICE]);
    expect(store.all()).toEqual([...RECIPES, ownRecipe("Grandma's Soup"), PLAIN_RICE]);
    expect(store.bySlug('quick-dal')).toBeUndefined();
    expect(storedRecipes()).toEqual([stored(ownRecipe("Grandma's Soup")), stored(PLAIN_RICE)]);

    store = await reload();
    expect(store.own(), 'after a reload').toEqual([ownRecipe("Grandma's Soup"), PLAIN_RICE]);
  });

  describe('bySlug', () => {
    it('finds the recipe of every slug made from a recipe name', () => {
      for (const recipe of RECIPES) {
        expect(store.bySlug(recipeSlug(recipe.name)), recipe.name).toBe(recipe);
      }
      expect(store.bySlug('nicoise-salad')?.name).toBe('Niçoise salad');
    });

    it('finds no recipe for a slug no recipe has or an empty slug', () => {
      expect(RECIPES.length, 'no recipes loaded').toBeGreaterThan(0);
      expect(store.bySlug('nicoise-salad'), 'known slug').toBeDefined();
      expect(store.bySlug('pizza-hawaii')).toBeUndefined();
      expect(store.bySlug('shepherds-pie')).toBeUndefined();
      expect(store.bySlug('spaghetti')).toBeUndefined();
      expect(store.bySlug('')).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('adds a recipe when saving it fails, so it is there until the page is reloaded', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('quota exceeded', 'QuotaExceededError');
      });

      store.add(QUICK_DAL);
      expect(store.own()).toEqual([QUICK_DAL]);
      expect(store.all().at(-1)).toEqual(QUICK_DAL);
    });

    it('skips entries that are not recipes or hold values of the wrong type, and loads the others, one of them with exactly 30 ingredients', async () => {
      const valid = stored(QUICK_DAL);
      const thirty: Recipe = {
        name: 'Thirty spices',
        servings: 2,
        ingredients: ingredients(30),
        own: true,
      };
      localStorage.setItem(
        RECIPES_KEY,
        JSON.stringify([
          null,
          'Quick Dal',
          42,
          [valid],
          { ...valid, name: 12 },
          { ...valid, name: 'Text servings', servings: '4' },
          { ...valid, name: 'Half servings', servings: 2.5 },
          {
            ...valid,
            name: 'Ingredient object',
            ingredients: { name: 'rice', amount: 1, unit: 'g' },
          },
          {
            ...valid,
            name: 'Text amount',
            ingredients: [{ name: 'rice', amount: '200', unit: 'g' }],
          },
          { ...valid, name: 'Null ingredient', ingredients: [null] },
          stored(thirty),
          valid,
        ]),
      );

      expect((await reload()).own()).toEqual([thirty, QUICK_DAL]);
    });

    it('checks a stored name only against the entries kept before it, so an entry after a skipped one of the same name loads', async () => {
      localStorage.setItem(
        RECIPES_KEY,
        JSON.stringify([{ ...stored(QUICK_DAL), servings: 13 }, stored(QUICK_DAL)]),
      );

      expect((await reload()).own()).toEqual([QUICK_DAL]);
    });

    it('drops other keys of a stored ingredient', async () => {
      const valid = stored(QUICK_DAL);
      localStorage.setItem(
        RECIPES_KEY,
        JSON.stringify([
          {
            ...valid,
            ingredients: valid.ingredients.map((ingredient) => ({ ...ingredient, note: 'fresh' })),
          },
        ]),
      );

      expect((await reload()).own()).toStrictEqual([QUICK_DAL]);
    });
  });

  describe('German texts (#36)', () => {
    it('shows "Spaghetti pomodoro" as "Spaghetti Pomodoro" with its German steps in German and as it is in English, and an own recipe named like it as typed, with its own steps, in both', () => {
      const pomodoro = builtIn('Spaghetti pomodoro');
      const namedLikeIt: Recipe = {
        ...ownRecipe('Spaghetti pomodoro'),
        steps: ['Boil the pasta.', 'Add the sauce.', 'Serve.'],
      };
      const language = TestBed.inject(LanguageStore);

      language.set('de');
      expect(store.displayName(pomodoro)).toBe('Spaghetti Pomodoro');
      expect(store.displaySteps(pomodoro)?.[0]).toBe(
        'Einen großen Topf Salzwasser für die Spaghetti zum Kochen bringen.',
      );
      expect(store.displaySteps(pomodoro)).toHaveLength(pomodoro.steps!.length);
      expect(store.displayName(namedLikeIt)).toBe('Spaghetti pomodoro');
      expect(store.displaySteps(namedLikeIt)).toEqual(namedLikeIt.steps);

      language.set('en');
      expect(store.displayName(pomodoro)).toBe('Spaghetti pomodoro');
      expect(store.displaySteps(pomodoro)).toEqual(pomodoro.steps);
      expect(store.displayName(namedLikeIt)).toBe('Spaghetti pomodoro');
      expect(store.displaySteps(namedLikeIt)).toEqual(namedLikeIt.steps);
    });

    it('shows "garlic clove" as "Knoblauchzehe" and "bratwurst" as "Bratwürste" in German, and "mystery spice", which has no entry, and every name in English as it is', () => {
      const language = TestBed.inject(LanguageStore);

      language.set('de');
      expect(store.displayIngredient('garlic clove')).toBe('Knoblauchzehe');
      expect(store.displayIngredient('bratwurst')).toBe('Bratwürste');
      expect(store.displayIngredient('mystery spice')).toBe('mystery spice');

      language.set('en');
      expect(store.displayIngredient('garlic clove')).toBe('garlic clove');
      expect(store.displayIngredient('mystery spice')).toBe('mystery spice');
    });

    it('lists the ingredients of "Spaghetti pomodoro" under their German names in German, with their amounts and units, and the "onion" of an own recipe as typed; and both as they are in English', () => {
      const pomodoro = builtIn('Spaghetti pomodoro');
      const own = ownRecipe('Zwiebelkuchen');
      const language = TestBed.inject(LanguageStore);

      language.set('de');
      expect(store.displayIngredients(pomodoro)).toEqual(
        pomodoro.ingredients.map((ingredient) => ({
          ...ingredient,
          name: store.displayIngredient(ingredient.name),
        })),
      );
      expect(store.displayIngredients(pomodoro)[2]).toEqual({
        name: 'Knoblauchzehe',
        amount: 2,
        unit: 'pc',
      });
      expect(store.displayIngredients(own)).toEqual([{ name: 'onion', amount: 1, unit: 'pc' }]);

      language.set('en');
      expect(store.displayIngredients(pomodoro)).toEqual(pomodoro.ingredients);
      expect(store.displayIngredients(own)).toEqual(own.ingredients);
    });

    function builtIn(name: string): Recipe {
      const recipe = RECIPES.find((candidate) => candidate.name === name);
      expect(recipe, `no recipe "${name}"`).toBeDefined();
      return recipe!;
    }
  });

  describe('load (#44)', () => {
    it('replaces the own recipes with the ones saved since when loaded again, and is not ready while that load runs (#44 4)', async () => {
      storeOwnRecipes(QUICK_DAL);
      const loaded = unloaded();
      await loaded.load();
      expect(loaded.own(), 'first load').toEqual([QUICK_DAL]);
      expect(loaded.ready(), 'after the first load').toBe(true);
      storeOwnRecipes(PLAIN_RICE, ownRecipe("Grandma's Soup"));

      const loading = loaded.load();
      expect(loaded.ready(), 'during the load').toBe(false);
      await loading;
      expect(loaded.ready(), 'after the load').toBe(true);
      expect(loaded.own()).toEqual([PLAIN_RICE, ownRecipe("Grandma's Soup")]);
      expect(loaded.bySlug('plain-rice')).toEqual(PLAIN_RICE);
      expect(loaded.bySlug('quick-dal'), 'recipe no longer saved').toBeUndefined();
    });

    it('reads the backend once for two loads started before the first is done, which share one promise (#44 5a)', async () => {
      const read = vi.spyOn(LocalStorageBackend.prototype, 'read');
      const loaded = unloaded();

      const first = loaded.load();
      const second = loaded.load();
      expect(second).toBe(first);
      await Promise.all([first, second]);
      expect(read.mock.calls).toEqual([[RECIPES_KEY]]);
    });

    describe('edge cases', () => {
      it('holds no own recipe once loaded again after fooplan.recipes was removed (#44 4a)', async () => {
        storeOwnRecipes(QUICK_DAL);
        const loaded = unloaded();
        await loaded.load();
        localStorage.removeItem(RECIPES_KEY);

        await loaded.load();
        expect(loaded.own()).toEqual([]);
        expect(loaded.all()).toEqual(RECIPES);
      });

      it('reads nothing, holds no own recipe and is not ready before its first load (#44 4d)', () => {
        storeOwnRecipes(QUICK_DAL);
        const getItem = vi.spyOn(Storage.prototype, 'getItem');

        const created = unloaded();
        expect(created.ready()).toBe(false);
        expect(created.own()).toEqual([]);
        expect(created.bySlug('quick-dal')).toBeUndefined();
        expect(getItem.mock.calls.filter(([key]) => key === RECIPES_KEY)).toEqual([]);
      });

      it('ignores add, replace and remove before its first load: nothing is saved, and the load brings the saved recipes (#44 4f)', async () => {
        storeOwnRecipes(QUICK_DAL);
        const setItem = vi.spyOn(Storage.prototype, 'setItem');
        const created = unloaded();

        created.add(PLAIN_RICE);
        created.replace('Quick Dal', ownRecipe('Red Soup'));
        created.remove('Quick Dal');
        expect(created.own(), 'recipes changed').toEqual([]);
        expect(setItem).not.toHaveBeenCalled();

        await created.load();
        expect(created.own()).toEqual([QUICK_DAL]);
      });

      it('ignores an add while it loads again: nothing is saved, and the load brings the saved recipes (#44 4g)', async () => {
        storeOwnRecipes(QUICK_DAL);
        const loaded = unloaded();
        await loaded.load();
        const setItem = vi.spyOn(Storage.prototype, 'setItem');

        const loading = loaded.load();
        loaded.add(PLAIN_RICE);
        await loading;
        expect(setItem).not.toHaveBeenCalled();
        expect(loaded.own()).toEqual([QUICK_DAL]);
      });

      it('loads again after a load whose backend read threw at once (#44 5e)', async () => {
        storeOwnRecipes(QUICK_DAL);
        const loaded = unloaded({ provide: StorageBackend, useValue: new ThrowingOnceBackend() });

        await expect(loaded.load()).rejects.toThrow('not read');
        expect(loaded.ready(), 'ready after the failed load').toBe(false);
        await loaded.load();
        expect(loaded.ready()).toBe(true);
        expect(loaded.own()).toEqual([QUICK_DAL]);
      });

      it('reads again on a load() called as soon as a load has made the store ready (#44 5c)', async () => {
        const read = vi.spyOn(LocalStorageBackend.prototype, 'read');
        const loaded = unloaded();
        const first = loaded.load();
        for (let step = 0; step < 100 && !loaded.ready(); step++) {
          await Promise.resolve();
        }
        expect(loaded.ready(), 'not ready').toBe(true);

        const second = loaded.load();
        expect(second).not.toBe(first);
        await second;
        expect(read).toHaveBeenCalledTimes(2);
      });

      it('adds a recipe when the backend rejects the write, passes the recipes to it, and leaves no rejection unhandled (#44 7b)', async () => {
        const backend = new RejectingBackend();
        const loaded = unloaded({ provide: StorageBackend, useValue: backend });
        await loaded.load();

        const unhandled = await unhandledRejections(() => loaded.add(QUICK_DAL));
        expect(loaded.own()).toEqual([QUICK_DAL]);
        expect(backend.writes).toEqual([[RECIPES_KEY, [stored(QUICK_DAL)]]]);
        expect(unhandled).toEqual([]);
      });

      it('starts a new read on reload() while a load runs, applies only its result, and settles the earlier load once the store is ready (#45 4h)', async () => {
        const held = deferred<void>();
        const backend = new LocalStorageBackend();
        const read = vi
          .spyOn(backend, 'read')
          .mockImplementationOnce(() => held.promise.then(() => [stored(PLAIN_RICE)]));
        const loaded = unloaded({ provide: StorageBackend, useValue: backend });
        storeOwnRecipes(QUICK_DAL);

        const first = loaded.load();
        const second = loaded.reload();
        expect(second, 'a new load').not.toBe(first);
        await second;
        expect(read).toHaveBeenCalledTimes(2);
        expect(loaded.own()).toEqual([QUICK_DAL]);

        held.resolve();
        await first;
        expect(loaded.own(), 'after the earlier read ended').toEqual([QUICK_DAL]);
        expect(loaded.ready()).toBe(true);
      });

      it('settles an earlier load with the failure of the reload() that replaced it, rather than resolving while not ready (#45 4i)', async () => {
        const held = deferred<void>();
        const backend = new LocalStorageBackend();
        vi.spyOn(backend, 'read')
          .mockImplementationOnce(() => held.promise.then(() => []))
          .mockRejectedValueOnce(new Error('not read'));
        const loaded = unloaded({ provide: StorageBackend, useValue: backend });

        const first = loaded.load();
        await expect(loaded.reload()).rejects.toThrow('not read');
        held.resolve();
        await expect(first).rejects.toThrow('not read');
        expect(loaded.ready()).toBe(false);
      });

      it('reports a rejected write to SaveStatus as failed, and the next write that resolves as saved (#45 7b)', async () => {
        const backend = new RejectingBackend();
        const loaded = unloaded({ provide: StorageBackend, useValue: backend });
        await loaded.load();
        const status = TestBed.inject(SaveStatus);

        loaded.add(QUICK_DAL);
        await new Promise((resolve) => setTimeout(resolve));
        expect(status.failed(), 'after the rejected write').toBe(true);

        vi.spyOn(backend, 'write').mockResolvedValue();
        loaded.add(PLAIN_RICE);
        await new Promise((resolve) => setTimeout(resolve));
        expect(status.failed(), 'after the resolved write').toBe(false);
      });
    });

    // A fresh injector, as a page reload makes, with the store not loaded yet
    function unloaded(...providers: Provider[]): RecipeStore {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers });
      return TestBed.inject(RecipeStore);
    }
  });

  async function createStore(): Promise<RecipeStore> {
    TestBed.configureTestingModule({
      providers: [
        { provide: RANDOM, useValue: seededRandom(1) },
        { provide: TODAY, useValue: () => '2026-10-24' },
      ],
    });
    const created = TestBed.inject(RecipeStore);
    await created.load();
    return created;
  }

  // A fresh injector reading the same localStorage, as a page reload would
  function reload(): Promise<RecipeStore> {
    TestBed.resetTestingModule();
    return createStore();
  }

  function stored({ name, servings, ingredients }: Recipe) {
    return { name, servings, ingredients };
  }

  function storedRecipes(): unknown {
    return JSON.parse(localStorage.getItem(RECIPES_KEY) ?? 'null');
  }

  function ingredients(count: number): Ingredient[] {
    return Array.from({ length: count }, (_, i) => ({
      name: `spice ${i + 1}`,
      amount: 1,
      unit: 'g',
    }));
  }
});
