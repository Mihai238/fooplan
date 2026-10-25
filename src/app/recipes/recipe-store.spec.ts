import { TestBed } from '@angular/core/testing';
import { PlanStore, RANDOM, TODAY } from '../plan/plan-store';
import { seededRandom } from '../plan/testing';
import { checkRecipe } from './own-recipe';
import { Ingredient, Recipe } from './recipe';
import { recipeSlug } from './recipe-slug';
import { RecipeStore } from './recipe-store';
import { RECIPES } from './recipes';
import { ownRecipe, PLAIN_RICE, QUICK_DAL, RECIPES_KEY, storeOwnRecipes } from './testing';

describe('RecipeStore', () => {
  let store: RecipeStore;

  beforeEach(() => {
    localStorage.clear();
    store = createStore();
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

  it('keeps the own recipes after a reload and "New plan", saved in fooplan.recipes in the order added without `own`', () => {
    store.add(QUICK_DAL);
    store.add(PLAIN_RICE);
    const saved = [QUICK_DAL, PLAIN_RICE].map(({ name, servings, ingredients }) => ({
      name,
      servings,
      ingredients,
    }));
    expect(storedRecipes()).toEqual(saved);

    store = reload();
    expect(store.own(), 'after a reload').toEqual([QUICK_DAL, PLAIN_RICE]);
    TestBed.inject(PlanStore).newPlan();
    expect(store.own(), 'after "New plan"').toEqual([QUICK_DAL, PLAIN_RICE]);
    expect(storedRecipes(), 'saved after "New plan"').toEqual(saved);
  });

  it('loads only the valid entry from a list holding entries named "Spaghetti carbonara" or " Quick Dal", with 13 servings, 31 ingredients, the ingredient "Onion", the amount 1.234, the unit kg or no ingredients, and a second entry of the valid name', () => {
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

    expect(reload().own()).toEqual([QUICK_DAL]);
  });

  it('loads no own recipe from {} or text that is not JSON, where it loads a stored list', () => {
    storeOwnRecipes(QUICK_DAL);
    expect(reload().own(), 'stored list').toEqual([QUICK_DAL]);
    for (const text of ['{}', 'not json']) {
      localStorage.setItem(RECIPES_KEY, text);
      const reloaded = reload();
      expect(reloaded.own(), text).toEqual([]);
      expect(reloaded.all(), text).toEqual(RECIPES);
    }
  });

  it('keeps the amount 1.15 of an own recipe checked with the amount 1,15 after a reload', () => {
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

    expect(reload().own()).toEqual([
      { ...QUICK_DAL, ingredients: [{ name: 'onion', amount: 1.15, unit: 'pc' }] },
    ]);
  });

  it('loads an entry with an extra `steps` key as an own recipe without steps', () => {
    localStorage.setItem(
      RECIPES_KEY,
      JSON.stringify([{ ...stored(QUICK_DAL), steps: ['Cook the dal.', 'Serve it.'] }]),
    );

    expect(reload().own()).toStrictEqual([QUICK_DAL]);
  });

  it('finds the own recipe "Quick Dal" by the slug quick-dal once added and after a reload, and no recipe for no-such-dal', () => {
    store.add(QUICK_DAL);
    expect(store.bySlug('quick-dal')).toEqual(QUICK_DAL);
    expect(store.bySlug('no-such-dal')).toBeUndefined();

    store = reload();
    expect(store.bySlug('quick-dal'), 'after a reload').toEqual(QUICK_DAL);
    expect(store.bySlug('no-such-dal'), 'after a reload').toBeUndefined();
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

    it('skips entries that are not recipes or hold values of the wrong type, and loads the others, one of them with exactly 30 ingredients', () => {
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

      expect(reload().own()).toEqual([thirty, QUICK_DAL]);
    });

    it('checks a stored name only against the entries kept before it, so an entry after a skipped one of the same name loads', () => {
      localStorage.setItem(
        RECIPES_KEY,
        JSON.stringify([{ ...stored(QUICK_DAL), servings: 13 }, stored(QUICK_DAL)]),
      );

      expect(reload().own()).toEqual([QUICK_DAL]);
    });

    it('drops other keys of a stored ingredient', () => {
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

      expect(reload().own()).toStrictEqual([QUICK_DAL]);
    });
  });

  function createStore(): RecipeStore {
    TestBed.configureTestingModule({
      providers: [
        { provide: RANDOM, useValue: seededRandom(1) },
        { provide: TODAY, useValue: () => '2026-10-24' },
      ],
    });
    return TestBed.inject(RecipeStore);
  }

  // A fresh injector reading the same localStorage, as a page reload would
  function reload(): RecipeStore {
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
