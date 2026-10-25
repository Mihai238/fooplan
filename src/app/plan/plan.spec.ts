import {
  acceptPlan,
  clearMeal,
  createPlan,
  DEFAULT_DAYS,
  DEFAULT_PEOPLE,
  isComplete,
  leftoversOf,
  Meal,
  MealRef,
  otherSuggestions,
  parsePlan,
  pickRecipe,
  Plan,
  PlanDay,
  setCookExtra,
  setDays,
  setPeople,
} from './plan';
import { DINNER, LUNCH, seededRandom } from './testing';

const RECIPES = [
  'Chili',
  'Curry',
  'Dal',
  'Fajitas',
  'Goulash',
  'Lasagne',
  'Minestrone',
  'Pesto',
  'Quiche',
  'Risotto',
  'Shakshuka',
  'Tacos',
];
const THIRTY_RECIPES = Array.from({ length: 30 }, (_, i) => `Recipe ${i + 1}`);
const SEEDS = [1, 2, 3, 42, 2026];

describe('plan', () => {
  describe('createPlan', () => {
    it('starts with the default days, from the start date across a month end, every meal open, for the default people', () => {
      const plan = createPlan('2026-10-30', RECIPES, seededRandom(1));
      expect(plan.days.map((day) => day.date)).toEqual([
        '2026-10-30',
        '2026-10-31',
        '2026-11-01',
        '2026-11-02',
        '2026-11-03',
      ]);
      expect(plan.days).toHaveLength(DEFAULT_DAYS);
      expect(plan.people).toBe(DEFAULT_PEOPLE);
      expect(plan.accepted).toBe(false);
      expect(meals(plan).every((meal) => meal.recipe === null)).toBe(true);
    });
  });

  describe('setDays', () => {
    it('rejects 0 and 6 days and accepts 1 and 5', () => {
      const plan = createPlan('2026-10-24', RECIPES, seededRandom(1));
      expectUnchanged(plan, (p) => setDays(p, 0, RECIPES, seededRandom(2)));
      expectUnchanged(plan, (p) => setDays(p, 6, RECIPES, seededRandom(2)));
      const oneDay = setDays(plan, 1, RECIPES, seededRandom(2));
      expect(oneDay.days).toHaveLength(1);
      expect(setDays(oneDay, 5, RECIPES, seededRandom(3)).days).toHaveLength(5);
    });

    it('rejects a number of days that is not whole', () => {
      const plan = createPlan('2026-10-24', RECIPES, seededRandom(1));
      expectUnchanged(plan, (p) => setDays(p, 2.5, RECIPES, seededRandom(2)));
    });

    it('returns the same plan when the days are set to the current number', () => {
      const plan = createPlan('2026-10-24', RECIPES, seededRandom(1));
      expectUnchanged(plan, (p) => setDays(p, DEFAULT_DAYS, RECIPES, seededRandom(2)));
    });

    it('keeps the existing days and their picks when growing and adds open days with the following dates, each meal with three suggestions', () => {
      const plan: Plan = {
        days: [
          day('2026-10-30', picked('Chili'), open('Dal', 'Fajitas', 'Lasagne')),
          day('2026-10-31', picked('Curry'), picked('Goulash')),
        ],
        people: 3,
        accepted: false,
      };
      const grown = setDays(plan, 5, RECIPES, seededRandom(1));
      expect(grown.days.map((d) => d.date)).toEqual([
        '2026-10-30',
        '2026-10-31',
        '2026-11-01',
        '2026-11-02',
        '2026-11-03',
      ]);
      expect(grown.days.slice(0, 2)).toEqual(plan.days);
      expect(grown.people).toBe(3);
      expect(grown.accepted).toBe(false);
      for (const newDay of grown.days.slice(2)) {
        for (const meal of [newDay.lunch, newDay.dinner]) {
          expect(meal.recipe, newDay.date).toBeNull();
          expectValidSuggestions(meal, grown, RECIPES);
        }
      }
    });

    it('drops days from the end when shrinking, so their recipes can be suggested again', () => {
      const recipes = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
      const plan: Plan = {
        days: [
          day('2026-10-24', picked('A'), open('D', 'E', 'F')),
          day('2026-10-25', picked('B'), picked('C')),
        ],
        people: 2,
        accepted: false,
      };
      const shrunk = setDays(plan, 1, recipes, seededRandom(1));
      expect(shrunk.days).toHaveLength(1);
      expect(shrunk.days[0].date).toBe('2026-10-24');
      expect(shrunk.days[0].lunch).toEqual(picked('A'));
      expect(shrunk.days[0].dinner.recipe).toBeNull();

      // Only G would be left if B and C stayed picked, so the new three must reuse both
      const suggestions = otherSuggestions(shrunk, DINNER, recipes, seededRandom(2)).days[0].dinner
        .suggestions;
      expect([...suggestions].sort()).toEqual(['B', 'C', 'G']);
    });

    it('turns "Cook extra" off when shrinking makes its day the last one', () => {
      const plan: Plan = {
        days: [
          day('2026-10-24', picked('Chili'), picked('Curry')),
          day('2026-10-25', picked('Dal'), picked('Fajitas'), true),
          day('2026-10-26', covered(), open('Goulash', 'Lasagne', 'Minestrone')),
        ],
        people: 2,
        accepted: false,
      };
      const shrunk = setDays(plan, 2, RECIPES, seededRandom(1));
      expect(shrunk.days).toHaveLength(2);
      expect(shrunk.days[1]).toEqual({ ...plan.days[1], cookExtra: false });
      expect(shrunk.days[0]).toEqual(plan.days[0]);
    });

    it('keeps "Cook extra" and the covered lunch when shrinking leaves the next day in the plan', () => {
      const plan: Plan = {
        days: [
          day('2026-10-24', picked('Chili'), picked('Curry'), true),
          day('2026-10-25', covered(), picked('Dal')),
          day('2026-10-26', picked('Fajitas'), open('Goulash', 'Lasagne', 'Minestrone')),
        ],
        people: 2,
        accepted: false,
      };
      const shrunk = setDays(plan, 2, RECIPES, seededRandom(1));
      expect(shrunk.days).toEqual(plan.days.slice(0, 2));
      expect(leftoversOf(shrunk, 1)).toBe('Curry');
    });
  });

  describe('setPeople', () => {
    it('rejects 0 people and a number of people that is not whole', () => {
      const plan = createPlan('2026-10-24', RECIPES, seededRandom(1));
      expectUnchanged(plan, (p) => setPeople(p, 0));
      expectUnchanged(plan, (p) => setPeople(p, 1.5));
    });

    it('accepts any whole number of people from 1 up', () => {
      const plan = createPlan('2026-10-24', RECIPES, seededRandom(1));
      expect(setPeople(plan, 1).people).toBe(1);
      expect(setPeople(plan, 50).people).toBe(50);
    });

    it('returns the same plan when the people are set to the current number', () => {
      const plan = createPlan('2026-10-24', RECIPES, seededRandom(1));
      expectUnchanged(plan, (p) => setPeople(p, DEFAULT_PEOPLE));
    });
  });

  describe('suggestions', () => {
    it('offers three different recipes for every open meal, none of them picked for another meal', () => {
      for (const seed of SEEDS) {
        const random = seededRandom(seed);
        let plan = createPlan('2026-10-24', RECIPES, random);
        openMealsOf(plan).forEach((meal) => expectValidSuggestions(meal, plan, RECIPES, seed));

        plan = pickRecipe(plan, LUNCH, plan.days[0].lunch.suggestions[0], RECIPES, random);
        const thirdDinner: MealRef = { day: 2, kind: 'dinner' };
        plan = pickRecipe(plan, thirdDinner, plan.days[2].dinner.suggestions[1], RECIPES, random);
        expect(pickedRecipes(plan), `seed ${seed}`).toHaveLength(2);
        openMealsOf(plan).forEach((meal) => expectValidSuggestions(meal, plan, RECIPES, seed));
      }
    });
  });

  describe('pickRecipe', () => {
    it('sets the recipe and removes the suggestions of the picked meal', () => {
      const plan = oneDayPlan(open('Chili', 'Curry', 'Dal'), open('Fajitas', 'Goulash', 'Lasagne'));
      const result = pickRecipe(plan, LUNCH, 'Chili', RECIPES, seededRandom(1));
      expect(result.days[0].lunch).toEqual(picked('Chili'));
      expect(result.days[0].dinner).toEqual(open('Fajitas', 'Goulash', 'Lasagne'));
    });

    it('rejects a recipe that is not one of the meal suggestions', () => {
      const plan = oneDayPlan(open('Chili', 'Curry', 'Dal'), open('Fajitas', 'Goulash', 'Lasagne'));
      expectUnchanged(plan, (p) => pickRecipe(p, LUNCH, 'Fajitas', RECIPES, seededRandom(1)));
      expectUnchanged(plan, (p) => pickRecipe(p, LUNCH, 'Unknown', RECIPES, seededRandom(1)));
    });

    it('replaces the picked recipe in another open meal showing it with an unpicked recipe, so it still shows three different recipes', () => {
      for (const seed of SEEDS) {
        const plan: Plan = {
          days: [
            day('2026-10-24', open('Chili', 'Curry', 'Dal'), open('Fajitas', 'Chili', 'Goulash')),
            day('2026-10-25', open('Lasagne', 'Minestrone', 'Pesto'), picked('Quiche')),
          ],
          people: 2,
          accepted: false,
        };
        const result = pickRecipe(plan, LUNCH, 'Chili', RECIPES, seededRandom(seed));
        const dinner = result.days[0].dinner;
        expect(dinner.recipe, `seed ${seed}`).toBeNull();
        expect(dinner.suggestions, `seed ${seed}`).toContain('Fajitas');
        expect(dinner.suggestions, `seed ${seed}`).toContain('Goulash');
        expect(dinner.suggestions, `seed ${seed}`).not.toContain('Chili');
        expectValidSuggestions(dinner, result, RECIPES, seed);
      }
    });

    it('leaves the suggestions of open meals not showing the picked recipe unchanged', () => {
      const plan: Plan = {
        days: [
          day('2026-10-24', open('Chili', 'Curry', 'Dal'), open('Fajitas', 'Chili', 'Goulash')),
          day('2026-10-25', open('Lasagne', 'Minestrone', 'Pesto'), picked('Quiche')),
        ],
        people: 2,
        accepted: false,
      };
      const result = pickRecipe(plan, LUNCH, 'Chili', RECIPES, seededRandom(1));
      expect(result.days[1]).toEqual(plan.days[1]);
    });

    it('never uses a recipe twice when all 10 meals of a 5-day plan are filled from their suggestions', () => {
      for (const seed of SEEDS) {
        const random = seededRandom(seed);
        let plan = createPlan('2026-10-24', THIRTY_RECIPES, random);
        expect(plan.days, `seed ${seed}`).toHaveLength(5);
        plan.days.forEach((_, dayIndex) => {
          for (const kind of ['lunch', 'dinner'] as const) {
            const suggestions = plan.days[dayIndex][kind].suggestions;
            expect(suggestions, `seed ${seed}, day ${dayIndex} ${kind}`).toHaveLength(3);
            const recipe = suggestions[Math.floor(random() * suggestions.length)];
            plan = pickRecipe(plan, { day: dayIndex, kind }, recipe, THIRTY_RECIPES, random);
          }
        });
        const recipes = pickedRecipes(plan);
        expect(recipes, `seed ${seed}`).toHaveLength(10);
        expect(new Set(recipes).size, `seed ${seed}: ${recipes.join(', ')}`).toBe(10);
      }
    });
  });

  describe('otherSuggestions', () => {
    it('replaces the three suggestions with three different unpicked recipes, none of them one it was showing', () => {
      for (const seed of SEEDS) {
        const plan = oneDayPlan(open('Chili', 'Curry', 'Dal'), picked('Fajitas'));
        const result = otherSuggestions(plan, LUNCH, RECIPES, seededRandom(seed));
        const lunch = result.days[0].lunch;
        expect(lunch.recipe, `seed ${seed}`).toBeNull();
        expect(lunch.suggestions, `seed ${seed}`).not.toContain('Chili');
        expect(lunch.suggestions, `seed ${seed}`).not.toContain('Curry');
        expect(lunch.suggestions, `seed ${seed}`).not.toContain('Dal');
        expectValidSuggestions(lunch, result, RECIPES, seed);
        expect(result.days[0].dinner).toEqual(picked('Fajitas'));
      }
    });

    it('rejects a meal that already has a recipe', () => {
      const plan = oneDayPlan(open('Chili', 'Curry', 'Dal'), picked('Fajitas'));
      expectUnchanged(plan, (p) => otherSuggestions(p, DINNER, RECIPES, seededRandom(1)));
    });
  });

  describe('clearMeal', () => {
    it('opens the meal again with three suggestions, which can include its own recipe', () => {
      const recipes = ['A', 'B', 'C', 'D'];
      const plan = oneDayPlan(picked('A'), picked('B'));
      const result = clearMeal(plan, LUNCH, recipes, seededRandom(1));
      expect(result.days[0].lunch.recipe).toBeNull();
      // B stays picked, so A, C and D are the only possible suggestions
      expect([...result.days[0].lunch.suggestions].sort()).toEqual(['A', 'C', 'D']);
      expect(result.days[0].dinner).toEqual(picked('B'));
    });

    it('rejects a meal that is already open', () => {
      const plan = oneDayPlan(open('Chili', 'Curry', 'Dal'), picked('Fajitas'));
      expectUnchanged(plan, (p) => clearMeal(p, LUNCH, RECIPES, seededRandom(1)));
    });

    it('turns "Cook extra" off when clearing its dinner and opens the next lunch with three unpicked suggestions', () => {
      for (const seed of SEEDS) {
        const plan = cookExtraPlan();
        const result = clearMeal(plan, DINNER, RECIPES, seededRandom(seed));
        expect(result.days[0].cookExtra, `seed ${seed}`).toBe(false);
        expect(result.days[0].dinner.recipe, `seed ${seed}`).toBeNull();
        expectValidSuggestions(result.days[0].dinner, result, RECIPES, seed);
        expect(result.days[1].lunch.recipe, `seed ${seed}`).toBeNull();
        expectValidSuggestions(result.days[1].lunch, result, RECIPES, seed);
        expect(leftoversOf(result, 1), `seed ${seed}`).toBeNull();
        expect(result.days[0].lunch).toEqual(picked('Chili'));
        expect(result.days[1].dinner).toEqual(plan.days[1].dinner);
      }
    });
  });

  describe('setCookExtra', () => {
    it('replaces the pick of the next lunch with the leftovers of the dinner, so its recipe can be suggested again', () => {
      const recipes = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      const plan: Plan = {
        days: [
          day('2026-10-24', picked('A'), picked('B')),
          day('2026-10-25', picked('C'), open('D', 'E', 'F')),
        ],
        people: 2,
        accepted: false,
      };
      const result = setCookExtra(plan, 0, true, recipes, seededRandom(1));
      expect(result.days[0]).toEqual({ ...plan.days[0], cookExtra: true });
      expect(result.days[1]).toEqual({ ...plan.days[1], lunch: covered() });
      expect(leftoversOf(result, 1)).toBe('B');

      // D, E and F are excluded as the current suggestions, so C, G and H are the only possible new ones
      const suggestions = otherSuggestions(
        result,
        { day: 1, kind: 'dinner' },
        recipes,
        seededRandom(2),
      ).days[1].dinner.suggestions;
      expect([...suggestions].sort()).toEqual(['C', 'G', 'H']);
    });

    it('returns the same plan when the option is set to its current value', () => {
      expectUnchanged(cookExtraPlan(), (p) => setCookExtra(p, 0, true, RECIPES, seededRandom(1)));
      const off: Plan = {
        days: [
          day('2026-10-24', picked('Chili'), picked('Curry')),
          day(
            '2026-10-25',
            open('Dal', 'Fajitas', 'Goulash'),
            open('Lasagne', 'Minestrone', 'Pesto'),
          ),
        ],
        people: 2,
        accepted: false,
      };
      expectUnchanged(off, (p) => setCookExtra(p, 0, false, RECIPES, seededRandom(1)));
    });

    it('replaces an open next lunch with the leftovers of the dinner', () => {
      const plan: Plan = {
        days: [
          day('2026-10-24', picked('Chili'), picked('Curry')),
          day(
            '2026-10-25',
            open('Dal', 'Fajitas', 'Goulash'),
            open('Lasagne', 'Minestrone', 'Pesto'),
          ),
        ],
        people: 2,
        accepted: false,
      };
      const result = setCookExtra(plan, 0, true, RECIPES, seededRandom(1));
      expect(result.days[0].cookExtra).toBe(true);
      expect(result.days[1]).toEqual({ ...plan.days[1], lunch: covered() });
      expect(leftoversOf(result, 1)).toBe('Curry');
    });

    it('opens the next lunch again with three unpicked suggestions when the option is turned off', () => {
      for (const seed of SEEDS) {
        const plan = cookExtraPlan();
        const result = setCookExtra(plan, 0, false, RECIPES, seededRandom(seed));
        expect(result.days[0]).toEqual({ ...plan.days[0], cookExtra: false });
        expect(result.days[1].lunch.recipe, `seed ${seed}`).toBeNull();
        expectValidSuggestions(result.days[1].lunch, result, RECIPES, seed);
        expect(result.days[1].dinner).toEqual(plan.days[1].dinner);
        expect(leftoversOf(result, 1), `seed ${seed}`).toBeNull();
      }
    });

    it('rejects the dinner on the last day, an open dinner and a day outside the plan', () => {
      const lastDay: Plan = {
        days: [
          day('2026-10-24', picked('Chili'), picked('Curry')),
          day('2026-10-25', picked('Dal'), picked('Fajitas')),
        ],
        people: 2,
        accepted: false,
      };
      expectUnchanged(lastDay, (p) => setCookExtra(p, 1, true, RECIPES, seededRandom(1)));
      const oneDay = oneDayPlan(picked('Chili'), picked('Curry'));
      expectUnchanged(oneDay, (p) => setCookExtra(p, 0, true, RECIPES, seededRandom(1)));
      expectUnchanged(storedPlan(), (p) => setCookExtra(p, 0, true, RECIPES, seededRandom(1)));
      expectUnchanged(lastDay, (p) => setCookExtra(p, -1, true, RECIPES, seededRandom(1)));
      expectUnchanged(lastDay, (p) => setCookExtra(p, 2, true, RECIPES, seededRandom(1)));
    });

    it('leaves an accepted plan unchanged', () => {
      const accepted: Plan = {
        days: [
          day('2026-10-24', picked('Chili'), picked('Curry')),
          day('2026-10-25', picked('Dal'), picked('Fajitas')),
        ],
        people: 2,
        accepted: true,
      };
      expectUnchanged(accepted, (p) => setCookExtra(p, 0, true, RECIPES, seededRandom(1)));
      const acceptedCookExtra = completeCookExtraPlan(true);
      expectUnchanged(acceptedCookExtra, (p) =>
        setCookExtra(p, 0, false, RECIPES, seededRandom(1)),
      );
    });
  });

  describe('a lunch covered by leftovers', () => {
    it('rejects picking a recipe, clearing it and other suggestions', () => {
      const plan = cookExtraPlan();
      const lunch: MealRef = { day: 1, kind: 'lunch' };
      expectUnchanged(plan, (p) => pickRecipe(p, lunch, 'Goulash', RECIPES, seededRandom(1)));
      expectUnchanged(plan, (p) => clearMeal(p, lunch, RECIPES, seededRandom(1)));
      expectUnchanged(plan, (p) => otherSuggestions(p, lunch, RECIPES, seededRandom(1)));
    });

    it('gets no suggestions when a recipe is picked for another meal', () => {
      const plan = cookExtraPlan();
      const result = pickRecipe(plan, { day: 1, kind: 'dinner' }, 'Dal', RECIPES, seededRandom(1));
      expect(result.days[1].dinner).toEqual(picked('Dal'));
      expect(result.days[1].lunch).toEqual(covered());
      expect(leftoversOf(result, 1)).toBe('Curry');
    });
  });

  describe('leftoversOf', () => {
    it('is the recipe of the previous dinner for a covered lunch', () => {
      expect(leftoversOf(cookExtraPlan(), 1)).toBe('Curry');
    });

    it('is null for an open or picked lunch, the first day and a day outside the plan', () => {
      expect(leftoversOf(storedPlan(), 1)).toBeNull();
      expect(leftoversOf(storedPlan(), 0)).toBeNull();
      expect(leftoversOf(cookExtraPlan(), 0)).toBeNull();
      expect(leftoversOf(cookExtraPlan(), 2)).toBeNull();
      expect(leftoversOf(cookExtraPlan(), -1)).toBeNull();
    });
  });

  describe('isComplete', () => {
    it('is false while a meal is open and true once every meal has a recipe', () => {
      expect(isComplete(oneDayPlan(picked('Chili'), open('Curry', 'Dal', 'Fajitas')))).toBe(false);
      expect(isComplete(oneDayPlan(picked('Chili'), picked('Curry')))).toBe(true);
    });

    it('counts a lunch covered by leftovers as filled, but not an open dinner next to it', () => {
      expect(isComplete(completeCookExtraPlan(false))).toBe(true);
      expect(isComplete(cookExtraPlan())).toBe(false);
    });
  });

  describe('acceptPlan', () => {
    it('rejects a plan with an open meal', () => {
      const plan = oneDayPlan(picked('Chili'), open('Curry', 'Dal', 'Fajitas'));
      expectUnchanged(plan, (p) => acceptPlan(p));
    });

    it('marks a complete plan accepted and keeps its meals', () => {
      const plan = oneDayPlan(picked('Chili'), picked('Curry'));
      const result = acceptPlan(plan);
      expect(result.accepted).toBe(true);
      expect(result.days).toEqual(plan.days);
      expect(result.people).toBe(plan.people);
    });

    it('leaves an accepted plan unchanged by every change', () => {
      // Can't be reached in the app, but with an open meal only the accepted check stops each change
      const plan: Plan = {
        ...oneDayPlan(picked('Chili'), open('Curry', 'Dal', 'Fajitas')),
        accepted: true,
      };
      expectUnchanged(plan, (p) => setDays(p, 3, RECIPES, seededRandom(1)));
      expectUnchanged(plan, (p) => setPeople(p, 4));
      expectUnchanged(plan, (p) => clearMeal(p, LUNCH, RECIPES, seededRandom(1)));
      expectUnchanged(plan, (p) => pickRecipe(p, DINNER, 'Curry', RECIPES, seededRandom(1)));
      expectUnchanged(plan, (p) => otherSuggestions(p, DINNER, RECIPES, seededRandom(1)));
      const complete: Plan = { ...oneDayPlan(picked('Chili'), picked('Curry')), accepted: true };
      expectUnchanged(complete, (p) => acceptPlan(p));
    });
  });

  describe('parsePlan', () => {
    it('reads back a plan in progress and an accepted plan from their JSON', () => {
      const random = seededRandom(1);
      let plan = createPlan('2026-10-24', RECIPES, random);
      plan = setPeople(plan, 3);
      plan = pickRecipe(plan, LUNCH, plan.days[0].lunch.suggestions[0], RECIPES, random);
      expect(parsePlan(JSON.parse(JSON.stringify(plan)), RECIPES)).toEqual(plan);

      const accepted: Plan = { ...oneDayPlan(picked('Chili'), picked('Curry')), accepted: true };
      expect(parsePlan(JSON.parse(JSON.stringify(accepted)), RECIPES)).toEqual(accepted);
    });

    it('reads back a plan with "Cook extra", in progress and accepted, and a plan saved without the option as off', () => {
      for (const plan of [cookExtraPlan(), completeCookExtraPlan(true)]) {
        expect(parsePlan(JSON.parse(JSON.stringify(plan)), RECIPES)).toEqual(plan);
      }

      const savedBefore: any = storedPlan();
      savedBefore.days.forEach((d: any) => delete d.cookExtra);
      expect(parsePlan(savedBefore, RECIPES)).toEqual(storedPlan());
    });

    it('returns null for "Cook extra" on the last day, on an open dinner or with an uncovered next lunch, for an empty lunch not covered by leftovers and for an empty dinner', () => {
      const broken: ((plan: Plan) => void)[] = [
        (plan) => {
          plan.days[1].dinner = picked('Dal');
          plan.days[1].cookExtra = true;
        },
        (plan) => (plan.days[0].dinner = open('Goulash', 'Lasagne', 'Minestrone')),
        (plan) => (plan.days[1].lunch = picked('Goulash')),
        (plan) => (plan.days[1].lunch = open('Goulash', 'Lasagne', 'Minestrone')),
        (plan) => (plan.days[0].cookExtra = false),
        (plan) => (plan.days[0].lunch = covered()),
        (plan) => (plan.days[1].dinner = empty()),
      ];
      expect(parsePlan(cookExtraPlan(), RECIPES), 'valid base plan').not.toBeNull();
      broken.forEach((breakIt, i) => {
        const plan = cookExtraPlan();
        breakIt(plan);
        expect(parsePlan(plan, RECIPES), `change ${i}: ${JSON.stringify(plan)}`).toBeNull();
      });
    });

    it('returns null for values that are not a plan', () => {
      for (const value of [null, undefined, 'plan', 42, [], {}]) {
        expect(parsePlan(value, RECIPES), JSON.stringify(value)).toBeNull();
      }
    });

    it('returns null for a plan with a wrongly shaped field', () => {
      const broken: ((plan: any) => void)[] = [
        (plan) => (plan.days = 'Monday'),
        (plan) => delete plan.people,
        (plan) => (plan.people = '2'),
        (plan) => (plan.people = 0),
        (plan) => (plan.people = 1.5),
        (plan) => (plan.accepted = 'yes'),
        (plan) => (plan.days[0].cookExtra = 'yes'),
        (plan) => (plan.days[0].date = 42),
        (plan) => (plan.days[0].date = '24.10.2026'),
        (plan) => (plan.days[0].date = '2026-02-31'),
        (plan) => delete plan.days[0].dinner,
        (plan) => (plan.days[0].lunch.recipe = 7),
        (plan) => (plan.days[0].dinner.suggestions = 'Dal, Fajitas'),
      ];
      expect(parsePlan(storedPlan(), RECIPES), 'valid base plan').not.toBeNull();
      broken.forEach((breakIt, i) => {
        const plan = storedPlan();
        breakIt(plan);
        expect(parsePlan(plan, RECIPES), `change ${i}: ${JSON.stringify(plan)}`).toBeNull();
      });
    });

    it('returns null for a plan naming a recipe that does not exist', () => {
      const unknownPick = storedPlan();
      unknownPick.days[0].lunch.recipe = 'Pizza';
      expect(parsePlan(unknownPick, RECIPES)).toBeNull();

      const unknownSuggestion = storedPlan();
      unknownSuggestion.days[0].dinner.suggestions = ['Dal', 'Fajitas', 'Pizza'];
      expect(parsePlan(unknownSuggestion, RECIPES)).toBeNull();
    });

    it('returns null for a plan with 0 or 6 days', () => {
      const noDays = storedPlan();
      noDays.days = [];
      expect(parsePlan(noDays, RECIPES)).toBeNull();

      const sixDays = storedPlan();
      sixDays.days = ['24', '25', '26', '27', '28', '29'].map((date) =>
        day(
          `2026-10-${date}`,
          open('Chili', 'Curry', 'Dal'),
          open('Fajitas', 'Goulash', 'Lasagne'),
        ),
      );
      expect(parsePlan(sixDays, RECIPES)).toBeNull();
    });

    it('returns null for a plan whose dates are not consecutive from the first', () => {
      const dateLists = [
        ['2026-02-31', '2026-03-01'],
        ['2026-02-31', '2026-03-04'],
        ['2026-02-28', '2026-02-29'],
        ['2026-10-24', '2026-10-26'],
        ['2026-10-24', '2026-10-24'],
        ['2026-10-25', '2026-10-24'],
      ];
      expect(parsePlan(storedPlan(), RECIPES), 'valid base plan').not.toBeNull();
      for (const dates of dateLists) {
        const plan = storedPlan();
        plan.days.forEach((d, i) => (d.date = dates[i]));
        expect(parsePlan(plan, RECIPES), dates.join(', ')).toBeNull();
      }
    });

    it('returns null for a plan using a recipe twice or suggesting a picked recipe', () => {
      const pickedTwice = storedPlan();
      pickedTwice.days[1].dinner = picked('Chili');
      expect(parsePlan(pickedTwice, RECIPES)).toBeNull();

      const suggestedOnSameDay = storedPlan();
      suggestedOnSameDay.days[0].dinner = open('Chili', 'Dal', 'Fajitas');
      expect(parsePlan(suggestedOnSameDay, RECIPES)).toBeNull();

      const suggestedOnAnotherDay = storedPlan();
      suggestedOnAnotherDay.days[1].lunch = open('Lasagne', 'Minestrone', 'Chili');
      expect(parsePlan(suggestedOnAnotherDay, RECIPES)).toBeNull();
    });

    it('returns null for an accepted plan with an open meal', () => {
      const plan = { ...storedPlan(), accepted: true };
      expect(parsePlan(plan, RECIPES)).toBeNull();
    });

    it('returns null for a picked meal with suggestions or an open meal without exactly three different suggestions', () => {
      const broken: Meal[] = [
        { recipe: 'Chili', suggestions: ['Quiche', 'Risotto', 'Shakshuka'] },
        open(),
        open('Quiche'),
        open('Quiche', 'Risotto'),
        open('Quiche', 'Risotto', 'Quiche'),
        open('Quiche', 'Risotto', 'Shakshuka', 'Tacos'),
      ];
      expect(parsePlan(storedPlan(), RECIPES), 'valid base plan').not.toBeNull();
      broken.forEach((meal) => {
        const plan = storedPlan();
        plan.days[0].lunch = meal;
        expect(parsePlan(plan, RECIPES), JSON.stringify(meal)).toBeNull();
      });
    });
  });

  function storedPlan(): Plan {
    return {
      days: [
        day('2026-10-24', picked('Chili'), open('Dal', 'Fajitas', 'Goulash')),
        day('2026-10-25', open('Lasagne', 'Minestrone', 'Pesto'), picked('Curry')),
      ],
      people: 2,
      accepted: false,
    };
  }

  // Day 1 lunch eats the leftovers of the Curry dinner on day 0
  function cookExtraPlan(): Plan {
    return {
      days: [
        day('2026-10-24', picked('Chili'), picked('Curry'), true),
        day('2026-10-25', covered(), open('Dal', 'Fajitas', 'Goulash')),
      ],
      people: 2,
      accepted: false,
    };
  }

  function completeCookExtraPlan(accepted: boolean): Plan {
    const plan = cookExtraPlan();
    plan.days[1].dinner = picked('Dal');
    return { ...plan, accepted };
  }

  function oneDayPlan(lunch: Meal, dinner: Meal): Plan {
    return { days: [day('2026-10-24', lunch, dinner)], people: 2, accepted: false };
  }

  function day(date: string, lunch: Meal, dinner: Meal, cookExtra = false): PlanDay {
    return { date, lunch, dinner, cookExtra };
  }

  function open(...suggestions: string[]): Meal {
    return { recipe: null, suggestions };
  }

  function covered(): Meal {
    return empty();
  }

  function empty(): Meal {
    return { recipe: null, suggestions: [] };
  }

  function picked(recipe: string): Meal {
    return { recipe, suggestions: [] };
  }

  function expectUnchanged(plan: Plan, change: (plan: Plan) => Plan) {
    const before = structuredClone(plan);
    expect(change(plan)).toBe(plan);
    expect(plan, 'the input plan was modified').toEqual(before);
  }

  function expectValidSuggestions(
    meal: Meal,
    plan: Plan,
    recipes: readonly string[],
    seed?: number,
  ) {
    const context = `${seed === undefined ? '' : `seed ${seed}: `}${JSON.stringify(meal)}`;
    expect(meal.suggestions, context).toHaveLength(3);
    expect(new Set(meal.suggestions).size, context).toBe(3);
    expect(
      meal.suggestions.every((name) => recipes.includes(name)),
      context,
    ).toBe(true);
    const picks = pickedRecipes(plan);
    expect(
      meal.suggestions.filter((name) => picks.includes(name)),
      context,
    ).toEqual([]);
  }

  function meals(plan: Plan): Meal[] {
    return plan.days.flatMap((d) => [d.lunch, d.dinner]);
  }

  function openMealsOf(plan: Plan): Meal[] {
    return meals(plan).filter((meal) => meal.recipe === null);
  }

  function pickedRecipes(plan: Plan): string[] {
    return meals(plan).flatMap((meal) => (meal.recipe === null ? [] : [meal.recipe]));
  }
});
