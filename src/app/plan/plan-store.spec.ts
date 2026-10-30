import { computed, Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { groceryList, itemKey } from '../groceries/groceries';
import { RecipeStore } from '../recipes/recipe-store';
import { Recipe } from '../recipes/recipe';
import { RECIPES } from '../recipes/recipes';
import { ownRecipe, PLAIN_RICE, QUICK_DAL, RECIPES_KEY, storeOwnRecipes } from '../recipes/testing';
import { LocalStorageBackend, StorageBackend } from '../storage';
import { RejectingBackend, ThrowingOnceBackend, unhandledRejections } from '../testing';
import { addedKey, DEFAULT_SETTINGS, MealRef, Plan } from './plan';
import { PlanStore, RANDOM, TODAY } from './plan-store';
import { scoreWith } from './ranking';
import {
  acceptOneDayPlan,
  covered,
  day,
  DINNER,
  KID_FRIENDLY,
  leaveSuggested,
  loadStores,
  LUNCH,
  mealRefs,
  NOT_KID_FRIENDLY,
  open,
  picked,
  planOf,
  R,
  seededRandom,
  suggestionsOf,
} from './testing';

const STORAGE_KEY = 'fooplan.plan';
const REMOVED_KEY = 'fooplan.removed';
const NAMES = RECIPES.map((recipe) => recipe.name);
const EASY_RECIPES = [
  'Hummus plate with bread and vegetables',
  'Avocado toast with fried egg',
  'Caprese salad with bread',
  'Spinach and feta omelette',
  'Tuna and white bean salad with bread',
];
const FAMILY_RECIPES = [
  'Chicken schnitzel with cucumber salad',
  'Fish fingers with mashed potatoes and peas',
  'Spaghetti with zucchini and parmesan',
  'Chicken and rice with carrots and peas',
  'Pizza toast',
  'Potato pancakes with sour cream',
  'Spaghetti with meatballs',
  'Creamy salmon pasta with spinach',
  'Chicken and vegetable skewers with rice',
  'Pasta with broccoli and parmesan',
];

describe('PlanStore', () => {
  let today: string;
  let seed: number;
  let store: PlanStore;

  beforeEach(async () => {
    localStorage.clear();
    today = '2026-10-24';
    seed = 1;
    store = await createStore();
  });

  it('starts a plan for today with the default days when nothing is stored', () => {
    expectFreshPlan(store.plan(), '2026-10-24');
  });

  it('suggests three different recipes for each of the 10 meals of a new 5-day plan, 30 different ones from the 44 recipes, leaving 14 unshown', () => {
    const plan = store.plan();
    expect(plan.days, 'days').toHaveLength(5);
    for (const planDay of plan.days) {
      for (const [kind, meal] of [
        ['lunch', planDay.lunch],
        ['dinner', planDay.dinner],
      ] as const) {
        expect(meal.suggestions, `${planDay.date} ${kind}`).toHaveLength(3);
        expect(new Set(meal.suggestions).size, `different on ${planDay.date} ${kind}`).toBe(3);
      }
    }
    const suggestions = suggestionsOf(plan);
    expect(suggestions, 'suggestions').toHaveLength(30);
    expect(new Set(suggestions).size, 'different recipes suggested').toBe(30);
    expect(NAMES, 'recipes').toHaveLength(44);
    expect(suggestions.filter((name) => !NAMES.includes(name))).toEqual([]);
    expect(NAMES.filter((name) => !suggestions.includes(name))).toHaveLength(14);
  });

  it('suggests no recipe whose name contains "soup" in a new 5-day plan', () => {
    expect(suggestionsOf(store.plan()).filter((name) => /soup/i.test(name))).toEqual([]);
  });

  it('suggests 30 different recipes for the 10 meals of a new 5-day plan, leaving 14 of the 44 unshown, whatever the draw', async () => {
    for (let draw = 1; draw <= 10; draw++) {
      localStorage.clear();
      seed = draw * 7;
      store = await reload();
      const suggestions = suggestionsOf(store.plan());
      expect(new Set(suggestions).size, `draw ${draw}: different recipes`).toBe(30);
      expect(
        NAMES.filter((name) => !suggestions.includes(name)),
        `draw ${draw}: unshown`,
      ).toHaveLength(14);
    }
  });

  it('suggests for each meal of a new 5-day plan from a Monday, and for the first dinner on "Other suggestions" after its lunch is picked, three different recipes, each one scoring highest among the recipes not shown yet with the ones chosen before it alongside', async () => {
    localStorage.clear();
    today = '2026-10-26';
    seed = 1;
    store = await reload();
    const score = scoreWith(RECIPES);
    const scores: number[] = [];

    // shown lists the suggestions in the order they were drawn, three per meal
    const fresh = store.plan();
    expect(fresh.shown, 'shown').toHaveLength(30);
    for (let i = 0; i < fresh.shown.length; i += 3) {
      const drawn = fresh.shown.slice(i, i + 3);
      const ref = mealRefs(fresh).find(
        (meal) => fresh.days[meal.day][meal.kind].suggestions[0] === drawn[0],
      );
      expect(ref, `no meal suggests ${drawn.join(', ')}`).toBeDefined();
      expect(fresh.days[ref!.day][ref!.kind].suggestions, `${drawn[0]}'s meal`).toEqual(drawn);
      // The plan as the draw saw it: the meals drawn before this one and nothing else
      const shownBefore = fresh.shown.slice(0, i);
      const before: Plan = {
        ...fresh,
        days: fresh.days.map((planDay) => ({
          ...planDay,
          lunch: drawnOrEmpty(planDay.lunch.suggestions, shownBefore),
          dinner: drawnOrEmpty(planDay.dinner.suggestions, shownBefore),
        })),
        shown: shownBefore,
      };
      scores.push(...expectBestScored(before, ref!, drawn, shownBefore));
    }

    pickFirstSuggestion(LUNCH);
    const afterPick = store.plan();
    store.otherSuggestions(DINNER);
    const other = store.plan().days[0].dinner.suggestions;
    expect(store.plan().shown.slice(-3), 'shown after "Other suggestions"').toEqual(other);
    scores.push(...expectBestScored(afterPick, DINNER, other, afterPick.shown));

    expect(
      scores.some((value) => value !== 0),
      'every fresh candidate scored 0',
    ).toBe(true);

    // Returns the scores of every fresh candidate considered
    function expectBestScored(
      plan: Plan,
      meal: MealRef,
      suggestions: readonly string[],
      shown: readonly string[],
    ): number[] {
      const name = `${plan.days[meal.day].date} ${meal.kind}`;
      expect(new Set(suggestions).size, `${name}: ${suggestions.join(', ')}`).toBe(3);
      const picks = plan.days.flatMap((planDay) => [planDay.lunch.recipe, planDay.dinner.recipe]);
      const considered: number[] = [];
      suggestions.forEach((suggestion, i) => {
        const alongside = suggestions.slice(0, i);
        const candidates = NAMES.filter(
          (other) => !shown.includes(other) && !alongside.includes(other) && !picks.includes(other),
        );
        const context = `${name}, suggestion ${i + 1} "${suggestion}"`;
        expect(candidates, `${context}: no fresh candidate`).not.toEqual([]);
        expect(candidates, `${context}: not fresh`).toContain(suggestion);
        const ranked = candidates.map((other) => ({
          other,
          value: score(other, { plan, meal, alongside }),
        }));
        considered.push(...ranked.map(({ value }) => value));
        const best = ranked.reduce((top, next) => (next.value > top.value ? next : top));
        const own = ranked.find(({ other }) => other === suggestion)!.value;
        expect(own, `${context} scores ${own}, missing ${best.value} of "${best.other}"`).toBe(
          best.value,
        );
      });
      return considered;
    }

    function drawnOrEmpty(suggestions: string[], shownBefore: readonly string[]) {
      return suggestions.every((other) => shownBefore.includes(other))
        ? { recipe: null, suggestions }
        : { recipe: null, suggestions: [] };
    }
  });

  it('brings only recipes not shown yet on the first four "Other suggestions", and the last 2 of the 14 a new 5-day plan does not show with the first suggestion the meal started with on the fifth', () => {
    const plan = store.plan();
    const notShown = NAMES.filter((name) => !suggestionsOf(plan).includes(name));
    expect(notShown, 'recipes not shown').toHaveLength(14);
    const before = plan.days[0].lunch.suggestions;

    const brought: string[] = [];
    for (let click = 1; click <= 4; click++) {
      store.otherSuggestions(LUNCH);
      const suggestions = store.plan().days[0].lunch.suggestions;
      expect(new Set(suggestions).size, `click ${click}: ${suggestions.join(', ')}`).toBe(3);
      expect(
        suggestions.filter((name) => !notShown.includes(name) || brought.includes(name)),
        `click ${click}: shown before`,
      ).toEqual([]);
      brought.push(...suggestions);
    }

    store.otherSuggestions(LUNCH);
    const fifth = store.plan().days[0].lunch.suggestions;
    const left = notShown.filter((name) => !brought.includes(name));
    expect(left, 'recipes not shown after four clicks').toHaveLength(2);
    expect([...fifth].sort()).toEqual([...left, before[0]].sort());
  });

  it('suggests all 30 recipes still suggested, the own recipe "Grandma\'s Soup" among them, in a new 5-day plan of the 44 recipes and "Grandma\'s Soup" with the 5 easy ones and the 10 family ones taken out', async () => {
    localStorage.clear();
    storeOwnRecipes(ownRecipe("Grandma's Soup"));
    const takenOut = [...EASY_RECIPES, ...FAMILY_RECIPES];
    localStorage.setItem(REMOVED_KEY, JSON.stringify(takenOut));
    store = await reload();
    expect(store.removed(), 'taken out').toEqual(takenOut);

    const suggested = [...NAMES.filter((name) => !takenOut.includes(name)), "Grandma's Soup"];
    expect(suggested, 'recipes still suggested').toHaveLength(30);
    expect([...suggestionsOf(store.plan())].sort()).toEqual(suggested.sort());
  });

  it('starts a fresh plan for today when the stored plan suggests "Lentil soup", and reads "Lentil soup" in the saved removed recipes as unknown', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        planOf([
          day(
            '2026-10-20',
            open('Lentil soup', 'Spaghetti carbonara', 'Niçoise salad'),
            open('Fish tacos', 'Bean burritos', 'Potato goulash'),
          ),
        ]),
      ),
    );
    localStorage.setItem(REMOVED_KEY, JSON.stringify(['Lentil soup', 'Fish tacos']));

    store = await reload();
    expectFreshPlan(store.plan(), '2026-10-24');
    expect(suggestionsOf(store.plan())).not.toContain('Lentil soup');
    expect(store.removed()).toEqual(['Fish tacos']);
  });

  it('shows the same fresh plan after a reload without any change', async () => {
    const before = store.plan();
    expect((await reload()).plan()).toEqual(before);
  });

  it('shows the same days, people, picks and suggestions of a plan in progress after a reload', async () => {
    store.newPlan({ days: 2, people: 3, kidFriendly: false });
    pickFirstSuggestion(LUNCH);
    const before = store.plan();
    expect(before.days, 'days not set').toHaveLength(2);

    expect((await reload()).plan()).toEqual(before);
  });

  it('shows an accepted plan as accepted after a reload', async () => {
    acceptOneDayPlan(store);
    const before = store.plan();

    expect((await reload()).plan()).toEqual(before);
  });

  it('turns on "Cook extra" for a dinner, covering the next lunch, and keeps it after a reload', async () => {
    store.newPlan({ ...DEFAULT_SETTINGS, days: 2 });
    pickFirstSuggestion(DINNER);
    store.setCookExtra(0, true);
    const before = store.plan();
    expect(before.days[0].cookExtra).toBe(true);
    expect(before.days[1].lunch).toEqual({ recipe: null, suggestions: [] });

    expect((await reload()).plan()).toEqual(before);
  });

  it('does not suggest the recipes a plan has shown again after a reload, while recipes not shown yet are left', async () => {
    const names = RECIPES.map((recipe) => recipe.name);
    const saved: Plan = {
      days: [day('2026-10-24', open(...names.slice(0, 3)), open(...names.slice(3, 6)))],
      people: 2,
      accepted: false,
      ticked: [],
      added: [],
      shown: names.slice(0, 6),
      kidFriendly: false,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    store = await reload();
    expect(store.plan(), 'saved plan not loaded').toEqual(saved);

    // 38 of the 44 recipes start unshown, enough for 3 new ones on each of the 7 clicks
    clickOtherSuggestions(1, 3);
    const before = store.plan();
    store = await reload();
    expect(store.plan()).toEqual(before);
    clickOtherSuggestions(4, 7);
    expect(store.plan().shown).toHaveLength(27);

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

  it('opens a picked meal with the suggestions it showed when picked, in the same order, on "Undo" after a reload', async () => {
    const suggestions = store.plan().days[0].lunch.suggestions;
    pickFirstSuggestion(LUNCH);

    store = await reload();
    expect(store.plan().days[0].lunch.recipe, 'pick lost on reload').toBe(suggestions[0]);
    store.clear(LUNCH);
    expect(store.plan().days[0].lunch).toEqual({ recipe: null, suggestions });
  });

  it('loads a plan saved before picked meals remembered their suggestions with its days, picks and accepted state, and opens such a meal with three unpicked suggestions on "Undo"', async () => {
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
      kidFriendly: false,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

    store = await reload();
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
    expect((await reload()).plan()).toEqual(accepted);
  });

  it('keeps the start date of a stored plan when reloaded on a later day', async () => {
    store.newPlan({ ...DEFAULT_SETTINGS, days: 2 });
    const before = store.plan();
    expect(before.days, 'days not set').toHaveLength(2);
    today = '2026-10-27';

    expect((await reload()).plan()).toEqual(before);
  });

  it('starts a fresh plan for today when the stored plan is not valid JSON', async () => {
    localStorage.setItem(STORAGE_KEY, '{"days": [');
    expectFreshPlan((await reload()).plan(), '2026-10-24');
  });

  it('starts a fresh plan for today when the stored plan names a recipe that does not exist', async () => {
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
      kidFriendly: false,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
    expectFreshPlan((await reload()).plan(), '2026-10-24');
  });

  it('starts a fresh plan for today on "New plan" and saves it', async () => {
    acceptOneDayPlan(store);
    today = '2026-10-26';

    store.newPlan(DEFAULT_SETTINGS);
    expectFreshPlan(store.plan(), '2026-10-26');
    expect((await reload()).plan()).toEqual(store.plan());
  });

  it('forgets the recipes the old plan has shown on "New plan", so only the new suggestions count as shown', () => {
    for (let click = 0; click < 20; click++) {
      store.otherSuggestions(LUNCH);
    }

    store.newPlan(DEFAULT_SETTINGS);
    expectFreshPlan(store.plan(), '2026-10-24');
    expect([...store.plan().shown].sort()).toEqual(
      [...new Set(suggestionsOf(store.plan()))].sort(),
    );
  });

  it('keeps a ticked grocery item ticked after a reload', async () => {
    acceptOneDayPlan(store);
    const key = firstItemKey();
    store.toggleTicked(key);
    expect(store.plan().ticked, 'item not ticked').toEqual([key]);

    expect((await reload()).plan().ticked).toEqual([key]);
  });

  it('starts "New plan" not accepted with nothing ticked, and nothing ticked after a reload or once the next plan is accepted', async () => {
    acceptOneDayPlan(store);
    store.toggleTicked(firstItemKey());
    expect(store.plan().ticked, 'item not ticked').toHaveLength(1);

    store.newPlan(DEFAULT_SETTINGS);
    expect(store.plan().ticked).toEqual([]);
    expect(store.plan().accepted).toBe(false);
    store = await reload();
    expect(store.plan().ticked).toEqual([]);
    acceptOneDayPlan(store);
    expect(store.plan().ticked).toEqual([]);
  });

  it('keeps the added items, in their order, and their ticks after a reload', async () => {
    acceptOneDayPlan(store);
    store.addItem('toilet paper');
    store.addItem('coffee');
    store.addItem('2 l milk');
    const ticked = [addedKey('coffee'), firstItemKey()];
    ticked.forEach((key) => store.toggleTicked(key));
    expect(store.plan().added, 'items not added').toEqual(['toilet paper', 'coffee', '2 l milk']);
    expect(store.plan().ticked, 'items not ticked').toEqual(ticked);

    store = await reload();
    expect(store.plan().added).toEqual(['toilet paper', 'coffee', '2 l milk']);
    expect(store.plan().ticked).toEqual(ticked);
  });

  it('starts "New plan" without the added items, and none after a reload or once the next plan is accepted', async () => {
    acceptOneDayPlan(store);
    store.addItem('toilet paper');
    store.addItem('coffee');
    store.toggleTicked(addedKey('coffee'));
    expect(store.plan().added, 'items not added').toHaveLength(2);

    store.newPlan(DEFAULT_SETTINGS);
    expect(store.plan().added).toEqual([]);
    expect(store.plan().ticked).toEqual([]);
    store = await reload();
    expect(store.plan().added).toEqual([]);
    acceptOneDayPlan(store);
    expect(store.plan().added).toEqual([]);
  });

  describe('newPlan with settings (#41)', () => {
    it('starts 2 open days from today for 3 people with no pick, tick or added item and only the new suggestions shown on store.newPlan({ days: 2, people: 3, kidFriendly: false }) from a 5-day plan for 2 with 3 picks and a tick, and saves it; draws only kid-friendly recipes with kidFriendly: true; and keeps the same plan for kidFriendly: true with 14 kid-friendly recipes suggested, days 0, 6 or 2.5 or people 0', async () => {
      for (const meal of [LUNCH, DINNER, { day: 1, kind: 'lunch' } as const]) {
        pickFirstSuggestion(meal);
      }
      today = '2026-10-26';

      store.newPlan({ days: 2, people: 3, kidFriendly: false });
      const plan = store.plan();
      expect(plan.days.map((planDay) => planDay.date)).toEqual(['2026-10-26', '2026-10-27']);
      expect(plan.people).toBe(3);
      expect(plan.kidFriendly).toBe(false);
      expect(plan.accepted).toBe(false);
      for (const planDay of plan.days) {
        for (const meal of [planDay.lunch, planDay.dinner]) {
          expect(meal.recipe, planDay.date).toBeNull();
          expect(meal.suggestions, planDay.date).toHaveLength(3);
        }
      }
      expect([...plan.shown].sort()).toEqual([...new Set(suggestionsOf(plan))].sort());
      expect((await reload()).plan(), 'after a reload').toEqual(plan);

      // Grocery lines can only be ticked on an accepted plan
      store = await reload();
      acceptOneDayPlan(store);
      store.toggleTicked(firstItemKey());
      store.addItem('toilet paper');
      expect(store.plan().ticked, 'item not ticked').toHaveLength(1);
      store.newPlan({ days: 2, people: 3, kidFriendly: false });
      expect(store.plan()).toMatchObject({ accepted: false, ticked: [], added: [], people: 3 });
      expect(store.plan().days).toHaveLength(2);

      store = await reload();
      store.newPlan({ days: 5, people: 2, kidFriendly: true });
      expect(store.plan().kidFriendly).toBe(true);
      expectKidFriendly('kid-friendly new plan');

      // A kid-friendly plan stops removals at 15 kid-friendly recipes
      localStorage.clear();
      store = await reload();
      leaveSuggested(store, 25, ...KID_FRIENDLY.slice(0, 14), ...NOT_KID_FRIENDLY);
      const before = store.plan();
      for (const settings of [
        { days: 3, people: 2, kidFriendly: true },
        { days: 0, people: 2, kidFriendly: false },
        { days: 6, people: 2, kidFriendly: false },
        { days: 2.5, people: 2, kidFriendly: false },
        { days: 3, people: 0, kidFriendly: false },
      ]) {
        store.newPlan(settings);
        expect(store.plan(), JSON.stringify(settings)).toBe(before);
      }
    });

    describe('edge cases', () => {
      it('keeps the same plan and saves nothing on newPlan with people 1.5 or -1, days -1 or NaN', () => {
        const before = store.plan();
        const stored = localStorage.getItem(STORAGE_KEY);
        for (const settings of [
          { days: 3, people: 1.5, kidFriendly: false },
          { days: 3, people: -1, kidFriendly: false },
          { days: -1, people: 2, kidFriendly: false },
          { days: Number.NaN, people: 2, kidFriendly: false },
        ]) {
          store.newPlan(settings);
          expect(store.plan(), JSON.stringify(settings)).toBe(before);
        }
        expect(localStorage.getItem(STORAGE_KEY)).toBe(stored);
        // A rejected call must not be one that ignores its settings
        store.newPlan({ days: 3, people: 2, kidFriendly: false });
        expect(store.plan().days, 'valid settings').toHaveLength(3);
      });

      it('starts 1 day for 1 person, 5 days for 100 people, and a kid-friendly plan with exactly 15 kid-friendly recipes suggested', () => {
        store.newPlan({ days: 1, people: 1, kidFriendly: false });
        expect(store.plan().days).toHaveLength(1);
        expect(store.plan().people).toBe(1);

        store.newPlan({ days: 5, people: 100, kidFriendly: false });
        expect(store.plan().days).toHaveLength(5);
        expect(store.plan().people).toBe(100);

        leaveSuggested(store, 26, ...KID_FRIENDLY.slice(0, 15), ...NOT_KID_FRIENDLY);
        store.newPlan({ days: 2, people: 2, kidFriendly: true });
        expect(store.plan().days).toHaveLength(2);
        expect(store.plan().kidFriendly).toBe(true);
        expectKidFriendly('15 kid-friendly suggested');
      });

      it('tells whether newPlan started a plan: true for 3 days and for the defaults, false for 6 days, 0 people or kid-friendly while 14 kid-friendly recipes are suggested', () => {
        expect(store.newPlan({ ...DEFAULT_SETTINGS, days: 3 })).toBe(true);
        expect(store.newPlan({ ...DEFAULT_SETTINGS, days: 6 })).toBe(false);
        expect(store.newPlan({ ...DEFAULT_SETTINGS, people: 0 })).toBe(false);
        leaveSuggested(store, 25, ...KID_FRIENDLY.slice(0, 14), ...NOT_KID_FRIENDLY);
        expect(store.newPlan({ ...DEFAULT_SETTINGS, kidFriendly: true })).toBe(false);
        expect(store.newPlan(DEFAULT_SETTINGS)).toBe(true);
      });

      it('starts a plan that is not kid-friendly from a kid-friendly one on newPlan with kidFriendly: false, drawing from every suggested recipe', () => {
        store.newPlan({ ...DEFAULT_SETTINGS, kidFriendly: true });
        expect(store.plan().kidFriendly, 'not kid-friendly').toBe(true);

        const drawn = new Set<string>();
        for (let i = 0; i < 3; i++) {
          store.newPlan({ days: 5, people: 2, kidFriendly: false });
          expect(store.plan().kidFriendly).toBe(false);
          expect(store.plan().days).toHaveLength(5);
          suggestionsOf(store.plan()).forEach((name) => drawn.add(name));
        }
        expect(NOT_KID_FRIENDLY.filter((name) => drawn.has(name)).length).toBeGreaterThan(0);
      });
    });
  });

  describe('own recipes', () => {
    it('suggests the own recipe "Quick Dal" on the next "Other suggestions" once added, leaving an unaccepted plan that has shown every built-in recipe unchanged until then, and an accepted plan unchanged', async () => {
      const saved: Plan = {
        ...planOf([
          day(
            '2026-10-24',
            open('Shakshuka with bread', 'Chickpea and spinach curry', 'Fish tacos'),
            open('Spaghetti carbonara', 'Niçoise salad', 'Bean burritos'),
          ),
        ]),
        shown: NAMES,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
      store = await reload();
      expect(store.plan(), 'saved plan not loaded').toEqual(saved);

      recipes().add(QUICK_DAL);
      expect(store.plan(), 'after adding "Quick Dal"').toEqual(saved);
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toEqual(saved);
      store.otherSuggestions(LUNCH);
      expect(store.plan().days[0].lunch.suggestions).toContain('Quick Dal');

      localStorage.clear();
      store = await reload();
      acceptOneDayPlan(store);
      const accepted = store.plan();
      const stored = localStorage.getItem(STORAGE_KEY);
      recipes().add(PLAIN_RICE);
      expect(store.plan(), 'accepted plan after adding "Plain Rice"').toEqual(accepted);
      expect(localStorage.getItem(STORAGE_KEY)).toBe(stored);
    });

    it('loads a saved plan that picked the own recipe "Quick Dal" with the pick after a reload', async () => {
      storeOwnRecipes(QUICK_DAL);
      const saved = planOf([
        day(
          '2026-10-24',
          picked('Quick Dal', ['Shakshuka with bread', 'Quick Dal', 'Chickpea and spinach curry']),
          open('Spaghetti carbonara', 'Niçoise salad', 'Fish tacos'),
        ),
      ]);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

      expect((await reload()).plan()).toEqual(saved);
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

    it('reads a saved list of removed recipes that leaves 14 built-in recipes and the own recipe "Quick Dal" suggested', async () => {
      storeOwnRecipes(QUICK_DAL);
      const removals = NAMES.slice(14);
      localStorage.setItem(REMOVED_KEY, JSON.stringify(removals));

      expect((await reload()).removed()).toEqual(removals);
    });

    it('ranks the next draw with the own recipe "Own pasta" as soon as it is added, and once it is deleted with the recipe added under its name since', async () => {
      localStorage.clear();
      today = '2026-10-26';
      // Only "Pesto pasta with cherry tomatoes" and "Greek salad with feta and bread" are not shown yet
      const fresh = ['Pesto pasta with cherry tomatoes', 'Greek salad with feta and bread'];
      const saved: Plan = {
        ...planOf([
          day(
            '2026-10-26',
            picked('Chickpea and spinach curry'),
            open('Spaghetti carbonara', 'Niçoise salad', 'Bean burritos'),
          ),
        ]),
        shown: NAMES.filter((name) => !fresh.includes(name)),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
      store = await reload();
      expect(store.plan(), 'saved plan not loaded').toEqual(saved);

      recipes().add(R('Own pasta', ['spaghetti', 'onion']));
      // "Own pasta" shares onion with the curry; "Pesto pasta with cherry tomatoes" then has its base
      store.otherSuggestions(DINNER);
      expect(store.plan().days[0].dinner.suggestions, 'with "Own pasta" added').toEqual([
        'Own pasta',
        'Greek salad with feta and bread',
        'Pesto pasta with cherry tomatoes',
      ]);

      store.deleteRecipe('Own pasta');
      expect(recipes().own(), 'not deleted').toEqual([]);
      recipes().add(R('Own pasta', ['rice', 'onion']));
      recipes().add(R('Own penne', ['penne']));
      recipes().add(R('Own risotto', ['rice']));
      // Now rice like the curry, so "Own penne" comes first and "Own risotto" last
      store.otherSuggestions(DINNER);
      expect(store.plan().days[0].dinner.suggestions, 'after deleting "Own pasta"').toEqual([
        'Own penne',
        'Own pasta',
        'Own risotto',
      ]);
    });

    describe('editing and deleting', () => {
      it('changes nothing on deleteRecipe("Quick Dal") and tells "picked" from deleteBlock while it is picked in an unaccepted plan or as a dinner cooked extra there, null once the pick is undone, and "accepted" while it is picked in an accepted plan', async () => {
        storeOwnRecipes(QUICK_DAL);
        await load(
          planOf([
            day(
              '2026-10-24',
              picked('Quick Dal', [
                'Shakshuka with bread',
                'Quick Dal',
                'Chickpea and spinach curry',
              ]),
              open('Spaghetti carbonara', 'Niçoise salad', 'Fish tacos'),
            ),
          ]),
        );
        expect(store.deleteBlock('Quick Dal'), 'picked for a lunch').toBe('picked');
        expectNotDeleted(() => store.deleteRecipe('Quick Dal'));
        store.clear(LUNCH);
        expect(store.plan().days[0].lunch.recipe, 'pick not undone').toBeNull();
        expect(store.deleteBlock('Quick Dal'), 'pick undone').toBeNull();

        await load(
          planOf([
            day(
              '2026-10-24',
              open('Shakshuka with bread', 'Chickpea and spinach curry', 'Fish tacos'),
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

        await load(
          planOf([day('2026-10-24', picked('Quick Dal'), picked('Shakshuka with bread'))], {
            accepted: true,
          }),
        );
        expect(store.deleteBlock('Quick Dal'), 'accepted plan').toBe('accepted');
        expectNotDeleted(() => store.deleteRecipe('Quick Dal'));
      });

      it('changes neither fooplan.recipes, the plan nor the removed recipes on deleteRecipe("Quick Dal") and tells "limit" from deleteBlock while it is one of exactly 15 recipes suggested and not picked, and null while it is removed instead', async () => {
        storeOwnRecipes(QUICK_DAL);
        store = await reload();
        leaveSuggested(store, 15, 'Quick Dal');
        expect(store.deleteBlock('Quick Dal')).toBe('limit');
        expectNotDeleted(() => store.deleteRecipe('Quick Dal'));

        localStorage.clear();
        storeOwnRecipes(QUICK_DAL);
        store = await reload();
        leaveSuggested(store, 15);
        expect(store.removed(), 'Quick Dal not removed').toContain('Quick Dal');
        expect(store.deleteBlock('Quick Dal')).toBeNull();
      });

      it('renames "Quick Dal", picked and second in the removed recipes, to "Daily Dal" in the plan and in its place in the removed recipes on recipeEdited after RecipeStore.replace, and loads both unchanged after a reload', async () => {
        storeOwnRecipes(QUICK_DAL);
        localStorage.setItem(
          REMOVED_KEY,
          JSON.stringify(['Shakshuka with bread', 'Quick Dal', 'Fish tacos']),
        );
        await load(
          planOf([
            day(
              '2026-10-24',
              picked('Quick Dal', ['Chickpea and spinach curry', 'Quick Dal', 'Bean burritos']),
              open('Spaghetti carbonara', 'Niçoise salad', 'Potato goulash'),
            ),
          ]),
        );
        expect(store.removed(), 'removed recipes not loaded').toEqual([
          'Shakshuka with bread',
          'Quick Dal',
          'Fish tacos',
        ]);
        const before = store.plan();

        recipes().replace('Quick Dal', { ...QUICK_DAL, name: 'Daily Dal' });
        store.recipeEdited('Quick Dal', 'Daily Dal');
        const expected: Plan = {
          ...before,
          days: [
            {
              ...before.days[0],
              lunch: picked('Daily Dal', [
                'Chickpea and spinach curry',
                'Daily Dal',
                'Bean burritos',
              ]),
            },
          ],
          shown: before.shown.map((name) => (name === 'Quick Dal' ? 'Daily Dal' : name)),
        };
        expect(store.plan()).toEqual(expected);
        expect(store.removed()).toEqual(['Shakshuka with bread', 'Daily Dal', 'Fish tacos']);
        expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toEqual(expected);

        store = await reload();
        expect(store.plan(), 'plan after a reload').toEqual(expected);
        expect(store.removed(), 'removed after a reload').toEqual([
          'Shakshuka with bread',
          'Daily Dal',
          'Fish tacos',
        ]);
      });

      it('deletes "Quick Dal", not picked and removed, from the own recipes, fooplan.recipes, the removed recipes and the plan\'s shown recipes and remembered suggestions on deleteRecipe, saving each', async () => {
        storeOwnRecipes(QUICK_DAL, PLAIN_RICE);
        localStorage.setItem(REMOVED_KEY, JSON.stringify(['Shakshuka with bread', 'Quick Dal']));
        await load(
          planOf([
            day(
              '2026-10-24',
              picked('Chickpea and spinach curry', [
                'Chickpea and spinach curry',
                'Quick Dal',
                'Fish tacos',
              ]),
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
        expect(store.removed()).toEqual(['Shakshuka with bread']);
        expect(JSON.parse(localStorage.getItem(REMOVED_KEY) ?? 'null')).toEqual([
          'Shakshuka with bread',
        ]);
        expect(store.plan().days[0].lunch).toEqual(picked('Chickpea and spinach curry'));
        expect(JSON.stringify(store.plan())).not.toContain('Quick Dal');
        expect(localStorage.getItem(STORAGE_KEY)).not.toContain('Quick Dal');
      });

      it('loads the plan saved without "Quick Dal", and "Quick Dal" still removed, after a reload when saving fooplan.recipes, and every write after it, fails on deleteRecipe', async () => {
        storeOwnRecipes(QUICK_DAL, PLAIN_RICE);
        localStorage.setItem(REMOVED_KEY, JSON.stringify(['Quick Dal']));
        await load(
          planOf([
            day(
              '2026-10-24',
              picked('Chickpea and spinach curry', [
                'Chickpea and spinach curry',
                'Quick Dal',
                'Fish tacos',
              ]),
              open('Spaghetti carbonara', 'Shakshuka with bread', 'Penne arrabbiata'),
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

        store = await reload();
        expect(recipes().own()).toEqual([QUICK_DAL, PLAIN_RICE]);
        expect(store.removed()).toEqual(['Quick Dal']);
        expect(store.plan()).toEqual(deleted);
      });

      describe('edge cases', () => {
        it('tells "picked" from deleteBlock for "Quick Dal" picked while exactly 15 recipes are suggested, and "accepted" once the plan is accepted', async () => {
          storeOwnRecipes(QUICK_DAL);
          await load(
            planOf([
              day(
                '2026-10-24',
                picked('Quick Dal', [
                  'Shakshuka with bread',
                  'Quick Dal',
                  'Chickpea and spinach curry',
                ]),
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

        it('deletes the removed "Quick Dal" while exactly 15 recipes are suggested, leaving 15 suggested', async () => {
          storeOwnRecipes(QUICK_DAL);
          store = await reload();
          const suggested = leaveSuggested(store, 15);
          expect(store.removed(), 'Quick Dal not removed').toContain('Quick Dal');

          store.deleteRecipe('Quick Dal');
          expect(recipes().own()).toEqual([]);
          expect(store.removed()).not.toContain('Quick Dal');
          expect(suggestedNames()).toEqual(suggested);
        });

        it('deletes "Quick Dal" while it is one of 16 recipes suggested, leaving 15 suggested and telling "limit" for the own recipe "Plain Rice" among them', async () => {
          storeOwnRecipes(QUICK_DAL, PLAIN_RICE);
          store = await reload();
          const suggested = leaveSuggested(store, 16, 'Quick Dal', 'Plain Rice');
          expect(store.deleteBlock('Quick Dal')).toBeNull();

          store.deleteRecipe('Quick Dal');
          expect(recipes().own()).toEqual([PLAIN_RICE]);
          expect(suggestedNames()).toEqual(suggested.filter((name) => name !== 'Quick Dal'));
          expect(store.deleteBlock('Plain Rice')).toBe('limit');
        });

        it('turns deleteBlock("Quick Dal") read in a computed from "limit" to null when another own recipe is added', async () => {
          storeOwnRecipes(QUICK_DAL);
          store = await reload();
          leaveSuggested(store, 15, 'Quick Dal');
          const block = computed(() => store.deleteBlock('Quick Dal'));
          expect(block()).toBe('limit');

          recipes().add(PLAIN_RICE);
          expect(block()).toBeNull();
        });

        it('replaces a suggestion of the deleted "Quick Dal" with a recipe neither removed nor "Quick Dal", in its place, and saves the plan', async () => {
          storeOwnRecipes(QUICK_DAL);
          const removed = NAMES.slice(20);
          localStorage.setItem(REMOVED_KEY, JSON.stringify(removed));
          // Every recipe still suggested has been shown, so a draw among all recipes would take a
          // removed one, never shown
          await load({
            ...planOf([
              day(
                '2026-10-24',
                open('Shakshuka with bread', 'Quick Dal', 'Chickpea and spinach curry'),
                open('Spaghetti carbonara', 'Fish tacos', 'Penne arrabbiata'),
              ),
            ]),
            shown: [...NAMES.slice(0, 20), 'Quick Dal'],
          });
          expect(store.removed(), 'removed recipes not loaded').toEqual(removed);

          store.deleteRecipe('Quick Dal');
          const [first, replacement, last] = store.plan().days[0].lunch.suggestions;
          expect([first, last]).toEqual(['Shakshuka with bread', 'Chickpea and spinach curry']);
          expect(NAMES.slice(0, 20)).toContain(replacement);
          expect(['Spaghetti carbonara', 'Fish tacos', 'Penne arrabbiata']).not.toContain(
            replacement,
          );
          expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toEqual(store.plan());
        });
      });

      async function load(plan: Plan) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
        store = await reload();
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

  describe('kid-friendly', () => {
    it('starts a kid-friendly plan with newPlan, suggesting none of the 11 recipes that are not kid-friendly, saves it and keeps it after a reload', async () => {
      expect(store.plan().kidFriendly, 'new plan').toBe(false);
      expect(
        suggestionsOf(store.plan()).filter((name) => NOT_KID_FRIENDLY.includes(name)).length,
        'strong flavours suggested before',
      ).toBeGreaterThan(0);

      store.newPlan({ ...DEFAULT_SETTINGS, kidFriendly: true });
      expect(store.plan().kidFriendly).toBe(true);
      expectKidFriendly('new plan');
      store = await reload();
      expect(store.plan().kidFriendly, 'after a reload').toBe(true);
      expectKidFriendly('after a reload');
    });

    it('draws only kid-friendly recipes while kid-friendly is on, for "Other suggestions", picks, "Cook extra" turned off and the replacement of a removed recipe, and from every suggested recipe again for a new plan that is not kid-friendly', () => {
      store.newPlan({ ...DEFAULT_SETTINGS, kidFriendly: true });
      expectKidFriendly('new plan');
      for (const meal of mealRefs(store.plan())) {
        for (let click = 1; click <= 3; click++) {
          store.otherSuggestions(meal);
          expectKidFriendly(`day ${meal.day} ${meal.kind}, "Other suggestions" ${click}`);
        }
      }
      for (const meal of mealRefs(store.plan()).slice(0, -1)) {
        pickFirstSuggestion(meal);
        expectKidFriendly(`picked day ${meal.day} ${meal.kind}`);
      }
      store.setCookExtra(0, true);
      store.setCookExtra(0, false);
      expect(store.plan().days[1].lunch.suggestions, 'lunch not reopened').toHaveLength(3);
      expectKidFriendly('"Cook extra" off');
      const removed = store.plan().days[4].dinner.suggestions[0];
      store.removeRecipe(removed);
      expect(store.removed(), `${removed} not removed`).toEqual([removed]);
      expectKidFriendly(`${removed} removed`);

      store.newPlan(DEFAULT_SETTINGS);
      expect(store.plan().kidFriendly).toBe(false);
      expect(
        suggestionsOf(store.plan()).filter((name) => NOT_KID_FRIENDLY.includes(name)).length,
        'strong flavours in the new plan',
      ).toBeGreaterThan(0);
    });

    it('lets recipes be removed with kid-friendly on while 16 kid-friendly recipes are suggested, none once 15 are left, not even one that is not kid-friendly, and again for a new plan that is not kid-friendly', () => {
      const sixteen = KID_FRIENDLY.slice(0, 16);
      leaveSuggested(store, 27, ...sixteen, ...NOT_KID_FRIENDLY);
      store.newPlan({ ...DEFAULT_SETTINGS, kidFriendly: true });
      expect(store.canRemove(), '16 kid-friendly suggested').toBe(true);

      store.removeRecipe(sixteen[0]);
      expect(store.removed(), `${sixteen[0]} not removed`).toContain(sixteen[0]);
      expect(store.canRemove(), '15 kid-friendly suggested').toBe(false);
      const before = store.removed();
      store.removeRecipe(sixteen[1]);
      store.removeRecipe(NOT_KID_FRIENDLY[0]);
      expect(store.removed(), 'removed at 15 kid-friendly suggested').toEqual(before);

      store.newPlan(DEFAULT_SETTINGS);
      expect(store.canRemove(), 'not kid-friendly').toBe(true);
      store.removeRecipe(NOT_KID_FRIENDLY[0]);
      expect(store.removed()).toEqual([...before, NOT_KID_FRIENDLY[0]]);
    });

    it('replaces "Penne arrabbiata" and "Niçoise salad" suggested by a saved kid-friendly plan in their places with kid-friendly recipes when loading it, keeps the other suggestions and the dinner picked as "Pad thai with chicken", and saves the plan with the replacements', async () => {
      const saved = planOf(
        [
          day(
            '2026-10-24',
            open('Spaghetti carbonara', 'Penne arrabbiata', 'Mac and cheese'),
            picked('Pad thai with chicken'),
          ),
          day(
            '2026-10-25',
            open('Fish tacos', 'Potato goulash', 'Tuna pasta bake'),
            open('Niçoise salad', 'Spaghetti pomodoro', 'Shakshuka with bread'),
          ),
        ],
        { kidFriendly: true },
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

      store = await reload();
      const [first, second] = store.plan().days;
      expect(store.plan().kidFriendly).toBe(true);
      expect(first.lunch.suggestions[0]).toBe('Spaghetti carbonara');
      expect(KID_FRIENDLY).toContain(first.lunch.suggestions[1]);
      expect(first.lunch.suggestions[2]).toBe('Mac and cheese');
      expect(first.dinner).toEqual(picked('Pad thai with chicken'));
      expect(second.lunch).toEqual(saved.days[1].lunch);
      expect(KID_FRIENDLY).toContain(second.dinner.suggestions[0]);
      expect(second.dinner.suggestions.slice(1)).toEqual([
        'Spaghetti pomodoro',
        'Shakshuka with bread',
      ]);
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'), 'not saved').toEqual(
        store.plan(),
      );
    });

    it('replaces the own recipe "Plain Rice" in its place with a kid-friendly recipe once it is edited to use chili flakes while kid-friendly is on, keeping its name, and "Onion Rice" once it is edited and renamed to "Spicy Rice", and saves the plan', async () => {
      storeOwnRecipes(PLAIN_RICE, ownRecipe('Onion Rice'));
      await load(
        planOf(
          [
            day(
              '2026-10-24',
              open('Spaghetti carbonara', 'Plain Rice', 'Mac and cheese'),
              open('Onion Rice', 'Spaghetti pomodoro', 'Potato goulash'),
            ),
          ],
          { kidFriendly: true },
        ),
      );
      const recipeStore = TestBed.inject(RecipeStore);

      recipeStore.replace('Plain Rice', withChiliFlakes(PLAIN_RICE));
      store.recipeEdited('Plain Rice', 'Plain Rice');
      const { lunch } = store.plan().days[0];
      expect(lunch.suggestions[0]).toBe('Spaghetti carbonara');
      expect(KID_FRIENDLY).toContain(lunch.suggestions[1]);
      expect(lunch.suggestions[2]).toBe('Mac and cheese');

      recipeStore.replace('Onion Rice', {
        ...withChiliFlakes(ownRecipe('Onion Rice')),
        name: 'Spicy Rice',
      });
      store.recipeEdited('Onion Rice', 'Spicy Rice');
      const { dinner } = store.plan().days[0];
      expect(KID_FRIENDLY).toContain(dinner.suggestions[0]);
      expect(dinner.suggestions.slice(1)).toEqual(['Spaghetti pomodoro', 'Potato goulash']);
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'), 'not saved').toEqual(
        store.plan(),
      );
    });

    it('turns kid-friendly off once the own recipe "Plain Rice", one of exactly 15 kid-friendly recipes suggested, is edited to use chili flakes with kid-friendly on and 9 meals picked, so "Other suggestions" still gives the open meal 3 suggestions and the saved plan loads again', async () => {
      storeOwnRecipes(PLAIN_RICE);
      store = await reload();
      leaveSuggested(store, 26, ...KID_FRIENDLY.slice(0, 14), PLAIN_RICE.name, ...NOT_KID_FRIENDLY);
      store.newPlan({ ...DEFAULT_SETTINGS, kidFriendly: true });
      expect(store.plan().kidFriendly, 'not kid-friendly').toBe(true);
      for (const meal of mealRefs(store.plan()).slice(0, -1)) {
        const { suggestions } = store.plan().days[meal.day][meal.kind];
        store.pick(meal, suggestions.filter((name) => name !== PLAIN_RICE.name)[0]);
      }

      TestBed.inject(RecipeStore).replace(PLAIN_RICE.name, withChiliFlakes(PLAIN_RICE));
      store.recipeEdited(PLAIN_RICE.name, PLAIN_RICE.name);
      expect(store.plan().kidFriendly, 'still kid-friendly').toBe(false);

      const openMeals = mealRefs(store.plan()).filter(
        (meal) => store.plan().days[meal.day][meal.kind].recipe === null,
      );
      expect(openMeals, 'open meals').toHaveLength(1);
      for (const meal of openMeals) {
        store.otherSuggestions(meal);
        expect(
          store.plan().days[meal.day][meal.kind].suggestions,
          `day ${meal.day} ${meal.kind}`,
        ).toHaveLength(3);
      }
      const plan = store.plan();
      expect((await reload()).plan(), 'saved plan not loaded').toEqual(plan);
    });

    it('replaces the deleted own recipe "Plain Rice" with a kid-friendly recipe while kid-friendly is on, also when only recipes that are not kid-friendly have not been shown yet', async () => {
      storeOwnRecipes(PLAIN_RICE);
      await load({
        ...planOf(
          [
            day(
              '2026-10-24',
              open('Spaghetti carbonara', 'Plain Rice', 'Mac and cheese'),
              picked('Potato goulash'),
            ),
          ],
          { kidFriendly: true },
        ),
        shown: [...KID_FRIENDLY, PLAIN_RICE.name],
      });

      store.deleteRecipe(PLAIN_RICE.name);
      const { suggestions } = store.plan().days[0].lunch;
      expect(TestBed.inject(RecipeStore).own(), 'not deleted').toEqual([]);
      expect(suggestions[0]).toBe('Spaghetti carbonara');
      expect(KID_FRIENDLY).toContain(suggestions[1]);
      expect(suggestions[2]).toBe('Mac and cheese');
    });

    it('replaces "Penne arrabbiata" among the remembered suggestions with a kid-friendly recipe when the user undoes the pick of "Mac and cheese" while kid-friendly is on, also when only recipes that are not kid-friendly have not been shown yet', async () => {
      await load({
        ...planOf(
          [
            day(
              '2026-10-24',
              picked('Mac and cheese', [
                'Penne arrabbiata',
                'Mac and cheese',
                'Spaghetti pomodoro',
              ]),
              picked('Potato goulash'),
            ),
          ],
          { kidFriendly: true },
        ),
        shown: [...KID_FRIENDLY, 'Penne arrabbiata'],
      });

      store.clear(LUNCH);
      const { suggestions } = store.plan().days[0].lunch;
      expect(KID_FRIENDLY).toContain(suggestions[0]);
      expect(suggestions.slice(1)).toEqual(['Mac and cheese', 'Spaghetti pomodoro']);
    });

    it('can be kid-friendly with 15 kid-friendly recipes suggested and not with 14, whatever the number of other recipes suggested', () => {
      leaveSuggested(store, 25, ...KID_FRIENDLY.slice(0, 14), ...NOT_KID_FRIENDLY);
      expect(store.canBeKidFriendly(), '14 kid-friendly suggested').toBe(false);

      store.restoreRecipe(KID_FRIENDLY[14]);
      expect(store.canBeKidFriendly(), '15 kid-friendly suggested').toBe(true);
    });

    describe('edge cases', () => {
      it('loads a saved kid-friendly plan not kid-friendly, with its suggestions, and saves it while only 14 kid-friendly recipes are suggested', async () => {
        localStorage.setItem(REMOVED_KEY, JSON.stringify(KID_FRIENDLY.slice(14)));
        const saved = planOf(
          [day('2026-10-24', open(...KID_FRIENDLY.slice(0, 3)), open(...KID_FRIENDLY.slice(3, 6)))],
          { kidFriendly: true },
        );
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

        store = await reload();
        expect(store.plan()).toEqual({ ...saved, kidFriendly: false });
        expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'), 'not saved').toEqual(
          store.plan(),
        );
      });

      it('keeps a saved accepted kid-friendly plan kid-friendly while only 14 kid-friendly recipes are suggested, saving nothing, tells kidFriendly false for it, and starts a new plan from it only when it is not kid-friendly, drawing from every suggested recipe', async () => {
        localStorage.setItem(REMOVED_KEY, JSON.stringify(KID_FRIENDLY.slice(14)));
        const stored = JSON.stringify(
          planOf([day('2026-10-24', picked(KID_FRIENDLY[0]), picked(KID_FRIENDLY[1]))], {
            accepted: true,
            kidFriendly: true,
          }),
        );
        localStorage.setItem(STORAGE_KEY, stored);

        store = await reload();
        expect(store.plan().kidFriendly, 'accepted plan').toBe(true);
        expect(localStorage.getItem(STORAGE_KEY), 'accepted plan saved').toBe(stored);
        expect(store.kidFriendly()).toBe(false);

        const accepted = store.plan();
        store.newPlan({ ...DEFAULT_SETTINGS, kidFriendly: true });
        expect(store.plan(), 'kid-friendly new plan').toBe(accepted);
        store.newPlan({ ...DEFAULT_SETTINGS, kidFriendly: store.kidFriendly() });
        expect(store.plan().kidFriendly, 'new plan').toBe(false);
        expect(
          suggestionsOf(store.plan()).filter((name) => NOT_KID_FRIENDLY.includes(name)).length,
          'strong flavours in the new plan',
        ).toBeGreaterThan(0);
      });

      it('keeps "Penne arrabbiata" suggested by a saved plan that is not kid-friendly when loading it, and saves nothing', async () => {
        const stored = JSON.stringify(
          planOf(
            [
              day(
                '2026-10-24',
                open('Spaghetti carbonara', 'Penne arrabbiata', 'Mac and cheese'),
                picked('Pad thai with chicken'),
              ),
            ],
            { kidFriendly: false },
          ),
        );
        localStorage.setItem(STORAGE_KEY, stored);

        store = await reload();
        expect(store.plan().days).toEqual(JSON.parse(stored).days);
        expect(localStorage.getItem(STORAGE_KEY)).toBe(stored);
      });

      it('keeps the same plan and writes nothing once the own recipe "Plain Rice", suggested, is edited to use chili flakes, keeping its name, while kid-friendly is off', async () => {
        storeOwnRecipes(PLAIN_RICE);
        await load(
          planOf(
            [
              day(
                '2026-10-24',
                open('Spaghetti carbonara', 'Plain Rice', 'Mac and cheese'),
                picked('Potato goulash'),
              ),
            ],
            { kidFriendly: false },
          ),
        );
        TestBed.inject(RecipeStore).replace(PLAIN_RICE.name, withChiliFlakes(PLAIN_RICE));
        const before = store.plan();
        const setItem = vi.spyOn(Storage.prototype, 'setItem');

        try {
          store.recipeEdited(PLAIN_RICE.name, PLAIN_RICE.name);
          expect(setItem).not.toHaveBeenCalled();
        } finally {
          setItem.mockRestore();
        }
        expect(store.plan()).toBe(before);
      });

      it('tells "limit" from deleteBlock for the own recipe "Plain Rice" and deletes nothing while it is one of exactly 15 kid-friendly recipes suggested with kid-friendly on, and null while it is off', async () => {
        storeOwnRecipes(PLAIN_RICE);
        store = await reload();
        leaveSuggested(
          store,
          26,
          ...KID_FRIENDLY.slice(0, 14),
          PLAIN_RICE.name,
          ...NOT_KID_FRIENDLY,
        );
        expect(store.deleteBlock(PLAIN_RICE.name), 'off').toBeNull();

        store.newPlan({ ...DEFAULT_SETTINGS, kidFriendly: true });
        expect(store.deleteBlock(PLAIN_RICE.name), 'on').toBe('limit');
        store.deleteRecipe(PLAIN_RICE.name);
        expect(
          TestBed.inject(RecipeStore)
            .own()
            .map((recipe) => recipe.name),
        ).toEqual([PLAIN_RICE.name]);
      });
    });

    async function load(plan: Plan) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
      store = await reload();
      expect(store.plan(), 'saved plan not loaded').toEqual(plan);
    }

    function withChiliFlakes(recipe: Recipe): Recipe {
      return {
        ...recipe,
        ingredients: [...recipe.ingredients, { name: 'chili flakes', amount: 1, unit: 'tsp' }],
      };
    }
  });

  describe('recipes not suggested', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('suggests only the 15 recipes left suggested in a new plan, after "Other suggestions", picks and "Cook extra"', () => {
      const suggested = leaveSuggested(store, 15);
      const expectOnlySuggested = (step: string) =>
        expect(
          suggestionsOf(store.plan()).filter((name) => !suggested.includes(name)),
          step,
        ).toEqual([]);

      store.newPlan(DEFAULT_SETTINGS);
      expectOnlySuggested('new plan');
      for (const meal of mealRefs(store.plan())) {
        for (let click = 1; click <= 5; click++) {
          store.otherSuggestions(meal);
          expectOnlySuggested(`day ${meal.day} ${meal.kind}, "Other suggestions" ${click}`);
        }
      }
      for (const meal of mealRefs(store.plan()).slice(0, -1)) {
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
      expect(store.removed(), 'Penne arrabbiata not removed').toContain('Penne arrabbiata');

      store.restoreRecipe('Penne arrabbiata');
      store.newPlan(DEFAULT_SETTINGS);
      expect(suggestionsOf(store.plan())).toContain('Penne arrabbiata');
    });

    it('keeps a plan with a pick of a removed recipe, and a meal remembering it among the suggestions it showed, unchanged after a reload', async () => {
      const saved = planOf([
        day(
          '2026-10-24',
          picked('Shakshuka with bread', [
            'Chickpea and spinach curry',
            'Shakshuka with bread',
            'Fish tacos',
          ]),
          picked('Spaghetti carbonara', [
            'Shakshuka with bread',
            'Spaghetti carbonara',
            'Niçoise salad',
          ]),
        ),
        day(
          '2026-10-25',
          open('Bean burritos', 'Potato goulash', 'Chicken fajitas'),
          picked('Mac and cheese'),
        ),
      ]);
      await load(saved);

      store.removeRecipe('Shakshuka with bread');
      store = await reload();
      expect(store.removed(), 'Shakshuka with bread not removed after the reload').toEqual([
        'Shakshuka with bread',
      ]);
      expect(store.plan()).toEqual(saved);
    });

    it('keeps a pick of a removed recipe, and leaves an accepted plan unchanged', async () => {
      await load(
        planOf([
          day(
            '2026-10-24',
            picked('Shakshuka with bread'),
            open('Spaghetti carbonara', 'Niçoise salad', 'Chickpea and spinach curry'),
          ),
        ]),
      );
      store.removeRecipe('Shakshuka with bread');
      expect(store.removed(), 'Shakshuka with bread not removed').toEqual(['Shakshuka with bread']);
      expect(store.plan().days[0].lunch).toEqual(picked('Shakshuka with bread'));

      localStorage.clear();
      const accepted = planOf(
        [day('2026-10-24', picked('Shakshuka with bread'), picked('Spaghetti carbonara'))],
        { accepted: true },
      );
      await load(accepted);
      store.removeRecipe('Shakshuka with bread');
      expect(store.removed(), 'Shakshuka with bread not removed from an accepted plan').toEqual([
        'Shakshuka with bread',
      ]);
      expect(store.plan()).toEqual(accepted);
    });

    it('brings back the other suggestions in their places on "Undo" of a meal that picked one of them, and another recipe not removed where the removed one was', async () => {
      await load(
        planOf([
          day(
            '2026-10-24',
            open('Shakshuka with bread', 'Spaghetti carbonara', 'Niçoise salad'),
            open('Chickpea and spinach curry', 'Fish tacos', 'Bean burritos'),
          ),
        ]),
      );
      store.pick(LUNCH, 'Spaghetti carbonara');
      store.removeRecipe('Shakshuka with bread');
      expect(store.removed(), 'Shakshuka with bread not removed').toEqual(['Shakshuka with bread']);

      store.clear(LUNCH);
      expectReopenedWithout('Shakshuka with bread');
    });

    it('brings back the other suggestions in their places on "Undo" of a meal that picked the removed recipe, and another recipe not removed in its place', async () => {
      await load(
        planOf([
          day(
            '2026-10-24',
            open('Shakshuka with bread', 'Spaghetti carbonara', 'Niçoise salad'),
            open('Chickpea and spinach curry', 'Fish tacos', 'Bean burritos'),
          ),
        ]),
      );
      store.pick(LUNCH, 'Shakshuka with bread');
      store.removeRecipe('Shakshuka with bread');
      expect(store.removed(), 'Shakshuka with bread not removed').toEqual(['Shakshuka with bread']);
      expect(store.plan().days[0].lunch.recipe, 'pick lost').toBe('Shakshuka with bread');

      store.clear(LUNCH);
      expectReopenedWithout('Shakshuka with bread');
    });

    it("leaves the suggestions shown as they are when a removed recipe is brought back, and changes nothing when bringing back one that isn't removed or removing an unknown or removed one", () => {
      store.removeRecipe('Shakshuka with bread');
      expect(store.removed(), 'Shakshuka with bread not removed').toEqual(['Shakshuka with bread']);
      const plan = store.plan();

      store.restoreRecipe('Shakshuka with bread');
      expect(store.removed()).toEqual([]);
      expect(store.plan()).toEqual(plan);

      store.removeRecipe('Chickpea and spinach curry');
      expect(store.removed(), 'Chickpea and spinach curry not removed').toEqual([
        'Chickpea and spinach curry',
      ]);
      const before = saved();
      store.restoreRecipe('Shakshuka with bread');
      expect(saved(), 'after bringing back Shakshuka with bread').toEqual(before);
      store.removeRecipe('Imaginary stew');
      expect(saved(), 'after removing Imaginary stew').toEqual(before);
      store.removeRecipe('Chickpea and spinach curry');
      expect(saved(), 'after removing Chickpea and spinach curry again').toEqual(before);
    });

    it('changes nothing when removing a recipe while exactly 15 are suggested', () => {
      const suggested = leaveSuggested(store, 15);
      const before = saved();

      store.removeRecipe(suggested[0]);
      expect(saved()).toEqual(before);
    });

    it('takes out the 5 easy recipes of #29 like any other, and 24 more of the 44 recipes but not a 30th, as 15 stay suggested', () => {
      EASY_RECIPES.forEach((name) => store.removeRecipe(name));
      expect(store.removed(), 'easy recipes not removed').toEqual(EASY_RECIPES);
      expect(suggestionsOf(store.plan()).filter((name) => EASY_RECIPES.includes(name))).toEqual([]);

      NAMES.slice(0, 25).forEach((name) => store.removeRecipe(name));
      expect(store.removed()).toEqual([...EASY_RECIPES, ...NAMES.slice(0, 24)]);
      expect(store.canRemove()).toBe(false);
    });

    it('keeps the removed recipes, saved in the order removed, after a reload and "New plan", and reads a saved list without unknown names and duplicates, or as empty when it is not a list of names or leaves fewer than 15 suggested', async () => {
      store.removeRecipe('Chickpea and spinach curry');
      store.removeRecipe('Shakshuka with bread');
      expect(store.removed()).toEqual(['Chickpea and spinach curry', 'Shakshuka with bread']);
      expect(storedRemoved()).toEqual(['Chickpea and spinach curry', 'Shakshuka with bread']);
      store = await reload();
      expect(store.removed(), 'after a reload').toEqual([
        'Chickpea and spinach curry',
        'Shakshuka with bread',
      ]);
      store.newPlan(DEFAULT_SETTINGS);
      expect(store.removed(), 'after "New plan"').toEqual([
        'Chickpea and spinach curry',
        'Shakshuka with bread',
      ]);
      expect(storedRemoved(), 'saved after "New plan"').toEqual([
        'Chickpea and spinach curry',
        'Shakshuka with bread',
      ]);

      localStorage.setItem(
        REMOVED_KEY,
        JSON.stringify(['Shakshuka with bread', 'Imaginary stew', 'Shakshuka with bread']),
      );
      expect((await reload()).removed(), 'unknown name and duplicate').toEqual([
        'Shakshuka with bread',
      ]);
      localStorage.setItem(REMOVED_KEY, '{}');
      expect((await reload()).removed(), '{}').toEqual([]);
      localStorage.setItem(REMOVED_KEY, JSON.stringify(NAMES.slice(14)));
      expect((await reload()).removed(), 'leaving 14 suggested').toEqual([]);
    });

    it('saves the removed recipes without one brought back, the others in their order, and with it last when it is removed again', async () => {
      store.removeRecipe('Chickpea and spinach curry');
      store.removeRecipe('Shakshuka with bread');
      store.removeRecipe('Fish tacos');
      store.restoreRecipe('Shakshuka with bread');
      expect(storedRemoved()).toEqual(['Chickpea and spinach curry', 'Fish tacos']);
      store = await reload();
      expect(store.removed(), 'after a reload').toEqual([
        'Chickpea and spinach curry',
        'Fish tacos',
      ]);

      store.removeRecipe('Shakshuka with bread');
      expect(store.removed()).toEqual([
        'Chickpea and spinach curry',
        'Fish tacos',
        'Shakshuka with bread',
      ]);
      expect(storedRemoved()).toEqual([
        'Chickpea and spinach curry',
        'Fish tacos',
        'Shakshuka with bread',
      ]);
    });

    it('saves the plan with the replacement of a removed suggestion, so a reload shows it', async () => {
      await load(
        planOf([
          day(
            '2026-10-24',
            open('Spaghetti carbonara', 'Shakshuka with bread', 'Niçoise salad'),
            open('Chickpea and spinach curry', 'Fish tacos', 'Bean burritos'),
          ),
        ]),
      );
      store.removeRecipe('Shakshuka with bread');
      const after = store.plan();
      expect(after.days[0].lunch.suggestions[1], 'Shakshuka with bread not replaced').not.toBe(
        'Shakshuka with bread',
      );

      expect((await reload()).plan()).toEqual(after);
    });

    it('replaces a removed recipe still suggested by the saved plan when loading it, keeps the other suggestions in their places and saves the plan with the replacement', async () => {
      localStorage.setItem(REMOVED_KEY, JSON.stringify(['Shakshuka with bread']));
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          planOf([
            day(
              '2026-10-24',
              open('Spaghetti carbonara', 'Shakshuka with bread', 'Niçoise salad'),
              open('Chickpea and spinach curry', 'Fish tacos', 'Bean burritos'),
            ),
          ]),
        ),
      );

      store = await reload();
      const [lunch, dinner] = [store.plan().days[0].lunch, store.plan().days[0].dinner];
      expect(lunch.suggestions[0]).toBe('Spaghetti carbonara');
      expect(lunch.suggestions[1]).not.toBe('Shakshuka with bread');
      expect(NAMES).toContain(lunch.suggestions[1]);
      expect(lunch.suggestions[2]).toBe('Niçoise salad');
      expect(dinner.suggestions).toEqual([
        'Chickpea and spinach curry',
        'Fish tacos',
        'Bean burritos',
      ]);
      expect(suggestionsOf(store.plan())).not.toContain('Shakshuka with bread');
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'), 'not saved').toEqual(
        store.plan(),
      );

      const before = saved();
      store.removeRecipe('Shakshuka with bread');
      expect(saved(), 'after removing Shakshuka with bread again').toEqual(before);
      expect((await reload()).plan(), 'after a reload').toEqual(before.plan);
    });

    it('removes a recipe and replaces it in the plan when saving fails', async () => {
      await load(
        planOf([
          day(
            '2026-10-24',
            open('Spaghetti carbonara', 'Shakshuka with bread', 'Niçoise salad'),
            open('Chickpea and spinach curry', 'Fish tacos', 'Bean burritos'),
          ),
        ]),
      );
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('quota exceeded', 'QuotaExceededError');
      });

      store.removeRecipe('Shakshuka with bread');
      expect(store.removed()).toEqual(['Shakshuka with bread']);
      expect(store.plan().days[0].lunch.suggestions).not.toContain('Shakshuka with bread');
    });

    it('reads a saved list holding something other than a name as empty', async () => {
      localStorage.setItem(REMOVED_KEY, JSON.stringify(['Shakshuka with bread', 42]));

      expect((await reload()).removed()).toEqual([]);
    });

    it('reads a saved list leaving exactly 15 recipes suggested once its unknown names are dropped', async () => {
      const removals = NAMES.slice(15);
      localStorage.setItem(REMOVED_KEY, JSON.stringify(['Imaginary stew', ...removals]));

      expect((await reload()).removed()).toEqual(removals);
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

    async function load(plan: Plan) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
      store = await reload();
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

  describe('load (#44)', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('creates a 5-day plan for 2 people starting today and saves it under fooplan.plan when nothing is saved (#44 3)', async () => {
      localStorage.clear();
      const loaded = unloaded();

      await loaded.load();
      expect(loaded.ready()).toBe(true);
      expectFreshPlan(loaded.plan(), '2026-10-24');
      expect(loaded.plan().people).toBe(2);
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toEqual(loaded.plan());
    });

    it('replaces the plan and the removed recipes with the ones saved since when loaded again, and is not ready while that load runs (#44 4b)', async () => {
      const loaded = unloaded();
      await loaded.load();
      const saved = planOf([
        day(
          '2026-10-22',
          picked('Spaghetti carbonara'),
          open('Fish tacos', 'Bean burritos', 'Potato goulash'),
        ),
      ]);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
      localStorage.setItem(REMOVED_KEY, JSON.stringify(['Niçoise salad']));

      const loading = loaded.load();
      expect(loaded.ready(), 'during the load').toBe(false);
      await loading;
      expect(loaded.ready(), 'after the load').toBe(true);
      expect(loaded.plan()).toEqual(saved);
      expect(loaded.removed()).toEqual(['Niçoise salad']);
    });

    it('reads the backend once per key for two loads started before the first is done, which share one promise (#44 5)', async () => {
      const read = vi.spyOn(LocalStorageBackend.prototype, 'read');
      const loaded = unloaded();

      const first = loaded.load();
      const second = loaded.load();
      expect(second).toBe(first);
      await Promise.all([first, second]);
      expect(read.mock.calls.map(([key]) => key).sort()).toEqual([
        STORAGE_KEY,
        RECIPES_KEY,
        REMOVED_KEY,
      ]);
    });

    it('shows a meal picked while saving fails, and throws nothing (#44 7)', async () => {
      const loaded = unloaded();
      await loaded.load();
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError');
      });
      const recipe = loaded.plan().days[0].lunch.suggestions[0];

      expect(() => loaded.pick(LUNCH, recipe)).not.toThrow();
      expect(loaded.plan().days[0].lunch.recipe).toBe(recipe);
    });

    describe('edge cases', () => {
      it('reads and writes nothing, and is not ready, before its first load (#44 3a)', () => {
        const saved = JSON.stringify(
          planOf([day('2026-10-22', picked('Spaghetti carbonara'), picked('Fish tacos'))]),
        );
        localStorage.setItem(STORAGE_KEY, saved);
        localStorage.setItem(REMOVED_KEY, JSON.stringify(['Niçoise salad']));
        storeOwnRecipes(QUICK_DAL);
        const getItem = vi.spyOn(Storage.prototype, 'getItem');
        const setItem = vi.spyOn(Storage.prototype, 'setItem');

        const created = unloaded();
        expect(created.ready()).toBe(false);
        expect(created.plan().days).toEqual([]);
        expect(created.removed()).toEqual([]);
        const keys = [STORAGE_KEY, REMOVED_KEY, RECIPES_KEY];
        expect(getItem.mock.calls.filter(([key]) => keys.includes(key))).toEqual([]);
        expect(setItem.mock.calls.filter(([key]) => keys.includes(key))).toEqual([]);
        expect(localStorage.getItem(STORAGE_KEY), 'saved plan').toBe(saved);
      });

      it('ignores changes before its first load: nothing is saved, and the load brings the saved plan and removed recipes (#44 3b)', async () => {
        const saved = planOf([
          day(
            '2026-10-22',
            picked('Spaghetti carbonara'),
            open('Fish tacos', 'Potato goulash', 'Pizza toast'),
          ),
        ]);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
        localStorage.setItem(REMOVED_KEY, JSON.stringify(['Niçoise salad']));
        const setItem = vi.spyOn(Storage.prototype, 'setItem');
        const created = unloaded();

        created.removeRecipe('Bean burritos');
        created.addItem('toilet paper');
        expect(created.newPlan({ ...DEFAULT_SETTINGS, days: 2 }), 'new plan started').toBe(false);
        expect(created.plan().days, 'plan changed').toEqual([]);
        expect(created.removed(), 'removed changed').toEqual([]);
        expect(setItem).not.toHaveBeenCalled();

        await created.load();
        expect(created.plan()).toEqual(saved);
        expect(created.removed()).toEqual(['Niçoise salad']);
      });

      it('ignores changes while it loads again: nothing is saved, and the load brings what is saved (#44 4e)', async () => {
        const loaded = unloaded();
        await loaded.load();
        const saved = loaded.plan();
        const recipe = saved.days[0].lunch.suggestions[0];
        const setItem = vi.spyOn(Storage.prototype, 'setItem');

        const loading = loaded.load();
        loaded.pick(LUNCH, recipe);
        loaded.removeRecipe('Bean burritos');
        await loading;
        expect(setItem).not.toHaveBeenCalled();
        expect(loaded.plan()).toEqual(saved);
        expect(loaded.removed()).toEqual([]);
      });

      it('deletes no own recipe while it is not loaded, even with the recipes loaded (#44 3c)', async () => {
        storeOwnRecipes(QUICK_DAL);
        const created = unloaded();
        await TestBed.inject(RecipeStore).load();
        const setItem = vi.spyOn(Storage.prototype, 'setItem');

        created.deleteRecipe('Quick Dal');
        expect(TestBed.inject(RecipeStore).own()).toEqual([QUICK_DAL]);
        expect(setItem).not.toHaveBeenCalled();
      });

      it('loads again after a load whose backend read threw at once (#44 5d)', async () => {
        const loaded = unloaded({ provide: StorageBackend, useValue: new ThrowingOnceBackend() });

        await expect(loaded.load()).rejects.toThrow('not read');
        expect(loaded.ready(), 'ready after the failed load').toBe(false);
        await loaded.load();
        expect(loaded.ready()).toBe(true);
        expect(loaded.plan().days).toHaveLength(5);
      });

      it('reads again on a load() called as soon as a load has made the store ready (#44 5b)', async () => {
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
        expect(read).toHaveBeenCalledTimes(6);
      });

      it('loads the own recipes again first, so a saved plan picking one saved since keeps its pick (#44 4c)', async () => {
        const loaded = unloaded();
        await loaded.load();
        storeOwnRecipes(QUICK_DAL);
        const saved = planOf([
          day(
            '2026-10-24',
            picked('Quick Dal'),
            open('Fish tacos', 'Bean burritos', 'Potato goulash'),
          ),
        ]);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

        await loaded.load();
        expect(TestBed.inject(RecipeStore).own()).toEqual([QUICK_DAL]);
        expect(loaded.plan()).toEqual(saved);
      });

      it('shows a meal picked when the backend rejects the write, passes the plan to it, and leaves no rejection unhandled (#44 7a)', async () => {
        const backend = new RejectingBackend();
        const loaded = unloaded({ provide: StorageBackend, useValue: backend });
        await loaded.load();
        const recipe = loaded.plan().days[0].lunch.suggestions[0];

        const unhandled = await unhandledRejections(() => loaded.pick(LUNCH, recipe));
        expect(loaded.plan().days[0].lunch.recipe).toBe(recipe);
        expect(backend.writes.at(-1)).toEqual([STORAGE_KEY, loaded.plan()]);
        expect(unhandled).toEqual([]);
      });
    });

    // A fresh injector, as a page reload makes, with the store not loaded yet
    function unloaded(...providers: Provider[]): PlanStore {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: RANDOM, useValue: seededRandom(seed++) },
          { provide: TODAY, useValue: () => today },
          ...providers,
        ],
      });
      return TestBed.inject(PlanStore);
    }
  });

  function createStore(): Promise<PlanStore> {
    TestBed.configureTestingModule({
      providers: [
        // A new seed on every load, so a reload draws other suggestions unless the plan was saved
        { provide: RANDOM, useValue: seededRandom(seed++) },
        { provide: TODAY, useValue: () => today },
      ],
    });
    return loadStores();
  }

  // A fresh injector reading the same localStorage, as a page reload would
  function reload(): Promise<PlanStore> {
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

  function expectKidFriendly(step: string) {
    expect(
      suggestionsOf(store.plan()).filter((name) => NOT_KID_FRIENDLY.includes(name)),
      step,
    ).toEqual([]);
  }

  function expectFreshPlan(plan: Plan, startDate: string) {
    expect(plan.days).toHaveLength(DEFAULT_SETTINGS.days);
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
