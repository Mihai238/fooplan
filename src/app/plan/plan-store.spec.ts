import { TestBed } from '@angular/core/testing';
import { groceryList, itemKey } from '../groceries/groceries';
import { RECIPES } from '../recipes/recipes';
import { DEFAULT_DAYS, MealRef, Plan } from './plan';
import { PlanStore, RANDOM, TODAY } from './plan-store';
import { acceptOneDayPlan, DINNER, LUNCH, seededRandom } from './testing';

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
    for (const day of plan.days) {
      for (const meal of [day.lunch, day.dinner]) {
        expect(meal.recipe, day.date).toBeNull();
        expect(meal.suggestions, day.date).toHaveLength(3);
      }
    }
  }
});
