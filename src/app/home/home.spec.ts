import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { groceryList, itemKey } from '../groceries/groceries';
import { addedKey, Plan } from '../plan/plan';
import { PlanStore, RANDOM, TODAY } from '../plan/plan-store';
import {
  covered,
  day,
  DINNER,
  eatingOut,
  LUNCH,
  open,
  picked,
  planOf,
  seededRandom,
} from '../plan/testing';
import { RECIPES } from '../recipes/recipes';
import { PLAIN_RICE, QUICK_DAL, storeOwnRecipes } from '../recipes/testing';
import { LANGUAGE_KEY } from '../testing';
import { Home } from './home';

// A Thursday
const TODAY_DATE = '2026-10-29';

describe('Home', () => {
  let fixture: ComponentFixture<Home>;
  let element: HTMLElement;
  let store: PlanStore;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    document.documentElement.lang = 'en';
  });

  it('shows the title, the intro and "Start planning" to /plan for a new plan, with today\'s meals not picked yet', async () => {
    await openHome();
    expect(textOf(element.querySelector('h1'))).toBe('Lunch and dinner, planned in a few minutes');
    expect(textOf(element.querySelector('.lead'))).toBe(
      'Pick meals for the next few days from quick recipes, then shop from one grocery list.',
    );
    expect(mainLink()).toEqual(['Start planning', '/plan']);
    expect(textOf(element.querySelector('.today h2'))).toBe('Today');
    expect(textOf(element.querySelector('.today .date'))).toBe('Thursday, October 29');
    expect(todayRows()).toEqual([
      ['Lunch', 'Not picked yet'],
      ['Dinner', 'Not picked yet'],
    ]);
    expect(element.querySelector('.today a')).toBeNull();
  });

  describe('main link', () => {
    it('says "Continue planning · 3 of 10 meals picked" to /plan once some meals are picked, following the plan', async () => {
      await openHome();
      for (const meal of [LUNCH, DINNER, { day: 1, kind: 'lunch' } as const]) {
        store.pick(meal, store.plan().days[meal.day][meal.kind].suggestions[0]);
      }
      await fixture.whenStable();
      expect(mainLink()).toEqual(['Continue planning · 3 of 10 meals picked', '/plan']);
    });

    it('says "Accept your plan" to /plan once every meal is filled, eating out included', async () => {
      await openHome(planOf([day(TODAY_DATE, picked('Spaghetti pomodoro'), eatingOut())]));
      expect(mainLink()).toEqual(['Accept your plan', '/plan']);
    });

    it('says "Open the grocery list · 3 of N in the cart" to /groceries once the plan is accepted, counting the added items', async () => {
      const accepted = planOf(
        [day(TODAY_DATE, picked('Spaghetti pomodoro'), picked('Chicken curry with rice'))],
        { accepted: true },
      );
      const lines = groceryList(accepted, RECIPES);
      await openHome({
        ...accepted,
        added: ['coffee'],
        ticked: [itemKey(lines[0]), itemKey(lines[1]), addedKey('coffee')],
      });
      expect(mainLink()).toEqual([
        `Open the grocery list · 3 of ${lines.length + 1} in the cart`,
        '/groceries',
      ]);
    });
  });

  describe('Today panel', () => {
    it("shows today's recipes linked to their pages with their minutes, and an own recipe without minutes", async () => {
      storeOwnRecipes(QUICK_DAL);
      await openHome(planOf([day(TODAY_DATE, picked('Spaghetti pomodoro'), picked('Quick Dal'))]));
      expect(todayRows()).toEqual([
        ['Lunch', 'Spaghetti pomodoro 25 minutes'],
        ['Dinner', 'Quick Dal'],
      ]);
      expect(todayLinks()).toEqual([
        ['Spaghetti pomodoro', '/recipes/spaghetti-pomodoro'],
        ['Quick Dal', '/recipes/quick-dal'],
      ]);
      expect(element.querySelectorAll('.today .minutes')).toHaveLength(1);
    });

    it('shows a lunch covered by leftovers with the recipe linked, and a dinner eaten out', async () => {
      await openHome(
        planOf([
          day('2026-10-28', picked('Spaghetti pomodoro'), picked('Chicken curry with rice'), true),
          day(TODAY_DATE, covered(), eatingOut()),
        ]),
      );
      expect(todayRows()).toEqual([
        ['Lunch', 'Leftovers: Chicken curry with rice'],
        ['Dinner', 'Eating out'],
      ]);
      expect(todayLinks()).toEqual([
        ['Chicken curry with rice', '/recipes/chicken-curry-with-rice'],
      ]);
    });

    it('says the plan doesn\'t include today, with "Go to the plan" to /plan, for a plan of other days', async () => {
      await openHome(
        planOf([
          day('2026-10-27', picked('Spaghetti pomodoro'), picked('Chicken curry with rice')),
        ]),
      );
      expect(textOf(element.querySelector('.today .date'))).toBe('Thursday, October 29');
      expect(element.querySelector('.today dl')).toBeNull();
      expect(textOf(element.querySelector('.today .not-today'))).toBe(
        "Your plan doesn't include today. Go to the plan",
      );
      expect(todayLinks()).toEqual([['Go to the plan', '/plan']]);
    });
  });

  describe('cards', () => {
    it('links to Plan, Grocery list and Recipes, with no meals picked, the list not ready and the recipe count for a new plan', async () => {
      await openHome();
      expect(cards()).toEqual([
        ['Plan', 'No meals picked yet', '/plan'],
        ['Grocery list', 'Ready once the plan is accepted', '/groceries'],
        ['Recipes', '44 recipes', '/recipes'],
      ]);
    });

    it('counts the picked meals on the Plan card while planning, leftovers and eating out included', async () => {
      await openHome(
        planOf([
          day('2026-10-28', picked('Spaghetti pomodoro'), picked('Chicken curry with rice'), true),
          day(TODAY_DATE, covered(), eatingOut()),
          day(
            '2026-10-30',
            picked('Teriyaki chicken with rice'),
            open('Spaghetti carbonara', 'Bean burritos', 'Fish tacos'),
          ),
        ]),
      );
      expect(cards()[0][1]).toBe('5 of 6 meals picked');
      expect(mainLink()).toEqual(['Continue planning · 5 of 6 meals picked', '/plan']);
    });

    it("shows the accepted plan's summary, kid-friendly included, and the cart count on the Grocery list card", async () => {
      const accepted = planOf(
        [day(TODAY_DATE, picked('Spaghetti pomodoro'), picked('Chicken curry with rice'))],
        { accepted: true, kidFriendly: true, people: 3 },
      );
      const lines = groceryList(accepted, RECIPES);
      await openHome({ ...accepted, ticked: [itemKey(lines[0])] });
      expect(cards().map(([, fact]) => fact)).toEqual([
        '1 day for 3 people, kid-friendly',
        `1 of ${lines.length} in the cart`,
        '44 recipes',
      ]);
    });

    it('counts the own recipes on the Recipes card, "1 of your own" for one', async () => {
      storeOwnRecipes(QUICK_DAL, PLAIN_RICE);
      await openHome();
      expect(cards()[2][1]).toBe('46 recipes, 2 of your own');

      TestBed.resetTestingModule();
      localStorage.clear();
      storeOwnRecipes(QUICK_DAL);
      await openHome();
      expect(cards()[2][1]).toBe('45 recipes, 1 of your own');
    });
  });

  it('shows the page in German: title, date, recipe name, minutes, links and cards', async () => {
    localStorage.setItem(LANGUAGE_KEY, 'de');
    storeOwnRecipes(QUICK_DAL, PLAIN_RICE);
    await openHome(
      planOf([day(TODAY_DATE, picked('Chicken curry with rice'), eatingOut())], {
        accepted: true,
        people: 1,
      }),
    );
    expect(textOf(element.querySelector('h1'))).toBe(
      'Mittag- und Abendessen in wenigen Minuten geplant',
    );
    expect(mainLink()[0]).toMatch(/^Einkaufsliste öffnen · 0 von \d+ im Wagen$/);
    expect(textOf(element.querySelector('.today h2'))).toBe('Heute');
    expect(textOf(element.querySelector('.today .date'))).toBe('Donnerstag, 29. Oktober');
    expect(todayRows()).toEqual([
      ['Mittagessen', 'Hähnchencurry mit Reis 40 Minuten'],
      ['Abendessen', 'Außer Haus'],
    ]);
    expect(cards().map(([title, fact]) => [title, fact])).toEqual([
      ['Plan', '1 Tag für 1 Person'],
      ['Einkaufsliste', expect.stringMatching(/^0 von \d+ im Wagen$/)],
      ['Rezepte', '46 Rezepte, davon 2 eigene'],
    ]);
    expect(textOf(element.querySelector('.how h2'))).toBe('So geht’s');
    expect(textOf(element.querySelector('.how-intro'))).toBe(
      'In drei Schritten von der leeren Woche zum vollen Einkaufswagen.',
    );
    expect(textOf(element.querySelector('.credits'))).toBe(
      'Fotos: Katie Smith, Ella Olsson, Peter Wendt, Kevin McCutcheon auf Unsplash',
    );
  });

  it('explains how it works in three ordered steps', async () => {
    await openHome();
    expect(textOf(element.querySelector('.how h2'))).toBe('How it works');
    expect(textOf(element.querySelector('.how-intro'))).toBe(
      'From an empty week to a full cart in three steps.',
    );
    expect(
      Array.from(element.querySelectorAll('.how ol > li')).map((step) => [
        textOf(step.querySelector('h3')),
        textOf(step.querySelector('p')),
      ]),
    ).toEqual([
      ['Pick the meals', 'Three suggestions for each lunch and dinner.'],
      ['Accept the plan', 'Once every meal is filled.'],
      ['Shop the list', 'Amounts scaled to your people, grouped by shop section.'],
    ]);
  });

  it('shows the hero and card photos, credited to their photographers on Unsplash', async () => {
    await openHome();
    expect(element.querySelector('img.hero')?.getAttribute('src')).toBe('images/home/hero.jpg');
    expect(
      Array.from(element.querySelectorAll('a.card img')).map((image) => image.getAttribute('src')),
    ).toEqual(['images/home/plan.jpg', 'images/home/groceries.jpg', 'images/home/recipes.jpg']);
    const credits = element.querySelector('.credits');
    expect(textOf(credits)).toBe(
      'Photos: Katie Smith, Ella Olsson, Peter Wendt, Kevin McCutcheon on Unsplash',
    );
    expect(
      Array.from(credits!.querySelectorAll('a')).map((link) => [
        textOf(link),
        link.getAttribute('href'),
        link.getAttribute('target'),
      ]),
    ).toEqual([
      ['Katie Smith', 'https://unsplash.com/photos/uQs1802D0CQ', '_blank'],
      ['Ella Olsson', 'https://unsplash.com/photos/lMcRyBx4G50', '_blank'],
      ['Peter Wendt', 'https://unsplash.com/photos/-r5KSMkyoSc', '_blank'],
      ['Kevin McCutcheon', 'https://unsplash.com/photos/APDMfLHZiRA', '_blank'],
    ]);
  });

  // A fresh app on the saved plan, as a reload makes, or on a new one without
  async function openHome(saved?: Plan) {
    if (saved) {
      localStorage.setItem('fooplan.plan', JSON.stringify(saved));
    }
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: RANDOM, useValue: seededRandom(1) },
        { provide: TODAY, useValue: () => TODAY_DATE },
      ],
    });
    store = TestBed.inject(PlanStore);
    if (saved) {
      expect(store.plan(), 'saved plan not loaded').toEqual(saved);
    }
    fixture = TestBed.createComponent(Home);
    await fixture.whenStable();
    element = fixture.nativeElement as HTMLElement;
  }

  function mainLink(): [string, string | null] {
    const link = element.querySelector('.intro a');
    return [textOf(link), link?.getAttribute('href') ?? null];
  }

  function todayRows(): string[][] {
    return Array.from(element.querySelectorAll('.today .meal')).map((row) => [
      textOf(row.querySelector('dt')),
      textOf(row.querySelector('dd')),
    ]);
  }

  function todayLinks(): string[][] {
    return Array.from(element.querySelectorAll('.today a')).map((link) => [
      textOf(link),
      link.getAttribute('href')!,
    ]);
  }

  function cards(): string[][] {
    return Array.from(element.querySelectorAll('a.card')).map((card) => [
      textOf(card.querySelector('h2')),
      textOf(card.querySelector('p')),
      card.getAttribute('href')!,
    ]);
  }

  function textOf(node: Element | null): string {
    return (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }
});
