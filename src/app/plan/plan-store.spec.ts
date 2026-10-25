import { TestBed } from '@angular/core/testing';
import { groceryList, itemKey } from '../groceries/groceries';
import { RECIPES } from '../recipes/recipes';
import { addedKey, DEFAULT_DAYS, MealRef, Plan } from './plan';
import { PlanStore, RANDOM, TODAY } from './plan-store';
import { acceptOneDayPlan, day, DINNER, LUNCH, open, seededRandom, suggestionsOf } from './testing';

const STORAGE_KEY = 'fooplan.plan';

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
    const quick = RECIPES.filter((recipe) => recipe.workMinutes <= 30 && recipe.minutes <= 45).map(
      (recipe) => recipe.name,
    );
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
