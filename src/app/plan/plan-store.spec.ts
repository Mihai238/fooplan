import { computed } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { groceryList, itemKey } from '../groceries/groceries';
import { RecipeStore } from '../recipes/recipe-store';
import { RECIPES } from '../recipes/recipes';
import { PLAIN_RICE, QUICK_DAL, RECIPES_KEY, storeOwnRecipes } from '../recipes/testing';
import { addedKey, DEFAULT_DAYS, MealRef, Plan } from './plan';
import { PlanStore, RANDOM, TODAY } from './plan-store';
import {
  acceptOneDayPlan,
  covered,
  day,
  DINNER,
  leaveSuggested,
  LUNCH,
  open,
  picked,
  planOf,
  seededRandom,
  suggestionsOf,
} from './testing';

const STORAGE_KEY = 'fooplan.plan';
const REMOVED_KEY = 'fooplan.removed';
const NAMES = RECIPES.map((recipe) => recipe.name);

describe('PlanStore', () => {
  let today: string;
  let seed: number;
  let store: PlanStore;

  beforeEach(() => {
    localStorage.clear();
    today = '2026-10-24';
    seed = 1;
    store = createStore();
  });

  it('starts a plan for today with the default days when nothing is stored', () => {
    expectFreshPlan(store.plan(), '2026-10-24');
  });

  it('suggests three recipes for each of the 10 meals of a new 5-day plan, no recipe for two meals, all of them from the 33 quick recipes', () => {
    const plan = store.plan();
    expect(plan.days, 'days').toHaveLength(5);
    for (const planDay of plan.days) {
      expect(planDay.lunch.suggestions, `${planDay.date} lunch`).toHaveLength(3);
      expect(planDay.dinner.suggestions, `${planDay.date} dinner`).toHaveLength(3);
    }
    const suggestions = suggestionsOf(plan);
    expect(new Set(suggestions).size, 'different recipes suggested').toBe(30);
    const quick = RECIPES.filter(
      (recipe) => recipe.workMinutes! <= 30 && recipe.minutes! <= 45,
    ).map((recipe) => recipe.name);
    expect(suggestions.filter((name) => !quick.includes(name))).toEqual([]);
    expect(quick, 'quick recipes').toHaveLength(33);
  });

  it('brings the 3 recipes a new 5-day plan does not show on the first "Other suggestions", and only recipes shown earlier on the second', () => {
    const shownAtStart = suggestionsOf(store.plan());
    const notShown = RECIPES.map((recipe) => recipe.name).filter(
      (name) => !shownAtStart.includes(name),
    );
    expect(notShown, 'recipes not shown at the start').toHaveLength(3);

    store.otherSuggestions(LUNCH);
    expect([...store.plan().days[0].lunch.suggestions].sort()).toEqual([...notShown].sort());

    store.otherSuggestions(LUNCH);
    const second = store.plan().days[0].lunch.suggestions;
    expect(second, 'suggestions after the second click').toHaveLength(3);
    expect(second.filter((name) => !shownAtStart.includes(name))).toEqual([]);
  });

  it('shows the same fresh plan after a reload without any change', () => {
    const before = store.plan();
    expect(reload().plan()).toEqual(before);
  });

  it('shows the same days, people, picks and suggestions of a plan in progress after a reload', () => {
    store.setDays(2);
    store.setPeople(3);
    pickFirstSuggestion(LUNCH);
    const before = store.plan();
    expect(before.days, 'days not set').toHaveLength(2);

    expect(reload().plan()).toEqual(before);
  });

  it('shows an accepted plan as accepted after a reload', () => {
    acceptOneDayPlan(store);
    const before = store.plan();

    expect(reload().plan()).toEqual(before);
  });

  it('turns on "Cook extra" for a dinner, covering the next lunch, and keeps it after a reload', () => {
    store.setDays(2);
    pickFirstSuggestion(DINNER);
    store.setCookExtra(0, true);
    const before = store.plan();
    expect(before.days[0].cookExtra).toBe(true);
    expect(before.days[1].lunch).toEqual({ recipe: null, suggestions: [] });

    expect(reload().plan()).toEqual(before);
  });

  it('does not suggest the recipes a plan has shown again after a reload, while recipes not shown yet are left', () => {
    const names = RECIPES.map((recipe) => recipe.name);
    const saved: Plan = {
      days: [day('2026-10-24', open(...names.slice(0, 3)), open(...names.slice(3, 6)))],
      people: 2,
      accepted: false,
      ticked: [],
      added: [],
      shown: names.slice(0, 6),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    store = reload();
    expect(store.plan(), 'saved plan not loaded').toEqual(saved);

    // 27 of the 33 recipes start unshown, enough for 3 new ones on each of the 8 clicks
    clickOtherSuggestions(1, 3);
    const before = store.plan();
    store = reload();
    expect(store.plan()).toEqual(before);
    clickOtherSuggestions(4, 8);
    expect(store.plan().shown).toHaveLength(30);

    function clickOtherSuggestions(first: number, last: number) {
      for (let click = first; click <= last; click++) {
        const seen = store.plan().shown;
        store.otherSuggestions(LUNCH);
        const suggestions = store.plan().days[0].lunch.suggestions;
        expect(
          suggestions.filter((name) => seen.includes(name)),
          `click ${click}: ${suggestions.join(', ')}`,
        ).toEqual([]);
        expect(store.plan().shown, `shown after click ${click}`).toHaveLength(6 + 3 * click);
      }
    }
  });

  it('opens a picked meal with the suggestions it showed when picked, in the same order, on "Undo" after a reload', () => {
    const suggestions = store.plan().days[0].lunch.suggestions;
    pickFirstSuggestion(LUNCH);

    store = reload();
    expect(store.plan().days[0].lunch.recipe, 'pick lost on reload').toBe(suggestions[0]);
    store.clear(LUNCH);
    expect(store.plan().days[0].lunch).toEqual({ recipe: null, suggestions });
  });

  it('loads a plan saved before picked meals remembered their suggestions with its days, picks and accepted state, and opens such a meal with three unpicked suggestions on "Undo"', () => {
    const [lunch, dinner, other, ...rest] = RECIPES.map((recipe) => recipe.name);
    const saved = {
      days: [
        {
          date: '2026-10-20',
          lunch: { recipe: lunch, suggestions: [] },
          dinner: { recipe: null, suggestions: rest.slice(0, 3) },
          cookExtra: false,
        },
        {
          date: '2026-10-21',
          lunch: { recipe: dinner, suggestions: [] },
          dinner: { recipe: other, suggestions: [] },
          cookExtra: false,
        },
      ],
      people: 3,
      accepted: false,
      ticked: [],
      added: [],
      shown: [lunch, dinner, other, ...rest.slice(0, 3)],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

    store = reload();
    expect(store.plan()).toEqual(saved);
    store.clear(LUNCH);
    const suggestions = store.plan().days[0].lunch.suggestions;
    expect(store.plan().days[0].lunch.recipe).toBeNull();
    expect(suggestions).toHaveLength(3);
    expect(new Set(suggestions).size, suggestions.join(', ')).toBe(3);
    expect(suggestions.filter((name) => [dinner, other].includes(name))).toEqual([]);

    const accepted = {
      ...saved,
      days: [{ ...saved.days[1], date: '2026-10-20' }],
      accepted: true,
      shown: [dinner, other],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accepted));
    expect(reload().plan()).toEqual(accepted);
  });

  it('keeps the start date of a stored plan when reloaded on a later day', () => {
    store.setDays(2);
    const before = store.plan();
    expect(before.days, 'days not set').toHaveLength(2);
    today = '2026-10-27';

    expect(reload().plan()).toEqual(before);
  });

  it('starts a fresh plan for today when the stored plan is not valid JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{"days": [');
    expectFreshPlan(reload().plan(), '2026-10-24');
  });

  it('starts a fresh plan for today when the stored plan names a recipe that does not exist', () => {
    const plan: Plan = {
      days: [
        {
          date: '2026-10-20',
          lunch: { recipe: 'Pizza Hawaii', suggestions: [] },
          dinner: {
            recipe: null,
            suggestions: [RECIPES[0].name, RECIPES[1].name, RECIPES[2].name],
          },
          cookExtra: false,
        },
      ],
      people: 2,
      accepted: false,
      ticked: [],
      added: [],
      shown: [],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
    expectFreshPlan(reload().plan(), '2026-10-24');
  });

  it('starts a fresh plan for today on "New plan" and saves it', () => {
    acceptOneDayPlan(store);
    today = '2026-10-26';

    store.newPlan();
    expectFreshPlan(store.plan(), '2026-10-26');
    expect(reload().plan()).toEqual(store.plan());
  });

  it('forgets the recipes the old plan has shown on "New plan", so only the new suggestions count as shown', () => {
    for (let click = 0; click < 20; click++) {
      store.otherSuggestions(LUNCH);
    }

    store.newPlan();
    expectFreshPlan(store.plan(), '2026-10-24');
    expect([...store.plan().shown].sort()).toEqual([...suggestionsOf(store.plan())].sort());
  });

  it('keeps the people on "New plan"', () => {
    store.setPeople(4);
    acceptOneDayPlan(store);

    store.newPlan();
    expect(store.plan().accepted).toBe(false);
    expect(store.plan().people).toBe(4);
  });

  it('keeps a ticked grocery item ticked after a reload', () => {
    acceptOneDayPlan(store);
    const key = firstItemKey();
    store.toggleTicked(key);
    expect(store.plan().ticked, 'item not ticked').toEqual([key]);

    expect(reload().plan().ticked).toEqual([key]);
  });

  it('starts "New plan" not accepted with nothing ticked, and nothing ticked after a reload or once the next plan is accepted', () => {
    acceptOneDayPlan(store);
    store.toggleTicked(firstItemKey());
    expect(store.plan().ticked, 'item not ticked').toHaveLength(1);

    store.newPlan();
    expect(store.plan().ticked).toEqual([]);
    expect(store.plan().accepted).toBe(false);
    store = reload();
    expect(store.plan().ticked).toEqual([]);
    acceptOneDayPlan(store);
    expect(store.plan().ticked).toEqual([]);
  });

  it('keeps the added items, in their order, and their ticks after a reload', () => {
    acceptOneDayPlan(store);
    store.addItem('toilet paper');
    store.addItem('coffee');
    store.addItem('2 l milk');
    const ticked = [addedKey('coffee'), firstItemKey()];
    ticked.forEach((key) => store.toggleTicked(key));
    expect(store.plan().added, 'items not added').toEqual(['toilet paper', 'coffee', '2 l milk']);
    expect(store.plan().ticked, 'items not ticked').toEqual(ticked);

    store = reload();
    expect(store.plan().added).toEqual(['toilet paper', 'coffee', '2 l milk']);
    expect(store.plan().ticked).toEqual(ticked);
  });

  it('starts "New plan" without the added items, and none after a reload or once the next plan is accepted', () => {
    acceptOneDayPlan(store);
    store.addItem('toilet paper');
    store.addItem('coffee');
    store.toggleTicked(addedKey('coffee'));
    expect(store.plan().added, 'items not added').toHaveLength(2);

    store.newPlan();
    expect(store.plan().added).toEqual([]);
    expect(store.plan().ticked).toEqual([]);
    store = reload();
    expect(store.plan().added).toEqual([]);
    acceptOneDayPlan(store);
    expect(store.plan().added).toEqual([]);
  });

  describe('own recipes', () => {
    it('suggests the own recipe "Quick Dal" on the next "Other suggestions" once added, leaving an unaccepted plan that has shown every built-in recipe unchanged until then, and an accepted plan unchanged', () => {
      const saved: Plan = {
        ...planOf([
          day(
            '2026-10-24',
            open('Lentil soup', 'Pumpkin soup', 'Fish tacos'),
            open('Spaghetti carbonara', 'Niçoise salad', 'Bean burritos'),
          ),
        ]),
        shown: NAMES,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
      store = reload();
      expect(store.plan(), 'saved plan not loaded').toEqual(saved);

      recipes().add(QUICK_DAL);
      expect(store.plan(), 'after adding "Quick Dal"').toEqual(saved);
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toEqual(saved);
      store.otherSuggestions(LUNCH);
      expect(store.plan().days[0].lunch.suggestions).toContain('Quick Dal');

      localStorage.clear();
      store = reload();
      acceptOneDayPlan(store);
      const accepted = store.plan();
      const stored = localStorage.getItem(STORAGE_KEY);
      recipes().add(PLAIN_RICE);
      expect(store.plan(), 'accepted plan after adding "Plain Rice"').toEqual(accepted);
      expect(localStorage.getItem(STORAGE_KEY)).toBe(stored);
    });

    it('loads a saved plan that picked the own recipe "Quick Dal" with the pick after a reload', () => {
      storeOwnRecipes(QUICK_DAL);
      const saved = planOf([
        day(
          '2026-10-24',
          picked('Quick Dal', ['Lentil soup', 'Quick Dal', 'Pumpkin soup']),
          open('Spaghetti carbonara', 'Niçoise salad', 'Fish tacos'),
        ),
      ]);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

      expect(reload().plan()).toEqual(saved);
    });

    it('changes nothing on removeRecipe("Quick Dal") while it is one of exactly 15 recipes suggested, and lets it be removed once another own recipe is added', () => {
      recipes().add(QUICK_DAL);
      leaveSuggested(store, 15, 'Quick Dal');
      expect(store.canRemove(), 'can remove at 15 suggested').toBe(false);
      const before = snapshot();

      store.removeRecipe('Quick Dal');
      expect(snapshot()).toEqual(before);

      recipes().add(PLAIN_RICE);
      expect(store.canRemove(), 'can remove after adding "Plain Rice"').toBe(true);
      store.removeRecipe('Quick Dal');
      expect(store.removed()).toContain('Quick Dal');
    });

    it('reads a saved list of removed recipes that leaves 14 built-in recipes and the own recipe "Quick Dal" suggested', () => {
      storeOwnRecipes(QUICK_DAL);
      const removals = NAMES.slice(14);
      localStorage.setItem(REMOVED_KEY, JSON.stringify(removals));

      expect(reload().removed()).toEqual(removals);
    });

    describe('editing and deleting', () => {
      it('changes nothing on deleteRecipe("Quick Dal") and tells "picked" from deleteBlock while it is picked in an unaccepted plan or as a dinner cooked extra there, null once the pick is undone, and "accepted" while it is picked in an accepted plan', () => {
        storeOwnRecipes(QUICK_DAL);
        load(
          planOf([
            day(
              '2026-10-24',
              picked('Quick Dal', ['Lentil soup', 'Quick Dal', 'Pumpkin soup']),
              open('Spaghetti carbonara', 'Niçoise salad', 'Fish tacos'),
            ),
          ]),
        );
        expect(store.deleteBlock('Quick Dal'), 'picked for a lunch').toBe('picked');
        expectNotDeleted(() => store.deleteRecipe('Quick Dal'));
        store.clear(LUNCH);
        expect(store.plan().days[0].lunch.recipe, 'pick not undone').toBeNull();
        expect(store.deleteBlock('Quick Dal'), 'pick undone').toBeNull();

        load(
          planOf([
            day(
              '2026-10-24',
              open('Lentil soup', 'Pumpkin soup', 'Fish tacos'),
              picked('Quick Dal'),
              true,
            ),
            day(
              '2026-10-25',
              covered(),
              open('Spaghetti carbonara', 'Niçoise salad', 'Bean burritos'),
            ),
          ]),
        );
        expect(store.deleteBlock('Quick Dal'), 'dinner cooked extra').toBe('picked');
        expectNotDeleted(() => store.deleteRecipe('Quick Dal'));

        load(
          planOf([day('2026-10-24', picked('Quick Dal'), picked('Lentil soup'))], {
            accepted: true,
          }),
        );
        expect(store.deleteBlock('Quick Dal'), 'accepted plan').toBe('accepted');
        expectNotDeleted(() => store.deleteRecipe('Quick Dal'));
      });

      it('changes neither fooplan.recipes, the plan nor the removed recipes on deleteRecipe("Quick Dal") and tells "limit" from deleteBlock while it is one of exactly 15 recipes suggested and not picked, and null while it is removed instead', () => {
        storeOwnRecipes(QUICK_DAL);
        store = reload();
        leaveSuggested(store, 15, 'Quick Dal');
        expect(store.deleteBlock('Quick Dal')).toBe('limit');
        expectNotDeleted(() => store.deleteRecipe('Quick Dal'));

        localStorage.clear();
        storeOwnRecipes(QUICK_DAL);
        store = reload();
        leaveSuggested(store, 15);
        expect(store.removed(), 'Quick Dal not removed').toContain('Quick Dal');
        expect(store.deleteBlock('Quick Dal')).toBeNull();
      });

      it('renames "Quick Dal", picked and second in the removed recipes, to "Daily Dal" in the plan and in its place in the removed recipes on renameRecipe after RecipeStore.replace, and loads both unchanged after a reload', () => {
        storeOwnRecipes(QUICK_DAL);
        localStorage.setItem(
          REMOVED_KEY,
          JSON.stringify(['Lentil soup', 'Quick Dal', 'Fish tacos']),
        );
        load(
          planOf([
            day(
              '2026-10-24',
              picked('Quick Dal', ['Pumpkin soup', 'Quick Dal', 'Bean burritos']),
              open('Spaghetti carbonara', 'Niçoise salad', 'Potato goulash'),
            ),
          ]),
        );
        expect(store.removed(), 'removed recipes not loaded').toEqual([
          'Lentil soup',
          'Quick Dal',
          'Fish tacos',
        ]);
        const before = store.plan();

        recipes().replace('Quick Dal', { ...QUICK_DAL, name: 'Daily Dal' });
        store.renameRecipe('Quick Dal', 'Daily Dal');
        const expected: Plan = {
          ...before,
          days: [
            {
              ...before.days[0],
              lunch: picked('Daily Dal', ['Pumpkin soup', 'Daily Dal', 'Bean burritos']),
            },
          ],
          shown: before.shown.map((name) => (name === 'Quick Dal' ? 'Daily Dal' : name)),
        };
        expect(store.plan()).toEqual(expected);
        expect(store.removed()).toEqual(['Lentil soup', 'Daily Dal', 'Fish tacos']);
        expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toEqual(expected);

        store = reload();
        expect(store.plan(), 'plan after a reload').toEqual(expected);
        expect(store.removed(), 'removed after a reload').toEqual([
          'Lentil soup',
          'Daily Dal',
          'Fish tacos',
        ]);
      });

      it('deletes "Quick Dal", not picked and removed, from the own recipes, fooplan.recipes, the removed recipes and the plan\'s shown recipes and remembered suggestions on deleteRecipe, saving each', () => {
        storeOwnRecipes(QUICK_DAL, PLAIN_RICE);
        localStorage.setItem(REMOVED_KEY, JSON.stringify(['Lentil soup', 'Quick Dal']));
        load(
          planOf([
            day(
              '2026-10-24',
              picked('Pumpkin soup', ['Pumpkin soup', 'Quick Dal', 'Fish tacos']),
              open('Spaghetti carbonara', 'Niçoise salad', 'Potato goulash'),
            ),
          ]),
        );
        expect(store.deleteBlock('Quick Dal')).toBeNull();

        store.deleteRecipe('Quick Dal');
        expect(recipes().own()).toEqual([PLAIN_RICE]);
        expect(JSON.parse(localStorage.getItem(RECIPES_KEY) ?? 'null')).toEqual([
          {
            name: PLAIN_RICE.name,
            servings: PLAIN_RICE.servings,
            ingredients: PLAIN_RICE.ingredients,
          },
        ]);
        expect(store.removed()).toEqual(['Lentil soup']);
        expect(JSON.parse(localStorage.getItem(REMOVED_KEY) ?? 'null')).toEqual(['Lentil soup']);
        expect(store.plan().days[0].lunch).toEqual(picked('Pumpkin soup'));
        expect(JSON.stringify(store.plan())).not.toContain('Quick Dal');
        expect(localStorage.getItem(STORAGE_KEY)).not.toContain('Quick Dal');
      });

      it('loads the plan saved without "Quick Dal", and "Quick Dal" still removed, after a reload when saving fooplan.recipes, and every write after it, fails on deleteRecipe', () => {
        storeOwnRecipes(QUICK_DAL, PLAIN_RICE);
        localStorage.setItem(REMOVED_KEY, JSON.stringify(['Quick Dal']));
        load(
          planOf([
            day(
              '2026-10-24',
              picked('Pumpkin soup', ['Pumpkin soup', 'Quick Dal', 'Fish tacos']),
              open('Spaghetti carbonara', 'Lentil soup', 'Penne arrabbiata'),
            ),
          ]),
        );
        const setItem = Storage.prototype.setItem;
        let full = false;
        const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
          this: Storage,
          key: string,
          value: string,
        ) {
          full ||= key === RECIPES_KEY;
          if (full) {
            throw new DOMException('quota exceeded', 'QuotaExceededError');
          }
          setItem.call(this, key, value);
        });

        try {
          store.deleteRecipe('Quick Dal');
        } finally {
          spy.mockRestore();
        }
        expect(full, 'fooplan.recipes not written').toBe(true);
        expect(store.removed()).toEqual([]);
        const deleted = store.plan();
        expect(JSON.stringify(deleted)).not.toContain('Quick Dal');

        store = reload();
        expect(recipes().own()).toEqual([QUICK_DAL, PLAIN_RICE]);
        expect(store.removed()).toEqual(['Quick Dal']);
        expect(store.plan()).toEqual(deleted);
      });

      describe('edge cases', () => {
        it('tells "picked" from deleteBlock for "Quick Dal" picked while exactly 15 recipes are suggested, and "accepted" once the plan is accepted', () => {
          storeOwnRecipes(QUICK_DAL);
          load(
            planOf([
              day(
                '2026-10-24',
                picked('Quick Dal', ['Lentil soup', 'Quick Dal', 'Pumpkin soup']),
                open('Spaghetti carbonara', 'Niçoise salad', 'Fish tacos'),
              ),
            ]),
          );
          leaveSuggested(
            store,
            15,
            'Quick Dal',
            'Spaghetti carbonara',
            'Niçoise salad',
            'Fish tacos',
          );
          expect(store.canRemove(), 'limit not reached').toBe(false);
          expect(store.deleteBlock('Quick Dal')).toBe('picked');

          store.pick(DINNER, 'Spaghetti carbonara');
          store.accept();
          expect(store.plan().accepted, 'plan not accepted').toBe(true);
          expect(store.deleteBlock('Quick Dal')).toBe('accepted');
          expectNotDeleted(() => store.deleteRecipe('Quick Dal'));
        });

        it('deletes the removed "Quick Dal" while exactly 15 recipes are suggested, leaving 15 suggested', () => {
          storeOwnRecipes(QUICK_DAL);
          store = reload();
          const suggested = leaveSuggested(store, 15);
          expect(store.removed(), 'Quick Dal not removed').toContain('Quick Dal');

          store.deleteRecipe('Quick Dal');
          expect(recipes().own()).toEqual([]);
          expect(store.removed()).not.toContain('Quick Dal');
          expect(suggestedNames()).toEqual(suggested);
        });

        it('deletes "Quick Dal" while it is one of 16 recipes suggested, leaving 15 suggested and telling "limit" for the own recipe "Plain Rice" among them', () => {
          storeOwnRecipes(QUICK_DAL, PLAIN_RICE);
          store = reload();
          const suggested = leaveSuggested(store, 16, 'Quick Dal', 'Plain Rice');
          expect(store.deleteBlock('Quick Dal')).toBeNull();

          store.deleteRecipe('Quick Dal');
          expect(recipes().own()).toEqual([PLAIN_RICE]);
          expect(suggestedNames()).toEqual(suggested.filter((name) => name !== 'Quick Dal'));
          expect(store.deleteBlock('Plain Rice')).toBe('limit');
        });

        it('turns deleteBlock("Quick Dal") read in a computed from "limit" to null when another own recipe is added', () => {
          storeOwnRecipes(QUICK_DAL);
          store = reload();
          leaveSuggested(store, 15, 'Quick Dal');
          const block = computed(() => store.deleteBlock('Quick Dal'));
          expect(block()).toBe('limit');

          recipes().add(PLAIN_RICE);
          expect(block()).toBeNull();
        });

        it('replaces a suggestion of the deleted "Quick Dal" with a recipe neither removed nor "Quick Dal", in its place, and saves the plan', () => {
          storeOwnRecipes(QUICK_DAL);
          const removed = NAMES.slice(20);
          localStorage.setItem(REMOVED_KEY, JSON.stringify(removed));
          // Every recipe still suggested has been shown, so a draw among all recipes would take a
          // removed one, never shown
          load({
            ...planOf([
              day(
                '2026-10-24',
                open('Lentil soup', 'Quick Dal', 'Pumpkin soup'),
                open('Spaghetti carbonara', 'Fish tacos', 'Penne arrabbiata'),
              ),
            ]),
            shown: [...NAMES.slice(0, 20), 'Quick Dal'],
          });
          expect(store.removed(), 'removed recipes not loaded').toEqual(removed);

          store.deleteRecipe('Quick Dal');
          const [first, replacement, last] = store.plan().days[0].lunch.suggestions;
          expect([first, last]).toEqual(['Lentil soup', 'Pumpkin soup']);
          expect(NAMES.slice(0, 20)).toContain(replacement);
          expect(['Spaghetti carbonara', 'Fish tacos', 'Penne arrabbiata']).not.toContain(
            replacement,
          );
          expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toEqual(store.plan());
        });
      });

      function load(plan: Plan) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
        store = reload();
        expect(store.plan(), 'saved plan not loaded').toEqual(plan);
      }

      function expectNotDeleted(change: () => void) {
        const before = snapshot();
        const own = recipes().own();
        change();
        expect(snapshot()).toEqual(before);
        expect(recipes().own()).toEqual(own);
      }

      function suggestedNames(): string[] {
        return recipes()
          .all()
          .map((recipe) => recipe.name)
          .filter((name) => !store.removed().includes(name));
      }
    });

    function recipes(): RecipeStore {
      return TestBed.inject(RecipeStore);
    }

    function snapshot() {
      return {
        plan: store.plan(),
        removed: store.removed(),
        storedPlan: localStorage.getItem(STORAGE_KEY),
        storedRemoved: localStorage.getItem(REMOVED_KEY),
        storedRecipes: localStorage.getItem(RECIPES_KEY),
      };
    }
  });

  describe('recipes not suggested', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('suggests only the 15 recipes left suggested in a new plan, after "Other suggestions", changing the days, picks and "Cook extra"', () => {
      const suggested = leaveSuggested(store, 15);
      const expectOnlySuggested = (step: string) =>
        expect(
          suggestionsOf(store.plan()).filter((name) => !suggested.includes(name)),
          step,
        ).toEqual([]);

      store.newPlan();
      expectOnlySuggested('new plan');
      for (const meal of mealRefs()) {
        for (let click = 1; click <= 5; click++) {
          store.otherSuggestions(meal);
          expectOnlySuggested(`day ${meal.day} ${meal.kind}, "Other suggestions" ${click}`);
        }
      }
      store.setDays(1);
      expectOnlySuggested('1 day');
      store.setDays(5);
      expectOnlySuggested('5 days again');
      for (const meal of mealRefs().slice(0, -1)) {
        pickFirstSuggestion(meal);
        expectOnlySuggested(`picked day ${meal.day} ${meal.kind}`);
      }
      store.setCookExtra(0, true);
      expect(store.plan().days[0].cookExtra, '"Cook extra" not on').toBe(true);
      expectOnlySuggested('"Cook extra" on');
      store.setCookExtra(0, false);
      expect(store.plan().days[1].lunch.suggestions, 'lunch not reopened').toHaveLength(3);
      expectOnlySuggested('"Cook extra" off');
    });

    it('suggests a recipe brought back with restoreRecipe in a new plan', () => {
      leaveSuggested(store, 15);
      expect(store.removed(), 'Lentil soup not removed').toContain('Lentil soup');

      store.restoreRecipe('Lentil soup');
      store.newPlan();
      expect(suggestionsOf(store.plan())).toContain('Lentil soup');
    });

    it('keeps a plan with a pick of a removed recipe, and a meal remembering it among the suggestions it showed, unchanged after a reload', () => {
      const saved = planOf([
        day(
          '2026-10-24',
          picked('Lentil soup', ['Pumpkin soup', 'Lentil soup', 'Fish tacos']),
          picked('Spaghetti carbonara', ['Lentil soup', 'Spaghetti carbonara', 'Niçoise salad']),
        ),
        day(
          '2026-10-25',
          open('Bean burritos', 'Potato goulash', 'Chicken fajitas'),
          picked('Mac and cheese'),
        ),
      ]);
      load(saved);

      store.removeRecipe('Lentil soup');
      store = reload();
      expect(store.removed(), 'Lentil soup not removed after the reload').toEqual(['Lentil soup']);
      expect(store.plan()).toEqual(saved);
    });

    it('keeps a pick of a removed recipe, and leaves an accepted plan unchanged', () => {
      load(
        planOf([
          day(
            '2026-10-24',
            picked('Lentil soup'),
            open('Spaghetti carbonara', 'Niçoise salad', 'Pumpkin soup'),
          ),
        ]),
      );
      store.removeRecipe('Lentil soup');
      expect(store.removed(), 'Lentil soup not removed').toEqual(['Lentil soup']);
      expect(store.plan().days[0].lunch).toEqual(picked('Lentil soup'));

      localStorage.clear();
      const accepted = planOf(
        [day('2026-10-24', picked('Lentil soup'), picked('Spaghetti carbonara'))],
        { accepted: true },
      );
      load(accepted);
      store.removeRecipe('Lentil soup');
      expect(store.removed(), 'Lentil soup not removed from an accepted plan').toEqual([
        'Lentil soup',
      ]);
      expect(store.plan()).toEqual(accepted);
    });

    it('brings back the other suggestions in their places on "Undo" of a meal that picked one of them, and another recipe not removed where the removed one was', () => {
      load(
        planOf([
          day(
            '2026-10-24',
            open('Lentil soup', 'Spaghetti carbonara', 'Niçoise salad'),
            open('Pumpkin soup', 'Fish tacos', 'Bean burritos'),
          ),
        ]),
      );
      store.pick(LUNCH, 'Spaghetti carbonara');
      store.removeRecipe('Lentil soup');
      expect(store.removed(), 'Lentil soup not removed').toEqual(['Lentil soup']);

      store.clear(LUNCH);
      expectReopenedWithout('Lentil soup');
    });

    it('brings back the other suggestions in their places on "Undo" of a meal that picked the removed recipe, and another recipe not removed in its place', () => {
      load(
        planOf([
          day(
            '2026-10-24',
            open('Lentil soup', 'Spaghetti carbonara', 'Niçoise salad'),
            open('Pumpkin soup', 'Fish tacos', 'Bean burritos'),
          ),
        ]),
      );
      store.pick(LUNCH, 'Lentil soup');
      store.removeRecipe('Lentil soup');
      expect(store.removed(), 'Lentil soup not removed').toEqual(['Lentil soup']);
      expect(store.plan().days[0].lunch.recipe, 'pick lost').toBe('Lentil soup');

      store.clear(LUNCH);
      expectReopenedWithout('Lentil soup');
    });

    it("leaves the suggestions shown as they are when a removed recipe is brought back, and changes nothing when bringing back one that isn't removed or removing an unknown or removed one", () => {
      store.removeRecipe('Lentil soup');
      expect(store.removed(), 'Lentil soup not removed').toEqual(['Lentil soup']);
      const plan = store.plan();

      store.restoreRecipe('Lentil soup');
      expect(store.removed()).toEqual([]);
      expect(store.plan()).toEqual(plan);

      store.removeRecipe('Pumpkin soup');
      expect(store.removed(), 'Pumpkin soup not removed').toEqual(['Pumpkin soup']);
      const before = saved();
      store.restoreRecipe('Lentil soup');
      expect(saved(), 'after bringing back Lentil soup').toEqual(before);
      store.removeRecipe('Imaginary stew');
      expect(saved(), 'after removing Imaginary stew').toEqual(before);
      store.removeRecipe('Pumpkin soup');
      expect(saved(), 'after removing Pumpkin soup again').toEqual(before);
    });

    it('changes nothing when removing a recipe while exactly 15 are suggested', () => {
      const suggested = leaveSuggested(store, 15);
      const before = saved();

      store.removeRecipe(suggested[0]);
      expect(saved()).toEqual(before);
    });

    it('keeps the removed recipes, saved in the order removed, after a reload and "New plan", and reads a saved list without unknown names and duplicates, or as empty when it is not a list of names or leaves fewer than 15 suggested', () => {
      store.removeRecipe('Pumpkin soup');
      store.removeRecipe('Lentil soup');
      expect(store.removed()).toEqual(['Pumpkin soup', 'Lentil soup']);
      expect(storedRemoved()).toEqual(['Pumpkin soup', 'Lentil soup']);
      store = reload();
      expect(store.removed(), 'after a reload').toEqual(['Pumpkin soup', 'Lentil soup']);
      store.newPlan();
      expect(store.removed(), 'after "New plan"').toEqual(['Pumpkin soup', 'Lentil soup']);
      expect(storedRemoved(), 'saved after "New plan"').toEqual(['Pumpkin soup', 'Lentil soup']);

      localStorage.setItem(
        REMOVED_KEY,
        JSON.stringify(['Lentil soup', 'Imaginary stew', 'Lentil soup']),
      );
      expect(reload().removed(), 'unknown name and duplicate').toEqual(['Lentil soup']);
      localStorage.setItem(REMOVED_KEY, '{}');
      expect(reload().removed(), '{}').toEqual([]);
      localStorage.setItem(REMOVED_KEY, JSON.stringify(NAMES.slice(14)));
      expect(reload().removed(), 'leaving 14 suggested').toEqual([]);
    });

    it('saves the removed recipes without one brought back, the others in their order, and with it last when it is removed again', () => {
      store.removeRecipe('Pumpkin soup');
      store.removeRecipe('Lentil soup');
      store.removeRecipe('Fish tacos');
      store.restoreRecipe('Lentil soup');
      expect(storedRemoved()).toEqual(['Pumpkin soup', 'Fish tacos']);
      store = reload();
      expect(store.removed(), 'after a reload').toEqual(['Pumpkin soup', 'Fish tacos']);

      store.removeRecipe('Lentil soup');
      expect(store.removed()).toEqual(['Pumpkin soup', 'Fish tacos', 'Lentil soup']);
      expect(storedRemoved()).toEqual(['Pumpkin soup', 'Fish tacos', 'Lentil soup']);
    });

    it('saves the plan with the replacement of a removed suggestion, so a reload shows it', () => {
      load(
        planOf([
          day(
            '2026-10-24',
            open('Spaghetti carbonara', 'Lentil soup', 'Niçoise salad'),
            open('Pumpkin soup', 'Fish tacos', 'Bean burritos'),
          ),
        ]),
      );
      store.removeRecipe('Lentil soup');
      const after = store.plan();
      expect(after.days[0].lunch.suggestions[1], 'Lentil soup not replaced').not.toBe(
        'Lentil soup',
      );

      expect(reload().plan()).toEqual(after);
    });

    it('replaces a removed recipe still suggested by the saved plan when loading it, keeps the other suggestions in their places and saves the plan with the replacement', () => {
      localStorage.setItem(REMOVED_KEY, JSON.stringify(['Lentil soup']));
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          planOf([
            day(
              '2026-10-24',
              open('Spaghetti carbonara', 'Lentil soup', 'Niçoise salad'),
              open('Pumpkin soup', 'Fish tacos', 'Bean burritos'),
            ),
          ]),
        ),
      );

      store = reload();
      const [lunch, dinner] = [store.plan().days[0].lunch, store.plan().days[0].dinner];
      expect(lunch.suggestions[0]).toBe('Spaghetti carbonara');
      expect(lunch.suggestions[1]).not.toBe('Lentil soup');
      expect(NAMES).toContain(lunch.suggestions[1]);
      expect(lunch.suggestions[2]).toBe('Niçoise salad');
      expect(dinner.suggestions).toEqual(['Pumpkin soup', 'Fish tacos', 'Bean burritos']);
      expect(suggestionsOf(store.plan())).not.toContain('Lentil soup');
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'), 'not saved').toEqual(
        store.plan(),
      );

      const before = saved();
      store.removeRecipe('Lentil soup');
      expect(saved(), 'after removing Lentil soup again').toEqual(before);
      expect(reload().plan(), 'after a reload').toEqual(before.plan);
    });

    it('removes a recipe and replaces it in the plan when saving fails', () => {
      load(
        planOf([
          day(
            '2026-10-24',
            open('Spaghetti carbonara', 'Lentil soup', 'Niçoise salad'),
            open('Pumpkin soup', 'Fish tacos', 'Bean burritos'),
          ),
        ]),
      );
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('quota exceeded', 'QuotaExceededError');
      });

      store.removeRecipe('Lentil soup');
      expect(store.removed()).toEqual(['Lentil soup']);
      expect(store.plan().days[0].lunch.suggestions).not.toContain('Lentil soup');
    });

    it('reads a saved list holding something other than a name as empty', () => {
      localStorage.setItem(REMOVED_KEY, JSON.stringify(['Lentil soup', 42]));

      expect(reload().removed()).toEqual([]);
    });

    it('reads a saved list leaving exactly 15 recipes suggested once its unknown names are dropped', () => {
      const removals = NAMES.slice(15);
      localStorage.setItem(REMOVED_KEY, JSON.stringify(['Imaginary stew', ...removals]));

      expect(reload().removed()).toEqual(removals);
    });

    function expectReopenedWithout(removed: string) {
      const lunch = store.plan().days[0].lunch;
      expect(lunch.recipe).toBeNull();
      expect(lunch.suggestions.slice(1), lunch.suggestions.join(', ')).toEqual([
        'Spaghetti carbonara',
        'Niçoise salad',
      ]);
      expect(lunch.suggestions[0]).not.toBe(removed);
      expect(NAMES).toContain(lunch.suggestions[0]);
      expect(store.removed()).not.toContain(lunch.suggestions[0]);
    }

    function mealRefs(): MealRef[] {
      return store.plan().days.flatMap((_, i): MealRef[] => [
        { day: i, kind: 'lunch' },
        { day: i, kind: 'dinner' },
      ]);
    }

    function load(plan: Plan) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
      store = reload();
      expect(store.plan(), 'saved plan not loaded').toEqual(plan);
    }

    function saved() {
      return {
        plan: store.plan(),
        removed: store.removed(),
        storedPlan: localStorage.getItem(STORAGE_KEY),
        storedRemoved: localStorage.getItem(REMOVED_KEY),
      };
    }

    function storedRemoved(): unknown {
      return JSON.parse(localStorage.getItem(REMOVED_KEY) ?? 'null');
    }
  });

  function createStore(): PlanStore {
    TestBed.configureTestingModule({
      providers: [
        // A new seed on every load, so a reload draws other suggestions unless the plan was saved
        { provide: RANDOM, useValue: seededRandom(seed++) },
        { provide: TODAY, useValue: () => today },
      ],
    });
    return TestBed.inject(PlanStore);
  }

  // A fresh injector reading the same localStorage, as a page reload would
  function reload(): PlanStore {
    TestBed.resetTestingModule();
    return createStore();
  }

  function firstItemKey(): string {
    const [item] = groceryList(store.plan(), RECIPES);
    expect(item, 'empty grocery list').toBeDefined();
    return itemKey(item);
  }

  function pickFirstSuggestion(meal: MealRef) {
    const suggestions = store.plan().days[meal.day]?.[meal.kind].suggestions ?? [];
    expect(suggestions, `no suggestions for day ${meal.day} ${meal.kind}`).not.toEqual([]);
    store.pick(meal, suggestions[0]);
  }

  function expectFreshPlan(plan: Plan, startDate: string) {
    expect(plan.days).toHaveLength(DEFAULT_DAYS);
    expect(plan.days[0].date).toBe(startDate);
    expect(plan.accepted).toBe(false);
    for (const planDay of plan.days) {
      for (const meal of [planDay.lunch, planDay.dinner]) {
        expect(meal.recipe, planDay.date).toBeNull();
        expect(meal.suggestions, planDay.date).toHaveLength(3);
      }
    }
  }
});
