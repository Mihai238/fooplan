import {
  acceptPlan,
  addedKey,
  addItem,
  clearMeal,
  cookedMeals,
  createPlan,
  DEFAULT_SETTINGS,
  dropSuggestion,
  dropSuggestionsOutside,
  eatOut,
  filledMeals,
  forgetRecipe,
  isComplete,
  leftoversOf,
  Meal,
  MealRef,
  NO_SCORE,
  otherSuggestions,
  parsePlan,
  pickRecipe,
  Plan,
  Random,
  removeItem,
  renameRecipe,
  sameItem,
  Score,
  ScoreContext,
  setCookExtra,
  setKidFriendly,
  toggleTicked,
} from './plan';
import {
  covered,
  day,
  DINNER,
  eatingOut,
  empty,
  LUNCH,
  open,
  picked,
  planOf,
  seededRandom,
  suggestionsOf,
} from './testing';

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
const FOURTEEN_RECIPES = [...RECIPES, 'Udon', 'Vindaloo'];
const FORTY_RECIPES = Array.from({ length: 40 }, (_, i) => `Recipe ${i + 1}`);
const SEEDS = [1, 2, 3, 42, 2026];

describe('plan', () => {
  describe('createPlan', () => {
    it('starts with the default days, from the start date across a month end, every meal open, for the default people', () => {
      const plan = createPlan('2026-10-30', DEFAULT_SETTINGS, RECIPES, seededRandom(1));
      expect(plan.days.map((day) => day.date)).toEqual([
        '2026-10-30',
        '2026-10-31',
        '2026-11-01',
        '2026-11-02',
        '2026-11-03',
      ]);
      expect(plan.days).toHaveLength(DEFAULT_SETTINGS.days);
      expect(plan.people).toBe(DEFAULT_SETTINGS.people);
      expect(plan.accepted).toBe(false);
      expect(meals(plan).every((meal) => meal.recipe === null)).toBe(true);
    });

    it('suggests every recipe for at most one meal when there are more recipes than suggestions', () => {
      for (const seed of SEEDS) {
        const suggestions = suggestionsOf(
          createPlan('2026-10-24', DEFAULT_SETTINGS, FORTY_RECIPES, seededRandom(seed)),
        );
        expect(suggestions, `seed ${seed}`).toHaveLength(30);
        expect(new Set(suggestions).size, `seed ${seed}: ${suggestions.join(', ')}`).toBe(30);
      }
    });

    it('suggests every recipe exactly once when there are exactly as many recipes as suggestions', () => {
      const thirtyRecipes = FORTY_RECIPES.slice(0, 30);
      for (const seed of SEEDS) {
        const suggestions = suggestionsOf(
          createPlan('2026-10-24', DEFAULT_SETTINGS, thirtyRecipes, seededRandom(seed)),
        );
        expect([...suggestions].sort(), `seed ${seed}`).toEqual([...thirtyRecipes].sort());
      }
    });

    it('suggests every recipe before suggesting one again, and none more than twice, when there are fewer recipes than suggestions', () => {
      const twentyRecipes = FORTY_RECIPES.slice(0, 20);
      for (const seed of SEEDS) {
        const plan = createPlan('2026-10-24', DEFAULT_SETTINGS, twentyRecipes, seededRandom(seed));
        openMealsOf(plan).forEach((meal) =>
          expectValidSuggestions(meal, plan, twentyRecipes, seed),
        );
        const suggestions = suggestionsOf(plan);
        for (const recipe of twentyRecipes) {
          const times = suggestions.filter((name) => name === recipe).length;
          expect(times, `seed ${seed}: ${recipe} in ${suggestions.join(', ')}`).toBeGreaterThan(0);
          expect(times, `seed ${seed}: ${recipe} in ${suggestions.join(', ')}`).toBeLessThan(3);
        }
      }
    });

    it('brings only recipes no meal of the new plan suggested on the first "Other suggestions"', () => {
      for (const seed of SEEDS) {
        const random = seededRandom(seed);
        const plan = createPlan('2026-10-24', DEFAULT_SETTINGS, FORTY_RECIPES, random);
        const shownBefore = suggestionsOf(plan);
        const result = otherSuggestions(plan, LUNCH, FORTY_RECIPES, random);
        const lunch = result.days[0].lunch;
        expectValidSuggestions(lunch, result, FORTY_RECIPES, seed);
        expectNoneOf(lunch.suggestions, shownBefore, `seed ${seed}:`);
      }
    });

    it('starts a plan with the days, people and kid-friendly value it is given: 3 open days from 2026-10-27 for 4 people, kid-friendly, every suggestion among the candidates and not accepted, and 1 day for 1 person', () => {
      const candidates = FORTY_RECIPES.slice(0, 20);
      const plan = createPlan(
        '2026-10-27',
        { days: 3, people: 4, kidFriendly: true },
        candidates,
        seededRandom(1),
      );
      expect(plan.days.map((day) => day.date)).toEqual(['2026-10-27', '2026-10-28', '2026-10-29']);
      expect(plan.people).toBe(4);
      expect(plan.kidFriendly).toBe(true);
      expect(plan.accepted).toBe(false);
      openMealsOf(plan).forEach((meal) => expectValidSuggestions(meal, plan, candidates, 1));
      expect(meals(plan).every((meal) => meal.recipe === null && !meal.eatOut)).toBe(true);
      expect(suggestionsOf(plan).filter((name) => !candidates.includes(name))).toEqual([]);

      const small = createPlan(
        '2026-10-27',
        { days: 1, people: 1, kidFriendly: false },
        candidates,
        seededRandom(1),
      );
      expect(small.days.map((day) => day.date)).toEqual(['2026-10-27']);
      expect(small.people).toBe(1);
      expect(small.kidFriendly).toBe(false);
    });
  });

  describe('suggestions', () => {
    it('offers three different recipes for every open meal, none of them picked for another meal', () => {
      for (const seed of SEEDS) {
        const random = seededRandom(seed);
        let plan = createPlan('2026-10-24', DEFAULT_SETTINGS, RECIPES, random);
        openMealsOf(plan).forEach((meal) => expectValidSuggestions(meal, plan, RECIPES, seed));

        plan = pickRecipe(plan, LUNCH, plan.days[0].lunch.suggestions[0], RECIPES, random);
        const thirdDinner: MealRef = { day: 2, kind: 'dinner' };
        plan = pickRecipe(plan, thirdDinner, plan.days[2].dinner.suggestions[1], RECIPES, random);
        expect(pickedRecipes(plan), `seed ${seed}`).toHaveLength(2);
        openMealsOf(plan).forEach((meal) => expectValidSuggestions(meal, plan, RECIPES, seed));
      }
    });

    it('draws only recipes not shown yet for a pick replacement, a meal undone without remembered suggestions and a lunch reopened by turning "Cook extra" off, while such recipes are left', () => {
      for (const seed of SEEDS) {
        const shown = [
          'Minestrone',
          'Pesto',
          'Chili',
          'Curry',
          'Dal',
          'Fajitas',
          'Goulash',
          'Lasagne',
        ];

        const sharing: Plan = {
          days: [
            day('2026-10-24', open('Chili', 'Curry', 'Dal'), open('Fajitas', 'Chili', 'Goulash')),
            day('2026-10-25', open('Lasagne', 'Minestrone', 'Pesto'), picked('Quiche')),
          ],
          people: 2,
          accepted: false,
          ticked: [],
          added: [],
          shown: ['Risotto', 'Shakshuka', ...shown, 'Quiche'],
          kidFriendly: false,
        };
        const withPick = pickRecipe(sharing, LUNCH, 'Chili', FOURTEEN_RECIPES, seededRandom(seed));
        const dinner = withPick.days[0].dinner.suggestions;
        expect(dinner, `seed ${seed}, pick replacement`).toContain('Fajitas');
        expect(dinner, `seed ${seed}, pick replacement`).toContain('Goulash');
        const replacement = dinner.filter((name) => !['Fajitas', 'Goulash'].includes(name));
        expect(replacement, `seed ${seed}, pick replacement`).toHaveLength(1);
        expectNoneOf(replacement, sharing.shown, `seed ${seed}, pick replacement:`);

        const pickedLunch = oneDayPlan(picked('Chili'), open('Dal', 'Fajitas', 'Goulash'), [
          ...shown,
        ]);
        const cleared = clearMeal(pickedLunch, LUNCH, FOURTEEN_RECIPES, seededRandom(seed));
        expectValidSuggestions(cleared.days[0].lunch, cleared, FOURTEEN_RECIPES, seed);
        expectNoneOf(cleared.days[0].lunch.suggestions, shown, `seed ${seed}, undone meal:`);

        const cookExtra: Plan = { ...cookExtraPlan(), shown: [...shown] };
        const off = setCookExtra(cookExtra, 0, false, FOURTEEN_RECIPES, seededRandom(seed));
        expectValidSuggestions(off.days[1].lunch, off, FOURTEEN_RECIPES, seed);
        expectNoneOf(off.days[1].lunch.suggestions, shown, `seed ${seed}, reopened lunch:`);
      }
    });

    it('counts a lunch pick dropped by "Cook extra" as shown just now, so the recipes shown before it come back first', () => {
      const recipes = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
      for (const seed of SEEDS) {
        const nextLunchPicked: Plan = {
          days: [
            day('2026-10-24', picked('A'), picked('B')),
            day('2026-10-25', picked('C'), open('D', 'E', 'F')),
          ],
          people: 2,
          accepted: false,
          ticked: [],
          added: [],
          shown: ['C', 'G', 'H', 'I', 'A', 'B', 'D', 'E', 'F'],
          kidFriendly: false,
        };
        const cookExtra = setCookExtra(nextLunchPicked, 0, true, recipes, seededRandom(seed));
        const afterCookExtra = otherSuggestions(
          cookExtra,
          { day: 1, kind: 'dinner' },
          recipes,
          seededRandom(seed),
        );
        expect(
          [...afterCookExtra.days[1].dinner.suggestions].sort(),
          `seed ${seed}, "Cook extra"`,
        ).toEqual(['G', 'H', 'I']);
      }
    });
  });

  describe('pickRecipe', () => {
    it('sets the recipe, shows no suggestions for the picked meal and remembers the ones it showed, the picked recipe included, in their order', () => {
      const plan = oneDayPlan(open('Chili', 'Curry', 'Dal'), open('Fajitas', 'Goulash', 'Lasagne'));
      const result = pickRecipe(plan, LUNCH, 'Curry', RECIPES, seededRandom(1));
      expect(result.days[0].lunch).toEqual(picked('Curry', ['Chili', 'Curry', 'Dal']));
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
          ticked: [],
          added: [],
          shown: [],
          kidFriendly: false,
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

    it('replaces the picked recipe in every other open meal showing it with a different recipe not shown yet', () => {
      const plan: Plan = {
        days: [
          day('2026-10-24', open('Chili', 'Curry', 'Dal'), open('Chili', 'Fajitas', 'Goulash')),
          day('2026-10-25', open('Chili', 'Lasagne', 'Minestrone'), picked('Pesto')),
        ],
        people: 2,
        accepted: false,
        ticked: [],
        added: [],
        shown: ['Chili', 'Curry', 'Dal', 'Fajitas', 'Goulash', 'Lasagne', 'Minestrone', 'Pesto'],
        kidFriendly: false,
      };
      // Always takes the first fresh candidate, so drawing the second replacement before the first
      // is recorded in shown would repeat it
      const result = pickRecipe(plan, LUNCH, 'Chili', RECIPES, () => 0);
      const dinner = result.days[0].dinner;
      const nextLunch = result.days[1].lunch;
      expect(dinner.suggestions).toEqual(expect.arrayContaining(['Fajitas', 'Goulash']));
      expect(nextLunch.suggestions).toEqual(expect.arrayContaining(['Lasagne', 'Minestrone']));
      const replacements = [
        ...dinner.suggestions.filter((name) => !['Fajitas', 'Goulash'].includes(name)),
        ...nextLunch.suggestions.filter((name) => !['Lasagne', 'Minestrone'].includes(name)),
      ];
      expect(replacements).toHaveLength(2);
      expect(new Set(replacements).size, replacements.join(', ')).toBe(2);
      expectNoneOf(replacements, plan.shown);
    });

    it('leaves the suggestions of open meals not showing the picked recipe unchanged', () => {
      const plan: Plan = {
        days: [
          day('2026-10-24', open('Chili', 'Curry', 'Dal'), open('Fajitas', 'Chili', 'Goulash')),
          day('2026-10-25', open('Lasagne', 'Minestrone', 'Pesto'), picked('Quiche')),
        ],
        people: 2,
        accepted: false,
        ticked: [],
        added: [],
        shown: [],
        kidFriendly: false,
      };
      const result = pickRecipe(plan, LUNCH, 'Chili', RECIPES, seededRandom(1));
      expect(result.days[1]).toEqual(plan.days[1]);
    });

    it('replaces the picked recipe in another open meal with the unpicked recipe shown longest ago when every recipe has been shown', () => {
      const recipes = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
      for (const seed of SEEDS) {
        const plan = oneDayPlan(open('A', 'B', 'C'), open('D', 'A', 'E'), [
          'G',
          'F',
          'A',
          'B',
          'C',
          'D',
          'E',
        ]);
        const result = pickRecipe(plan, LUNCH, 'A', recipes, seededRandom(seed));
        expect([...result.days[0].dinner.suggestions].sort(), `seed ${seed}`).toEqual([
          'D',
          'E',
          'G',
        ]);
      }
    });

    it('never uses a recipe twice when all 10 meals of a 5-day plan are filled from their suggestions', () => {
      for (const seed of SEEDS) {
        const random = seededRandom(seed);
        let plan = createPlan('2026-10-24', DEFAULT_SETTINGS, FORTY_RECIPES, random);
        expect(plan.days, `seed ${seed}`).toHaveLength(5);
        plan.days.forEach((_, dayIndex) => {
          for (const kind of ['lunch', 'dinner'] as const) {
            const suggestions = plan.days[dayIndex][kind].suggestions;
            expect(suggestions, `seed ${seed}, day ${dayIndex} ${kind}`).toHaveLength(3);
            const recipe = suggestions[Math.floor(random() * suggestions.length)];
            plan = pickRecipe(plan, { day: dayIndex, kind }, recipe, FORTY_RECIPES, random);
          }
        });
        const recipes = pickedRecipes(plan);
        expect(recipes, `seed ${seed}`).toHaveLength(10);
        expect(new Set(recipes).size, `seed ${seed}: ${recipes.join(', ')}`).toBe(10);
      }
    });
  });

  describe('eatOut', () => {
    it('makes an open lunch eating out with the three suggestions it showed kept as offered, in a new plan with shown and every other meal unchanged', () => {
      const plan = planOf([
        day('2026-10-24', open('Chili', 'Curry', 'Dal'), open('Fajitas', 'Goulash', 'Lasagne')),
        day(
          '2026-10-25',
          open('Minestrone', 'Pesto', 'Quiche'),
          picked('Risotto', ['Risotto', 'Shakshuka', 'Tacos']),
        ),
      ]);
      const before = structuredClone(plan);
      const result = eatOut(plan, LUNCH);
      expect(result.days[0].lunch).toStrictEqual(eatingOut(['Chili', 'Curry', 'Dal']));
      expect(result.shown).toEqual(plan.shown);
      expect(result.days[0].dinner).toEqual(plan.days[0].dinner);
      expect(result.days[1]).toEqual(plan.days[1]);
      expect({ ...result, days: [] }).toEqual({ ...plan, days: [] });
      expect(result).not.toBe(plan);
      expect(plan, 'the input plan was modified').toEqual(before);
    });

    it('returns the same plan for an accepted plan, a day outside the plan, a lunch covered by leftovers, a picked meal and a meal already eating out', () => {
      expect(
        eatOut(storedPlan(), { day: 1, kind: 'lunch' }).days[1].lunch.eatOut,
        'open lunch of the base plan not eating out',
      ).toBe(true);
      // Can't be reached in the app, but with an open meal only the accepted check stops it
      const accepted: Plan = {
        ...oneDayPlan(picked('Chili'), open('Curry', 'Dal', 'Fajitas')),
        accepted: true,
      };
      expectUnchanged(accepted, (p) => eatOut(p, DINNER));
      expectUnchanged(storedPlan(), (p) => eatOut(p, { day: 2, kind: 'lunch' }));
      expectUnchanged(storedPlan(), (p) => eatOut(p, { day: -1, kind: 'dinner' }));
      expectUnchanged(cookExtraPlan(), (p) => eatOut(p, { day: 1, kind: 'lunch' }));
      expectUnchanged(storedPlan(), (p) => eatOut(p, LUNCH));
      for (const lunch of [eatingOut(['Chili', 'Curry', 'Dal']), eatingOut()]) {
        const plan = oneDayPlan(lunch, open('Fajitas', 'Goulash', 'Lasagne'));
        expectUnchanged(plan, (p) => eatOut(p, LUNCH));
      }
    });

    describe('edge cases', () => {
      it('makes the open dinner of the last day eating out, as any open meal', () => {
        const plan = planOf([
          day('2026-10-24', picked('Chili'), picked('Curry')),
          day(
            '2026-10-25',
            open('Dal', 'Fajitas', 'Goulash'),
            open('Lasagne', 'Minestrone', 'Pesto'),
          ),
        ]);
        const result = eatOut(plan, { day: 1, kind: 'dinner' });
        expect(result.days[1]).toEqual({
          ...plan.days[1],
          dinner: eatingOut(['Lasagne', 'Minestrone', 'Pesto']),
        });
        expect(result.days[0]).toEqual(plan.days[0]);
        expect(result.shown).toEqual(plan.shown);
      });

      it('leaves another open meal showing one of the same suggestions as it is, since eating out uses no recipe', () => {
        const plan = planOf([
          day('2026-10-24', open('Chili', 'Curry', 'Dal'), open('Dal', 'Fajitas', 'Goulash')),
        ]);
        const result = eatOut(plan, LUNCH);
        expect(result.days[0].lunch).toStrictEqual(eatingOut(['Chili', 'Curry', 'Dal']));
        expect(result.days[0].dinner).toEqual(open('Dal', 'Fajitas', 'Goulash'));
        expect(result.shown).toEqual(plan.shown);
      });
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

    it('rejects a meal eating out, with or without the suggestions it showed', () => {
      for (const lunch of [eatingOut(['Chili', 'Curry', 'Dal']), eatingOut()]) {
        const plan = oneDayPlan(lunch, open('Fajitas', 'Goulash', 'Lasagne'));
        expectUnchanged(plan, (p) => otherSuggestions(p, LUNCH, RECIPES, seededRandom(1)));
      }
    });

    it('replaces the suggestions a meal got back by undoing its pick with three unpicked recipes not shown yet, as for any open meal', () => {
      for (const seed of SEEDS) {
        const random = seededRandom(seed);
        const shown = ['Chili', 'Curry', 'Dal', 'Fajitas', 'Goulash', 'Lasagne'];
        const plan = oneDayPlan(
          open('Chili', 'Curry', 'Dal'),
          open('Fajitas', 'Goulash', 'Lasagne'),
          [...shown],
        );
        const withPick = pickRecipe(plan, LUNCH, 'Chili', FOURTEEN_RECIPES, random);
        const undone = clearMeal(withPick, LUNCH, FOURTEEN_RECIPES, random);
        expect(undone.days[0].lunch, `seed ${seed}, not undone`).toEqual(
          open('Chili', 'Curry', 'Dal'),
        );

        const result = otherSuggestions(undone, LUNCH, FOURTEEN_RECIPES, random);
        const lunch = result.days[0].lunch;
        expectValidSuggestions(lunch, result, FOURTEEN_RECIPES, seed);
        expectNoneOf(lunch.suggestions, shown, `seed ${seed}:`);
        expect(result.days[0].dinner).toEqual(open('Fajitas', 'Goulash', 'Lasagne'));
      }
    });

    it('brings only recipes not suggested anywhere in the plan yet, click after click, while such recipes are left', () => {
      for (const seed of SEEDS) {
        const random = seededRandom(seed);
        // Minestrone and Pesto were suggested earlier for the lunch; six recipes were never shown
        const seen = [
          'Minestrone',
          'Pesto',
          'Chili',
          'Curry',
          'Dal',
          'Fajitas',
          'Goulash',
          'Lasagne',
        ];
        const dinner = open('Fajitas', 'Goulash', 'Lasagne');
        let plan = oneDayPlan(open('Chili', 'Curry', 'Dal'), dinner, [...seen]);
        for (let click = 1; click <= 2; click++) {
          plan = otherSuggestions(plan, LUNCH, FOURTEEN_RECIPES, random);
          const lunch = plan.days[0].lunch;
          expectValidSuggestions(lunch, plan, FOURTEEN_RECIPES, seed);
          expectNoneOf(lunch.suggestions, seen, `seed ${seed}, click ${click}:`);
          seen.push(...lunch.suggestions);
        }
        expect(plan.days[0].dinner).toEqual(dinner);
      }
    });

    it('does not bring back a recipe whose pick was undone, without remembered suggestions, while recipes not shown yet are left', () => {
      for (const seed of SEEDS) {
        const random = seededRandom(seed);
        const shown = ['Chili', 'Curry', 'Dal', 'Fajitas', 'Goulash'];
        const plan = oneDayPlan(picked('Chili'), open('Dal', 'Fajitas', 'Goulash'), [...shown]);
        const cleared = clearMeal(plan, LUNCH, RECIPES, random);
        const seen = [...shown, ...cleared.days[0].lunch.suggestions];
        const result = otherSuggestions(cleared, DINNER, RECIPES, random);
        expectValidSuggestions(result.days[0].dinner, result, RECIPES, seed);
        expectNoneOf(result.days[0].dinner.suggestions, seen, `seed ${seed}:`);
      }
    });

    it('brings exactly the three recipes not shown yet when only three are left', () => {
      for (const seed of SEEDS) {
        const plan = oneDayPlan(
          open('Chili', 'Curry', 'Dal'),
          open('Fajitas', 'Goulash', 'Lasagne'),
          [
            'Minestrone',
            'Pesto',
            'Quiche',
            'Chili',
            'Curry',
            'Dal',
            'Fajitas',
            'Goulash',
            'Lasagne',
          ],
        );
        const result = otherSuggestions(plan, LUNCH, RECIPES, seededRandom(seed));
        expect([...result.days[0].lunch.suggestions].sort(), `seed ${seed}`).toEqual([
          'Risotto',
          'Shakshuka',
          'Tacos',
        ]);
      }
    });

    it('brings the one recipe not shown yet and fills the other slots with the recipes shown longest ago', () => {
      const recipes = [
        'Chili',
        'Curry',
        'Dal',
        'Fajitas',
        'Goulash',
        'Lasagne',
        'Minestrone',
        'Pesto',
      ];
      for (const seed of SEEDS) {
        const plan = oneDayPlan(open('Chili', 'Curry', 'Dal'), picked('Fajitas'), [
          'Goulash',
          'Lasagne',
          'Fajitas',
          'Minestrone',
          'Chili',
          'Curry',
          'Dal',
        ]);
        const result = otherSuggestions(plan, LUNCH, recipes, seededRandom(seed));
        expect([...result.days[0].lunch.suggestions].sort(), `seed ${seed}`).toEqual([
          'Goulash',
          'Lasagne',
          'Pesto',
        ]);
      }
    });

    it('takes the unpicked recipes shown longest ago once every recipe has been shown', () => {
      const recipes = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      for (const seed of SEEDS) {
        const shown = ['E', 'F', 'D', 'G', 'H', 'A', 'B', 'C'];
        const plan = oneDayPlan(open('A', 'B', 'C'), picked('D'), shown);
        const result = otherSuggestions(plan, LUNCH, recipes, seededRandom(seed));
        expect(result.days[0].lunch.recipe, `seed ${seed}`).toBeNull();
        expect([...result.days[0].lunch.suggestions].sort(), `seed ${seed}`).toEqual([
          'E',
          'F',
          'G',
        ]);
      }
    });

    it('never brings back a recipe the meal is showing, even when it was shown longest ago', () => {
      const recipes = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      for (const seed of SEEDS) {
        const shown = ['A', 'B', 'C', 'E', 'F', 'G', 'H', 'D'];
        const plan = oneDayPlan(open('A', 'B', 'C'), picked('D'), shown);
        const result = otherSuggestions(plan, LUNCH, recipes, seededRandom(seed));
        expect([...result.days[0].lunch.suggestions].sort(), `seed ${seed}`).toEqual([
          'E',
          'F',
          'G',
        ]);
      }
    });

    it('never brings back a picked recipe, even when it was shown longest ago', () => {
      const recipes = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      for (const seed of SEEDS) {
        const shown = ['D', 'E', 'F', 'G', 'H', 'A', 'B', 'C'];
        const plan = oneDayPlan(open('A', 'B', 'C'), picked('D'), shown);
        const result = otherSuggestions(plan, LUNCH, recipes, seededRandom(seed));
        expect([...result.days[0].lunch.suggestions].sort(), `seed ${seed}`).toEqual([
          'E',
          'F',
          'G',
        ]);
      }
    });

    it('counts a recipe brought back as shown just now, so the ones not brought back come first next time', () => {
      const recipes = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      for (const seed of SEEDS) {
        const random = seededRandom(seed);
        const shown = ['E', 'F', 'G', 'H', 'D', 'A', 'B', 'C'];
        let plan = oneDayPlan(open('A', 'B', 'C'), picked('D'), shown);
        plan = otherSuggestions(plan, LUNCH, recipes, random);
        expect([...plan.days[0].lunch.suggestions].sort(), `seed ${seed}, click 1`).toEqual([
          'E',
          'F',
          'G',
        ]);
        plan = otherSuggestions(plan, LUNCH, recipes, random);
        expect([...plan.days[0].lunch.suggestions].sort(), `seed ${seed}, click 2`).toEqual([
          'A',
          'B',
          'H',
        ]);
        // E, F and G were brought back after C was shown, so C is now the one shown longest ago
        plan = otherSuggestions(plan, LUNCH, recipes, random);
        expect(plan.days[0].lunch.suggestions, `seed ${seed}, click 3`).toContain('C');
        expectNoneOf(
          plan.days[0].lunch.suggestions,
          ['A', 'B', 'D', 'H'],
          `seed ${seed}, click 3:`,
        );
      }
    });

    it('takes the recipes shown longest ago that no other open meal is showing first, and only then those other open meals show', () => {
      const recipes = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
      for (const seed of SEEDS) {
        const lunch = open('A', 'B', 'C');
        const dinner = open('D', 'E', 'F');
        const plan = oneDayPlan(lunch, dinner, ['D', 'E', 'F', 'G', 'H', 'I', 'A', 'B', 'C']);
        const result = otherSuggestions(plan, LUNCH, recipes, seededRandom(seed));
        expect([...result.days[0].lunch.suggestions].sort(), `seed ${seed}`).toEqual([
          'G',
          'H',
          'I',
        ]);

        // Only G and H are shown by no other open meal, so the dinner's recipe shown longest ago
        // fills the set
        const twoLeft = oneDayPlan(lunch, dinner, ['E', 'D', 'F', 'G', 'H', 'A', 'B', 'C']);
        const fewer = otherSuggestions(twoLeft, LUNCH, recipes.slice(0, 8), seededRandom(seed));
        expect([...fewer.days[0].lunch.suggestions].sort(), `seed ${seed}`).toEqual([
          'E',
          'G',
          'H',
        ]);
      }
    });
  });

  describe('ranked draw', () => {
    const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
    // D to H are the candidates not shown yet
    const lettersPlan = () => oneDayPlan(open('A', 'B', 'C'), picked('I'), ['A', 'B', 'C', 'I']);

    it('draws the highest-scored recipes not shown yet first, the random draw breaking ties among them in the order of the recipes, and counts all three as shown', () => {
      const score: Score = (name) => (name === 'E' || name === 'G' ? 5 : 0);
      const plan = lettersPlan();
      for (const [random, expected] of [
        [() => 0, ['E', 'G', 'D']],
        [() => 0.99, ['G', 'E', 'H']],
      ] as const) {
        const result = otherSuggestions(plan, LUNCH, LETTERS, random, score);
        expect(result.days[0].lunch.suggestions, `random ${random()}`).toEqual(expected);
        expect(result.shown, `random ${random()}`).toEqual([...plan.shown, ...expected]);
      }
    });

    it('scores each next choice with the recipes chosen before it for the meal alongside', () => {
      const score: Score = (name, { alongside }) =>
        (name === 'F' && alongside.length === 0) || (name === 'H' && alongside.join() === 'F')
          ? 5
          : 0;
      for (const [random, expected] of [
        [() => 0, ['F', 'H', 'D']],
        [() => 0.99, ['F', 'H', 'G']],
      ] as const) {
        const result = otherSuggestions(lettersPlan(), LUNCH, LETTERS, random, score);
        expect(result.days[0].lunch.suggestions, `random ${random()}`).toEqual(expected);
      }
    });

    // The random draw of the code before ranking, with this plan and seed
    const RANDOM_DRAW = ['Lasagne', 'Pesto', 'Risotto'];

    it('draws the same suggestions as the random draw with a score of 0 for every recipe', () => {
      const plan = oneDayPlan(open('Chili', 'Curry', 'Dal'), picked('Fajitas'));
      const result = otherSuggestions(plan, LUNCH, RECIPES, seededRandom(1), NO_SCORE);
      expect(result.days[0].lunch.suggestions).toEqual(RANDOM_DRAW);
    });

    it('draws the same suggestions as the random draw without a score', () => {
      const plan = oneDayPlan(open('Chili', 'Curry', 'Dal'), picked('Fajitas'));
      const result = otherSuggestions(plan, LUNCH, RECIPES, seededRandom(1));
      expect(result.days[0].lunch.suggestions).toEqual(RANDOM_DRAW);
    });

    describe('edge cases', () => {
      it('fills the slots left once the recipes not shown yet run out with the recipes shown longest ago, whatever their score', () => {
        // D and H are the only ones not shown yet; G was shown longest ago, E most recently
        const plan = oneDayPlan(open('A', 'B', 'C'), picked('I'), [
          'G',
          'F',
          'E',
          'A',
          'B',
          'C',
          'I',
        ]);
        const score: Score = (name) => ({ E: 10, F: 5, H: 1 })[name] ?? 0;
        for (const seed of SEEDS) {
          const result = otherSuggestions(plan, LUNCH, LETTERS, seededRandom(seed), score);
          expect(result.days[0].lunch.suggestions, `seed ${seed}`).toEqual(['H', 'D', 'G']);
        }
      });

      it("scores the replacement of a suggestion picked for another meal or dropped with the meal's other suggestions alongside", () => {
        const recipes = LETTERS.slice(0, 8);
        const contexts: ScoreContext[] = [];
        const score: Score = (name, context) => {
          contexts.push(context);
          return name === 'H' && [...context.alongside].sort().join() === 'A,C' ? 5 : 0;
        };
        for (const seed of SEEDS) {
          contexts.length = 0;
          const plan = oneDayPlan(open('A', 'B', 'C'), open('B', 'D', 'E'), [
            'A',
            'B',
            'C',
            'D',
            'E',
          ]);
          const withPick = pickRecipe(plan, DINNER, 'B', recipes, seededRandom(seed), score);
          expect(withPick.days[0].lunch.suggestions, `seed ${seed}, pick`).toEqual(['A', 'H', 'C']);
          expect(contexts.length, `seed ${seed}, pick: contexts`).toBeGreaterThan(0);
          for (const { meal, alongside } of contexts) {
            expect(meal, `seed ${seed}, pick`).toEqual(LUNCH);
            expect([...alongside].sort(), `seed ${seed}, pick`).toEqual(['A', 'C']);
          }

          contexts.length = 0;
          const shown = ['A', 'B', 'C', 'D', 'E', 'F'];
          const dropped = dropSuggestion(
            oneDayPlan(open('A', 'B', 'C'), open('D', 'E', 'F'), shown),
            'B',
            recipes,
            seededRandom(seed),
            score,
          );
          expect(dropped.days[0].lunch.suggestions, `seed ${seed}, drop`).toEqual(['A', 'H', 'C']);
          expect(contexts.length, `seed ${seed}, drop: contexts`).toBeGreaterThan(0);
          for (const { alongside } of contexts.filter(({ meal }) => meal.kind === 'lunch')) {
            expect([...alongside].sort(), `seed ${seed}, drop`).toEqual(['A', 'C']);
          }
        }
      });

      it('restores the suggestions a meal showed when picked in their order on "Undo", whatever their score, and scores only the replacement of one picked since', () => {
        const recipes = LETTERS.slice(0, 8);
        const plan = oneDayPlan(picked('A', ['A', 'B', 'C']), picked('B'), ['A', 'B', 'C']);
        const score: Score = (name) => ({ A: -10, C: 10, G: 5 })[name] ?? 0;
        for (const seed of SEEDS) {
          const undone = clearMeal(plan, LUNCH, recipes, seededRandom(seed), score);
          expect(undone.days[0].lunch, `seed ${seed}`).toEqual(open('A', 'G', 'C'));
        }
      });
    });
  });

  describe('dropSuggestionsOutside', () => {
    const RECIPES_LEFT = [
      'Spaghetti pomodoro',
      'Spaghetti carbonara',
      'Mac and cheese',
      'Potato goulash',
      'Tuna pasta bake',
      'Fish tacos',
      'Shakshuka with bread',
    ];

    it('replaces "Penne arrabbiata" and "Pad thai with chicken" in their places in every open meal suggesting them with different recipes among the given ones, keeps the other suggestions and the dinner picked as "Niçoise salad", and returns the same plan when every suggestion is among them or the plan is accepted', () => {
      const plan = planOf([
        day(
          '2026-10-24',
          open('Penne arrabbiata', 'Spaghetti pomodoro', 'Mac and cheese'),
          picked('Niçoise salad'),
        ),
        day(
          '2026-10-25',
          open('Fish tacos', 'Pad thai with chicken', 'Tuna pasta bake'),
          open('Spaghetti carbonara', 'Penne arrabbiata', 'Potato goulash'),
        ),
      ]);
      for (const seed of SEEDS) {
        const result = dropSuggestionsOutside(plan, RECIPES_LEFT, seededRandom(seed));
        const lunch = result.days[0].lunch.suggestions;
        const { lunch: secondLunch, dinner: secondDinner } = result.days[1];
        const context = `seed ${seed}: ${suggestionsOf(result).join(', ')}`;
        expect(lunch.slice(1), context).toEqual(['Spaghetti pomodoro', 'Mac and cheese']);
        expect(result.days[0].dinner, context).toEqual(picked('Niçoise salad'));
        expect([secondLunch.suggestions[0], secondLunch.suggestions[2]], context).toEqual([
          'Fish tacos',
          'Tuna pasta bake',
        ]);
        expect([secondDinner.suggestions[0], secondDinner.suggestions[2]], context).toEqual([
          'Spaghetti carbonara',
          'Potato goulash',
        ]);
        expect(
          suggestionsOf(result).filter((name) => !RECIPES_LEFT.includes(name)),
          context,
        ).toEqual([]);
        for (const meal of openMealsOf(result)) {
          expect(new Set(meal.suggestions).size, context).toBe(3);
        }
      }

      const inside = planOf([
        day(
          '2026-10-24',
          open('Spaghetti pomodoro', 'Mac and cheese', 'Fish tacos'),
          picked('Niçoise salad'),
        ),
      ]);
      expectUnchanged(inside, (p) => dropSuggestionsOutside(p, RECIPES_LEFT, seededRandom(1)));
      const accepted = planOf(
        [
          day(
            '2026-10-24',
            open('Penne arrabbiata', 'Spaghetti pomodoro', 'Fish tacos'),
            picked('Mac and cheese'),
          ),
        ],
        { accepted: true },
      );
      expectUnchanged(accepted, (p) => dropSuggestionsOutside(p, RECIPES_LEFT, seededRandom(1)));
    });
  });

  describe('dropSuggestion', () => {
    it("puts the unpicked recipe shown longest ago that the meal isn't showing in the dropped recipe's place, never the dropped recipe itself, keeps the other two in their places and changes no meal without it, and replaces it in every open meal showing it", () => {
      const plan: Plan = {
        days: [
          day(
            '2026-10-24',
            open('Spaghetti carbonara', 'Shakshuka with bread', 'Niçoise salad'),
            open('Chickpea and spinach curry', 'Fish tacos', 'Bean burritos'),
          ),
          day(
            '2026-10-25',
            picked('Chicken fajitas'),
            open('Potato goulash', 'Chickpea and spinach curry', 'Pad thai'),
          ),
        ],
        people: 2,
        accepted: false,
        ticked: [],
        added: [],
        shown: [
          'Shakshuka with bread',
          'Chickpea and spinach curry',
          'Spaghetti carbonara',
          'Niçoise salad',
          'Fish tacos',
          'Bean burritos',
          'Chicken fajitas',
          'Potato goulash',
          'Pad thai',
        ],
        kidFriendly: false,
      };
      // Shakshuka with bread and Chickpea and spinach curry are the only candidates, and Shakshuka
      // with bread was shown longest ago
      const recipes = [
        'Shakshuka with bread',
        'Spaghetti carbonara',
        'Niçoise salad',
        'Chickpea and spinach curry',
      ];
      for (const seed of SEEDS) {
        const result = dropSuggestion(plan, 'Shakshuka with bread', recipes, seededRandom(seed));
        expect(result.days[0].lunch, `seed ${seed}`).toEqual(
          open('Spaghetti carbonara', 'Chickpea and spinach curry', 'Niçoise salad'),
        );
        expect(result.days[0].dinner, `seed ${seed}`).toEqual(plan.days[0].dinner);
        expect(result.days[1], `seed ${seed}`).toEqual(plan.days[1]);
      }

      const twice = oneDayPlan(
        open('Spaghetti carbonara', 'Shakshuka with bread', 'Niçoise salad'),
        open('Shakshuka with bread', 'Chickpea and spinach curry', 'Fish tacos'),
        [
          'Spaghetti carbonara',
          'Shakshuka with bread',
          'Niçoise salad',
          'Chickpea and spinach curry',
          'Fish tacos',
        ],
      );
      const more = [...twice.shown, ...RECIPES];
      for (const seed of SEEDS) {
        const result = dropSuggestion(twice, 'Shakshuka with bread', more, seededRandom(seed));
        const { lunch, dinner } = result.days[0];
        expect(lunch.suggestions[0], `seed ${seed}: ${lunch.suggestions.join(', ')}`).toBe(
          'Spaghetti carbonara',
        );
        expect(lunch.suggestions[2], `seed ${seed}: ${lunch.suggestions.join(', ')}`).toBe(
          'Niçoise salad',
        );
        expect(
          dinner.suggestions.slice(1),
          `seed ${seed}: ${dinner.suggestions.join(', ')}`,
        ).toEqual(['Chickpea and spinach curry', 'Fish tacos']);
        expectNoneOf(
          [lunch.suggestions[1], dinner.suggestions[0]],
          ['Shakshuka with bread'],
          `seed ${seed}`,
        );
        expectValidSuggestions(lunch, result, more, seed);
        expectValidSuggestions(dinner, result, more, seed);
      }
    });

    it('replaces the dropped recipe in two open meals with two different recipes not shown yet, counted as shown', () => {
      const plan = oneDayPlan(
        open('Spaghetti carbonara', 'Shakshuka with bread', 'Niçoise salad'),
        open('Shakshuka with bread', 'Chickpea and spinach curry', 'Fish tacos'),
        [
          'Spaghetti carbonara',
          'Shakshuka with bread',
          'Niçoise salad',
          'Chickpea and spinach curry',
          'Fish tacos',
        ],
      );
      const recipes = [...plan.shown, 'Bean burritos', 'Potato goulash', 'Pad thai'];
      // Always takes the first fresh candidate, so drawing the second replacement before the first
      // is recorded in shown would repeat it
      const result = dropSuggestion(plan, 'Shakshuka with bread', recipes, () => 0);
      const replacements = [
        result.days[0].lunch.suggestions[1],
        result.days[0].dinner.suggestions[0],
      ];
      expectNoneOf(replacements, plan.shown);
      expect(new Set(replacements).size, replacements.join(', ')).toBe(2);
      expect(result.shown).toEqual(expect.arrayContaining(replacements));
    });

    it("leaves a picked meal's pick and a lunch covered by the leftovers of a dropped recipe as they are", () => {
      for (const name of ['Chili', 'Curry']) {
        const recipes = RECIPES.filter((other) => other !== name);
        expectUnchanged(cookExtraPlan(), (plan) =>
          dropSuggestion(plan, name, recipes, seededRandom(1)),
        );
      }
      expect(
        leftoversOf(dropSuggestion(cookExtraPlan(), 'Curry', RECIPES, seededRandom(1)), 1),
      ).toBe('Curry');
    });

    describe('edge cases', () => {
      it('keeps the dropped recipe in its place when every other recipe is picked or shown by the meal, so no suggestion is undefined', () => {
        const plan = oneDayPlan(
          open('Spaghetti carbonara', 'Shakshuka with bread', 'Niçoise salad'),
          picked('Fish tacos'),
          ['Spaghetti carbonara', 'Shakshuka with bread', 'Niçoise salad', 'Fish tacos'],
        );
        const recipes = ['Spaghetti carbonara', 'Niçoise salad', 'Fish tacos'];
        for (const seed of SEEDS) {
          expectUnchanged(plan, (p) =>
            dropSuggestion(p, 'Shakshuka with bread', recipes, seededRandom(seed)),
          );
        }
      });
    });
  });

  describe('setKidFriendly', () => {
    // setKidFriendly gets the candidates: the kid-friendly recipes still suggested
    const KID_FRIENDLY = [
      'Spaghetti pomodoro',
      'Spaghetti carbonara',
      'Mac and cheese',
      'Potato goulash',
      'Tuna pasta bake',
      'Fish tacos',
      'Shakshuka with bread',
    ];
    const ALL = [...KID_FRIENDLY, 'Penne arrabbiata', 'Pad thai with chicken', 'Niçoise salad'];

    it('replaces "Penne arrabbiata" in its place in an open lunch with a kid-friendly recipe not shown yet, counted as shown, keeps "Spaghetti pomodoro" and "Mac and cheese" and the dinner picked as "Pad thai with chicken", and sets kidFriendly; turning it off keeps every suggestion; an accepted plan or an unchanged value returns the same plan', () => {
      const plan = planOf(
        [
          day(
            '2026-10-24',
            open('Penne arrabbiata', 'Spaghetti pomodoro', 'Mac and cheese'),
            picked('Pad thai with chicken'),
          ),
          day(
            '2026-10-25',
            open('Spaghetti carbonara', 'Tuna pasta bake', 'Fish tacos'),
            open('Mac and cheese', 'Spaghetti carbonara', 'Tuna pasta bake'),
          ),
        ],
        { kidFriendly: false },
      );
      const notShown = KID_FRIENDLY.filter((name) => !plan.shown.includes(name));
      for (const seed of SEEDS) {
        const on = setKidFriendly(plan, true, KID_FRIENDLY, seededRandom(seed));
        expect(on.kidFriendly, `seed ${seed}`).toBe(true);
        const [replacement, ...kept] = on.days[0].lunch.suggestions;
        expect(notShown, `seed ${seed}: ${replacement}`).toContain(replacement);
        expect(kept, `seed ${seed}`).toEqual(['Spaghetti pomodoro', 'Mac and cheese']);
        expect(on.days[0].dinner, `seed ${seed}`).toEqual(picked('Pad thai with chicken'));
        expect(on.days[1], `seed ${seed}`).toEqual(plan.days[1]);
        expect(on.shown, `seed ${seed}`).toContain(replacement);

        const off = setKidFriendly(on, false, ALL, seededRandom(seed));
        expect(off.kidFriendly, `seed ${seed}`).toBe(false);
        expect(off.days, `seed ${seed}`).toEqual(on.days);
        expect(setKidFriendly(on, true, KID_FRIENDLY, seededRandom(seed)), `seed ${seed}`).toBe(on);
      }
      expectUnchanged(plan, (unchanged) => setKidFriendly(unchanged, false, ALL, seededRandom(1)));
      const accepted = planOf(
        [day('2026-10-24', picked('Penne arrabbiata'), picked('Mac and cheese'))],
        { accepted: true, kidFriendly: false },
      );
      expectUnchanged(accepted, (unchanged) =>
        setKidFriendly(unchanged, true, KID_FRIENDLY, seededRandom(1)),
      );
    });

    it('replaces "Penne arrabbiata" with the highest-scored kid-friendly recipe not shown yet when turned on with a score', () => {
      const plan = planOf(
        [
          day(
            '2026-10-24',
            open('Penne arrabbiata', 'Spaghetti pomodoro', 'Mac and cheese'),
            picked('Pad thai with chicken'),
          ),
        ],
        { kidFriendly: false },
      );
      const score: Score = (name) => (name === 'Fish tacos' ? 5 : 0);
      for (const seed of SEEDS) {
        const on = setKidFriendly(plan, true, KID_FRIENDLY, seededRandom(seed), score);
        expect(on.days[0].lunch.suggestions, `seed ${seed}`).toEqual([
          'Fish tacos',
          'Spaghetti pomodoro',
          'Mac and cheese',
        ]);
      }
    });

    describe('edge cases', () => {
      it('keeps a lunch eating out, a "Cook extra" dinner picked as "Pad thai with chicken" with the lunch its leftovers cover, and what they offered, strong flavours included, when turned on', () => {
        const plan = planOf(
          [
            day(
              '2026-10-24',
              eatingOut(['Penne arrabbiata', 'Mac and cheese', 'Spaghetti pomodoro']),
              picked('Pad thai with chicken', [
                'Niçoise salad',
                'Pad thai with chicken',
                'Fish tacos',
              ]),
              true,
            ),
            day(
              '2026-10-25',
              covered(),
              open('Spaghetti carbonara', 'Tuna pasta bake', 'Fish tacos'),
            ),
          ],
          { kidFriendly: false },
        );
        const on = setKidFriendly(plan, true, KID_FRIENDLY, seededRandom(1));
        expect(on.kidFriendly).toBe(true);
        expect(on.days).toEqual(plan.days);
        expect(leftoversOf(on, 1)).toBe('Pad thai with chicken');
      });

      it('replaces a strong-flavoured suggestion with the only candidate the meal does not show and no meal picked, also when every candidate has been shown', () => {
        const plan = {
          ...planOf(
            [
              day(
                '2026-10-24',
                open('Penne arrabbiata', 'Spaghetti pomodoro', 'Mac and cheese'),
                picked('Potato goulash'),
              ),
            ],
            { kidFriendly: false },
          ),
          shown: [
            'Spaghetti carbonara',
            'Penne arrabbiata',
            'Spaghetti pomodoro',
            'Mac and cheese',
            'Potato goulash',
          ],
        };
        const candidates = [
          'Spaghetti pomodoro',
          'Mac and cheese',
          'Potato goulash',
          'Spaghetti carbonara',
        ];
        for (const seed of SEEDS) {
          const on = setKidFriendly(plan, true, candidates, seededRandom(seed));
          expect(on.days[0].lunch.suggestions, `seed ${seed}`).toEqual([
            'Spaghetti carbonara',
            'Spaghetti pomodoro',
            'Mac and cheese',
          ]);
        }
      });

      it('replaces the strong-flavoured suggestions of two open meals with three different kid-friendly recipes not shown yet, keeping "Mac and cheese" in both', () => {
        const plan = planOf(
          [
            day(
              '2026-10-24',
              open('Penne arrabbiata', 'Mac and cheese', 'Spaghetti pomodoro'),
              open('Mac and cheese', 'Niçoise salad', 'Pad thai with chicken'),
            ),
          ],
          { kidFriendly: false },
        );
        const notShown = KID_FRIENDLY.filter((name) => !plan.shown.includes(name));
        for (const seed of SEEDS) {
          const { lunch, dinner } = setKidFriendly(plan, true, KID_FRIENDLY, seededRandom(seed))
            .days[0];
          const context = `seed ${seed}: ${lunch.suggestions.join(', ')} / ${dinner.suggestions.join(', ')}`;
          expect(lunch.suggestions.slice(1), context).toEqual([
            'Mac and cheese',
            'Spaghetti pomodoro',
          ]);
          expect(dinner.suggestions[0], context).toBe('Mac and cheese');
          const replacements = [lunch.suggestions[0], ...dinner.suggestions.slice(1)];
          expect(
            replacements.filter((name) => !notShown.includes(name)),
            context,
          ).toEqual([]);
          expect(new Set(replacements).size, context).toBe(3);
        }
      });
    });
  });

  describe('renameRecipe', () => {
    it('renames "Quick Dal" to "Daily Dal" at the same indexes in a pick, another meal\'s offered and shown, and in an open meal\'s suggestions and shown, leaving no "Quick Dal"', () => {
      const planA = planOf([
        day(
          '2026-10-24',
          picked('Quick Dal', ['Chili', 'Quick Dal', 'Curry']),
          open('Dal', 'Fajitas', 'Goulash'),
        ),
        day(
          '2026-10-25',
          picked('Lasagne', ['Minestrone', 'Lasagne', 'Quick Dal']),
          open('Pesto', 'Quiche', 'Risotto'),
        ),
      ]);
      const planB = planOf([day('2026-10-24', open('Chili', 'Quick Dal', 'Curry'), picked('Dal'))]);
      for (const [label, plan] of [
        ['plan A', planA],
        ['plan B', planB],
      ] as const) {
        expect(JSON.stringify(plan), `${label}: "Quick Dal" not in the plan`).toContain(
          '"Quick Dal"',
        );
        const before = structuredClone(plan);
        const result = renameRecipe(plan, 'Quick Dal', 'Daily Dal');
        expect(result, label).toEqual(renamed(plan, 'Quick Dal', 'Daily Dal'));
        expect(JSON.stringify(result), label).not.toContain('Quick Dal');
        expect(plan, `${label}: the input plan was modified`).toEqual(before);
      }
    });

    describe('edge cases', () => {
      it('returns the plan unchanged for a name it does not hold, while it renames one it holds', () => {
        const plan = planOf([
          day(
            '2026-10-24',
            open('Chili', 'Curry', 'Dal'),
            picked('Fajitas', ['Fajitas', 'Goulash', 'Lasagne']),
          ),
        ]);
        expect(renameRecipe(plan, 'Chili', 'Red Chili').days[0].lunch, 'held name').toEqual(
          open('Red Chili', 'Curry', 'Dal'),
        );
        expectUnchanged(plan, (p) => renameRecipe(p, 'Quick Dal', 'Daily Dal'));
      });

      it('renames the pick, offered and shown of an accepted plan too, and leaves an added grocery item named "Quick Dal" as it is', () => {
        const plan: Plan = {
          ...planOf(
            [
              day(
                '2026-10-24',
                picked('Quick Dal', ['Chili', 'Quick Dal', 'Curry']),
                picked('Dal', ['Dal', 'Fajitas', 'Goulash']),
              ),
            ],
            { accepted: true },
          ),
          added: ['Quick Dal'],
          ticked: [addedKey('Quick Dal')],
        };
        const result = renameRecipe(plan, 'Quick Dal', 'Daily Dal');
        expect(result.days[0].lunch).toEqual(picked('Daily Dal', ['Chili', 'Daily Dal', 'Curry']));
        expect(result.shown).toEqual(
          plan.shown.map((name) => (name === 'Quick Dal' ? 'Daily Dal' : name)),
        );
        expect(result.accepted).toBe(true);
        expect(result.added).toEqual(['Quick Dal']);
        expect(result.ticked).toEqual([addedKey('Quick Dal')]);
      });
    });

    // Every recipe name equal to `from` replaced, everything else as it is
    function renamed(plan: Plan, from: string, to: string): Plan {
      const rename = (name: string) => (name === from ? to : name);
      const renameMeal = (meal: Meal): Meal => ({
        ...meal,
        recipe: meal.recipe === null ? null : rename(meal.recipe),
        suggestions: meal.suggestions.map(rename),
        ...(meal.offered ? { offered: meal.offered.map(rename) } : {}),
      });
      return {
        ...plan,
        days: plan.days.map((d) => ({
          ...d,
          lunch: renameMeal(d.lunch),
          dinner: renameMeal(d.dinner),
        })),
        shown: plan.shown.map(rename),
      };
    }
  });

  describe('forgetRecipe', () => {
    it('replaces "Quick Dal" in its place among an open meal\'s suggestions, drops the offered of a meal remembering it and takes it out of shown, also on an accepted plan, and returns a plan that picked it unchanged', () => {
      const plan = planOf([
        day(
          '2026-10-24',
          open('Chili', 'Quick Dal', 'Curry'),
          picked('Dal', ['Fajitas', 'Dal', 'Quick Dal']),
        ),
      ]);
      expect(plan.shown, 'Quick Dal not shown').toContain('Quick Dal');
      for (const seed of SEEDS) {
        const result = forgetRecipe(plan, 'Quick Dal', RECIPES, seededRandom(seed));
        const { lunch, dinner } = result.days[0];
        const context = `seed ${seed}: ${lunch.suggestions.join(', ')}`;
        expect(lunch.recipe, context).toBeNull();
        expect(lunch.suggestions[0], context).toBe('Chili');
        expect(lunch.suggestions[2], context).toBe('Curry');
        expectNoneOf([lunch.suggestions[1]], ['Quick Dal', 'Dal', 'Chili', 'Curry'], context);
        expect(RECIPES, context).toContain(lunch.suggestions[1]);
        expect(dinner, `seed ${seed}`).toEqual(picked('Dal'));
        expect('offered' in dinner, `seed ${seed}: offered kept`).toBe(false);
        expect(result.shown, `seed ${seed}`).not.toContain('Quick Dal');
      }

      const accepted = planOf(
        [day('2026-10-24', picked('Chili', ['Chili', 'Quick Dal', 'Curry']), picked('Dal'))],
        { accepted: true },
      );
      const forgotten = forgetRecipe(accepted, 'Quick Dal', RECIPES, seededRandom(1));
      expect(forgotten.days[0].lunch, 'accepted plan').toEqual(picked('Chili'));
      expect('offered' in forgotten.days[0].lunch, 'accepted plan: offered kept').toBe(false);
      expect(forgotten.shown, 'accepted plan').not.toContain('Quick Dal');
      expect(forgotten.accepted).toBe(true);

      const pickedPlan = planOf([
        day(
          '2026-10-24',
          picked('Quick Dal', ['Chili', 'Quick Dal', 'Curry']),
          picked('Dal', ['Fajitas', 'Dal', 'Quick Dal']),
        ),
      ]);
      expectUnchanged(pickedPlan, (p) => forgetRecipe(p, 'Quick Dal', RECIPES, seededRandom(1)));
    });

    describe('edge cases', () => {
      it('replaces "Quick Dal" in every open meal suggesting it, so no meal suggests it', () => {
        const plan = planOf([
          day(
            '2026-10-24',
            open('Chili', 'Quick Dal', 'Curry'),
            open('Quick Dal', 'Dal', 'Fajitas'),
          ),
          day('2026-10-25', open('Goulash', 'Lasagne', 'Quick Dal'), picked('Pesto')),
        ]);
        for (const seed of SEEDS) {
          const result = forgetRecipe(plan, 'Quick Dal', RECIPES, seededRandom(seed));
          expect(suggestionsOf(result), `seed ${seed}`).not.toContain('Quick Dal');
          for (const meal of openMealsOf(result)) {
            expectValidSuggestions(meal, result, RECIPES, seed);
          }
          expect(
            result.days[0].lunch.suggestions
              .slice(0, 1)
              .concat(result.days[0].lunch.suggestions.slice(2)),
            `seed ${seed}`,
          ).toEqual(['Chili', 'Curry']);
          expect(result.days[0].dinner.suggestions.slice(1), `seed ${seed}`).toEqual([
            'Dal',
            'Fajitas',
          ]);
          expect(result.days[1].lunch.suggestions.slice(0, 2), `seed ${seed}`).toEqual([
            'Goulash',
            'Lasagne',
          ]);
        }
      });
    });
  });

  describe('clearMeal', () => {
    it('opens the meal again with the suggestions it showed when picked, in the same order, whichever of them was picked', () => {
      const shown = ['Chili', 'Curry', 'Dal', 'Fajitas', 'Goulash', 'Lasagne'];
      for (const seed of SEEDS) {
        for (const name of ['Chili', 'Curry', 'Dal']) {
          const random = seededRandom(seed);
          const plan = oneDayPlan(
            open('Chili', 'Curry', 'Dal'),
            open('Fajitas', 'Goulash', 'Lasagne'),
            [...shown],
          );
          const withPick = pickRecipe(plan, LUNCH, name, RECIPES, random);
          expect(withPick.days[0].lunch.recipe, `seed ${seed}, ${name} not picked`).toBe(name);
          const result = clearMeal(withPick, LUNCH, RECIPES, random);
          expect(result.days[0].lunch, `seed ${seed}, picked ${name}`).toEqual(
            open('Chili', 'Curry', 'Dal'),
          );
          expect(result.days[0].dinner).toEqual(open('Fajitas', 'Goulash', 'Lasagne'));
        }
      }
    });

    it('keeps the suggestions it brings back in their places among the recipes shown and moves only the undone pick to the end', () => {
      const plan = oneDayPlan(
        open('Chili', 'Curry', 'Dal'),
        open('Fajitas', 'Goulash', 'Lasagne'),
        ['Chili', 'Fajitas', 'Curry', 'Goulash', 'Dal', 'Lasagne'],
      );
      const withPick = pickRecipe(plan, LUNCH, 'Curry', RECIPES, seededRandom(1));
      expect(withPick.shown, 'shown changed by the pick').toEqual(plan.shown);
      const result = clearMeal(withPick, LUNCH, RECIPES, seededRandom(1));
      expect(result.days[0].lunch).toEqual(open('Chili', 'Curry', 'Dal'));
      expect(result.shown).toEqual(['Chili', 'Fajitas', 'Goulash', 'Dal', 'Lasagne', 'Curry']);
    });

    it('opens a "Cook extra" dinner again with the suggestions it showed when picked, and the next lunch with three suggestions not shown yet as before', () => {
      for (const seed of SEEDS) {
        const random = seededRandom(seed);
        const plan: Plan = {
          days: [
            day('2026-10-24', picked('Chili'), open('Curry', 'Dal', 'Fajitas')),
            day('2026-10-25', open('Goulash', 'Lasagne', 'Minestrone'), picked('Pesto')),
          ],
          people: 2,
          accepted: false,
          ticked: [],
          added: [],
          shown: ['Chili', 'Curry', 'Dal', 'Fajitas', 'Goulash', 'Lasagne', 'Minestrone', 'Pesto'],
          kidFriendly: false,
        };
        const withPick = pickRecipe(plan, DINNER, 'Dal', FOURTEEN_RECIPES, random);
        const cookExtra = setCookExtra(withPick, 0, true, FOURTEEN_RECIPES, random);
        expect(leftoversOf(cookExtra, 1), `seed ${seed}, "Cook extra" not on`).toBe('Dal');

        const result = clearMeal(cookExtra, DINNER, FOURTEEN_RECIPES, random);
        expect(result.days[0].dinner, `seed ${seed}`).toEqual(open('Curry', 'Dal', 'Fajitas'));
        expect(result.days[0].cookExtra, `seed ${seed}`).toBe(false);
        const lunch = result.days[1].lunch;
        expect(lunch.recipe, `seed ${seed}`).toBeNull();
        expectValidSuggestions(lunch, result, FOURTEEN_RECIPES, seed);
        expectNoneOf(lunch.suggestions, plan.shown, `seed ${seed}, reopened lunch:`);
        expect(result.days[1].dinner).toEqual(picked('Pesto'));
      }
    });

    it('brings back the suggestions it showed when picked in their places, except one picked for another meal since, which is replaced by an unpicked recipe not shown yet, counted as shown', () => {
      const shown = ['Chili', 'Curry', 'Dal', 'Fajitas', 'Goulash'];
      for (const seed of SEEDS) {
        const random = seededRandom(seed);
        const plan = oneDayPlan(
          open('Chili', 'Curry', 'Dal'),
          open('Fajitas', 'Curry', 'Goulash'),
          [...shown],
        );
        const picks = pickRecipe(
          pickRecipe(plan, LUNCH, 'Chili', RECIPES, random),
          DINNER,
          'Curry',
          RECIPES,
          random,
        );
        expect(picks.days[0].dinner.recipe, `seed ${seed}, Curry not picked`).toBe('Curry');

        const result = clearMeal(picks, LUNCH, RECIPES, random);
        const lunch = result.days[0].lunch;
        expect(lunch.recipe, `seed ${seed}`).toBeNull();
        expect(lunch.suggestions[0], `seed ${seed}: ${lunch.suggestions.join(', ')}`).toBe('Chili');
        expect(lunch.suggestions[2], `seed ${seed}: ${lunch.suggestions.join(', ')}`).toBe('Dal');
        expectValidSuggestions(lunch, result, RECIPES, seed);
        const replacement = lunch.suggestions[1];
        expectNoneOf([replacement], picks.shown, `seed ${seed}, replacement:`);
        expect(result.shown, `seed ${seed}, replacement not counted as shown`).toContain(
          replacement,
        );
        expect(result.days[0].dinner.recipe).toBe('Curry');
      }
    });

    it('replaces each of two suggestions it showed that were picked for other meals since by a different unpicked recipe not shown yet', () => {
      const randoms: [string, () => number][] = [
        ...SEEDS.map((seed): [string, () => number] => [`seed ${seed}`, seededRandom(seed)]),
        // Always takes the first candidate, so the two replacements would be the same recipe if the
        // second draw could take the first
        ['always 0', () => 0],
      ];
      for (const [label, random] of randoms) {
        const plan: Plan = {
          days: [
            day('2026-10-24', open('Chili', 'Curry', 'Dal'), open('Curry', 'Fajitas', 'Goulash')),
            day('2026-10-25', open('Dal', 'Lasagne', 'Minestrone'), picked('Pesto')),
          ],
          people: 2,
          accepted: false,
          ticked: [],
          added: [],
          shown: ['Chili', 'Curry', 'Dal', 'Fajitas', 'Goulash', 'Lasagne', 'Minestrone', 'Pesto'],
          kidFriendly: false,
        };
        let picks = pickRecipe(plan, LUNCH, 'Chili', FOURTEEN_RECIPES, random);
        picks = pickRecipe(picks, DINNER, 'Curry', FOURTEEN_RECIPES, random);
        picks = pickRecipe(picks, { day: 1, kind: 'lunch' }, 'Dal', FOURTEEN_RECIPES, random);
        expect(pickedRecipes(picks), `${label}, not picked`).toEqual([
          'Chili',
          'Curry',
          'Dal',
          'Pesto',
        ]);

        const result = clearMeal(picks, LUNCH, FOURTEEN_RECIPES, random);
        const lunch = result.days[0].lunch;
        expect(lunch.suggestions[0], `${label}: ${lunch.suggestions.join(', ')}`).toBe('Chili');
        expectValidSuggestions(lunch, result, FOURTEEN_RECIPES);
        expectNoneOf(lunch.suggestions.slice(1), plan.shown, `${label}, replacements:`);
      }
    });

    it('brings back the suggestions it showed when picked in their places, except one no longer among the recipes, its own pick included, which is replaced by another of the recipes', () => {
      const offered = ['Chili', 'Curry', 'Dal'];
      for (const seed of SEEDS) {
        for (const [place, removed] of offered.entries()) {
          const context = `seed ${seed}, ${removed} not among the recipes`;
          const recipes = RECIPES.filter((name) => name !== removed);
          const plan = oneDayPlan(
            picked('Chili', [...offered]),
            open('Fajitas', 'Goulash', 'Lasagne'),
            [...offered, 'Fajitas', 'Goulash', 'Lasagne'],
          );

          const result = clearMeal(plan, LUNCH, recipes, seededRandom(seed));
          const lunch = result.days[0].lunch;
          expect(lunch.recipe, context).toBeNull();
          expect(
            lunch.suggestions.filter((_, i) => i !== place),
            `${context}: ${lunch.suggestions.join(', ')}`,
          ).toEqual(offered.filter((_, i) => i !== place));
          expectValidSuggestions(lunch, result, recipes, seed);
          expect(result.days[0].dinner, context).toEqual(open('Fajitas', 'Goulash', 'Lasagne'));
        }
      }
    });

    it('brings back a suggestion it showed when picked as it is, while another open meal is showing it too', () => {
      const recipes = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
      for (const seed of SEEDS) {
        const random = seededRandom(seed);
        const plan = oneDayPlan(open('A', 'B', 'C'), open('D', 'E', 'F'), [
          'G',
          'A',
          'B',
          'C',
          'D',
          'E',
          'F',
        ]);
        const withPick = pickRecipe(plan, LUNCH, 'A', recipes, random);
        // B and C left the screen with the pick, so the dinner may take them; only they and G are left
        const sharing = otherSuggestions(withPick, DINNER, recipes, random);
        const dinner = sharing.days[0].dinner;
        expect([...dinner.suggestions].sort(), `seed ${seed}, dinner`).toEqual(['B', 'C', 'G']);

        const result = clearMeal(sharing, LUNCH, recipes, random);
        expect(result.days[0].lunch, `seed ${seed}`).toEqual(open('A', 'B', 'C'));
        expect(result.days[0].dinner, `seed ${seed}`).toEqual(dinner);
      }
    });

    it('never brings back a recipe picked for another meal and never uses a recipe twice when every meal of a 5-day plan is picked and then undone, keeping each remembered recipe that is still unpicked in its place', () => {
      for (const seed of SEEDS) {
        const random = seededRandom(seed);
        let plan = createPlan('2026-10-24', DEFAULT_SETTINGS, FOURTEEN_RECIPES, random);
        const refs = plan.days.flatMap((_, d): MealRef[] => [
          { day: d, kind: 'lunch' },
          { day: d, kind: 'dinner' },
        ]);
        const remembered = new Map<MealRef, string[]>();
        for (const ref of refs) {
          const suggestions = plan.days[ref.day][ref.kind].suggestions;
          remembered.set(ref, suggestions);
          const recipe = suggestions[Math.floor(random() * suggestions.length)];
          plan = pickRecipe(plan, ref, recipe, FOURTEEN_RECIPES, random);
        }
        expect(pickedRecipes(plan), `seed ${seed}, not every meal picked`).toHaveLength(10);

        for (const ref of refs) {
          const context = `seed ${seed}, day ${ref.day} ${ref.kind}`;
          const before = remembered.get(ref)!;
          const own = plan.days[ref.day][ref.kind].recipe;
          const pickedElsewhere = pickedRecipes(plan).filter((name) => name !== own);
          plan = clearMeal(plan, ref, FOURTEEN_RECIPES, random);
          const suggestions = plan.days[ref.day][ref.kind].suggestions;
          before.forEach((name, i) => {
            if (!pickedElsewhere.includes(name)) {
              expect(suggestions[i], `${context}: ${suggestions.join(', ')}`).toBe(name);
            }
          });
          openMealsOf(plan).forEach((meal) => expectValidSuggestions(meal, plan, FOURTEEN_RECIPES));
          expect(parsePlan(JSON.parse(JSON.stringify(plan)), FOURTEEN_RECIPES), context).toEqual(
            plan,
          );
        }
      }
    });

    it('opens a meal picked without remembered suggestions, as in a plan saved before they were remembered, again with three suggestions, which include its own recipe only once the recipes not shown yet run out', () => {
      for (const seed of SEEDS) {
        const plan = oneDayPlan(picked('A'), picked('B'), ['A', 'B']);
        const result = clearMeal(plan, LUNCH, ['A', 'B', 'C', 'D', 'E'], seededRandom(seed));
        expect(result.days[0].lunch.recipe, `seed ${seed}`).toBeNull();
        expect([...result.days[0].lunch.suggestions].sort(), `seed ${seed}`).toEqual([
          'C',
          'D',
          'E',
        ]);
        expect(result.days[0].dinner).toEqual(picked('B'));

        // B stays picked, so A, C and D are the only possible suggestions
        const fewer = clearMeal(plan, LUNCH, ['A', 'B', 'C', 'D'], seededRandom(seed));
        expect([...fewer.days[0].lunch.suggestions].sort(), `seed ${seed}`).toEqual([
          'A',
          'C',
          'D',
        ]);
      }
    });

    it('rejects a meal that is already open', () => {
      const plan = oneDayPlan(open('Chili', 'Curry', 'Dal'), picked('Fajitas'));
      expectUnchanged(plan, (p) => clearMeal(p, LUNCH, RECIPES, seededRandom(1)));
    });

    it('turns "Cook extra" off when undoing its dinner and opens the next lunch with three unpicked suggestions', () => {
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

    it('suggests neither the undone recipe nor a shown one, and no recipe twice, for a "Cook extra" dinner undone without remembered suggestions and the lunch it reopens', () => {
      for (const seed of SEEDS) {
        const shown = ['Minestrone', 'Pesto', 'Chili', 'Curry', 'Dal', 'Fajitas', 'Goulash'];
        const plan: Plan = { ...cookExtraPlan(), shown: [...shown] };
        const result = clearMeal(plan, DINNER, FOURTEEN_RECIPES, seededRandom(seed));
        const drawn = [...result.days[0].dinner.suggestions, ...result.days[1].lunch.suggestions];
        expect(new Set(drawn).size, `seed ${seed}: ${drawn.join(', ')}`).toBe(6);
        expectNoneOf(drawn, shown, `seed ${seed}:`);
      }
    });

    it('counts the undone recipe as shown just now, so the recipes shown after it come back first once every recipe has been shown, for a meal without remembered suggestions', () => {
      for (const seed of SEEDS) {
        const plan = oneDayPlan(picked('A'), picked('B'), ['A', 'C', 'D', 'E', 'F', 'B']);
        const result = clearMeal(plan, LUNCH, ['A', 'B', 'C', 'D', 'E', 'F'], seededRandom(seed));
        expect([...result.days[0].lunch.suggestions].sort(), `seed ${seed}`).toEqual([
          'C',
          'D',
          'E',
        ]);
      }
    });

    it('opens a meal eating out again with the suggestions it showed, in their order, without eatOut or offered and with shown unchanged, replaces one picked for another meal since by an unpicked recipe not shown yet, and draws three new suggestions when offered is absent', () => {
      const plan = oneDayPlan(
        eatingOut(['Chili', 'Curry', 'Dal']),
        open('Fajitas', 'Goulash', 'Lasagne'),
        ['Chili', 'Curry', 'Dal', 'Fajitas', 'Goulash', 'Lasagne'],
      );
      const result = clearMeal(plan, LUNCH, RECIPES, seededRandom(1));
      expect(result.days[0].lunch).toStrictEqual(open('Chili', 'Curry', 'Dal'));
      expect(result.shown).toEqual(plan.shown);
      expect(result.days[0].dinner).toEqual(plan.days[0].dinner);

      const shown = ['Chili', 'Curry', 'Dal', 'Fajitas', 'Goulash'];
      for (const seed of SEEDS) {
        const curryPicked = oneDayPlan(
          eatingOut(['Chili', 'Curry', 'Dal']),
          picked('Curry', ['Fajitas', 'Curry', 'Goulash']),
          [...shown],
        );
        const lunch = clearMeal(curryPicked, LUNCH, RECIPES, seededRandom(seed)).days[0].lunch;
        expect(lunch.recipe, `seed ${seed}`).toBeNull();
        expect(lunch.eatOut, `seed ${seed}`).toBeUndefined();
        expect(lunch.suggestions[0], `seed ${seed}: ${lunch.suggestions.join(', ')}`).toBe('Chili');
        expect(lunch.suggestions[2], `seed ${seed}: ${lunch.suggestions.join(', ')}`).toBe('Dal');
        expectValidSuggestions(lunch, curryPicked, RECIPES, seed);
        expectNoneOf([lunch.suggestions[1]], shown, `seed ${seed}, replacement:`);
      }

      for (const seed of SEEDS) {
        const unknown = oneDayPlan(eatingOut(), picked('Fajitas'), ['Fajitas']);
        const reopened = clearMeal(unknown, LUNCH, RECIPES, seededRandom(seed));
        const lunch = reopened.days[0].lunch;
        expect(lunch.recipe, `seed ${seed}`).toBeNull();
        expect('eatOut' in lunch, `seed ${seed}: ${JSON.stringify(lunch)}`).toBe(false);
        expectValidSuggestions(lunch, reopened, RECIPES, seed);
        expect(reopened.days[0].dinner).toEqual(picked('Fajitas'));
      }
    });

    describe('edge cases', () => {
      it('counts nothing as shown just now when opening a meal eating out again, so shown keeps its order, unlike undoing a pick', () => {
        const shown = ['Chili', 'Fajitas', 'Curry', 'Goulash', 'Dal', 'Lasagne'];
        const plan = oneDayPlan(
          eatingOut(['Chili', 'Curry', 'Dal']),
          open('Fajitas', 'Goulash', 'Lasagne'),
          [...shown],
        );
        const result = clearMeal(plan, LUNCH, RECIPES, seededRandom(1));
        expect(result.days[0].lunch, 'meal not opened again').toStrictEqual(
          open('Chili', 'Curry', 'Dal'),
        );
        expect(result.shown).toEqual(shown);
      });

      it('replaces a suggestion it showed that "Don\'t suggest" removed since by another of the recipes, keeping the other two in their places', () => {
        const suggested = RECIPES.filter((name) => name !== 'Curry');
        for (const seed of SEEDS) {
          const random = seededRandom(seed);
          const plan = oneDayPlan(
            eatingOut(['Chili', 'Curry', 'Dal']),
            open('Fajitas', 'Goulash', 'Lasagne'),
            ['Chili', 'Curry', 'Dal', 'Fajitas', 'Goulash', 'Lasagne'],
          );
          const dropped = dropSuggestion(plan, 'Curry', suggested, random);
          expect(dropped.days[0].lunch, `seed ${seed}, meal eating out changed`).toEqual(
            plan.days[0].lunch,
          );
          const lunch = clearMeal(dropped, LUNCH, suggested, random).days[0].lunch;
          expect(lunch.suggestions[0], `seed ${seed}: ${lunch.suggestions.join(', ')}`).toBe(
            'Chili',
          );
          expect(lunch.suggestions[2], `seed ${seed}: ${lunch.suggestions.join(', ')}`).toBe('Dal');
          expectValidSuggestions(lunch, dropped, suggested, seed);
        }
      });

      it('draws three new suggestions, none of them the deleted recipe, when opening a meal eating out again whose offered named an own recipe deleted since', () => {
        for (const seed of SEEDS) {
          const random = seededRandom(seed);
          const plan = planOf([
            day('2026-10-24', eatingOut(['Chili', 'Quick Dal', 'Curry']), picked('Dal')),
          ]);
          const forgotten = forgetRecipe(plan, 'Quick Dal', RECIPES, random);
          expect(forgotten.days[0].lunch, `seed ${seed}`).toStrictEqual(eatingOut());
          const result = clearMeal(forgotten, LUNCH, RECIPES, random);
          const lunch = result.days[0].lunch;
          expect(lunch.recipe, `seed ${seed}`).toBeNull();
          expect('eatOut' in lunch, `seed ${seed}: ${JSON.stringify(lunch)}`).toBe(false);
          expectValidSuggestions(lunch, result, RECIPES, seed);
          expectNoneOf(lunch.suggestions, ['Chili', 'Quick Dal', 'Curry', 'Dal'], `seed ${seed}:`);
        }
      });

      it('opens the next lunch with three suggestions, not eating out again, when undoing a "Cook extra" dinner whose next lunch was eating out before', () => {
        for (const seed of SEEDS) {
          const random = seededRandom(seed);
          const plan = planOf([
            day('2026-10-24', picked('Chili'), picked('Curry')),
            day(
              '2026-10-25',
              eatingOut(['Dal', 'Fajitas', 'Goulash']),
              open('Lasagne', 'Minestrone', 'Pesto'),
            ),
          ]);
          const cookExtra = setCookExtra(plan, 0, true, RECIPES, random);
          expect(cookExtra.days[1].lunch, `seed ${seed}, lunch not covered`).toStrictEqual(
            covered(),
          );
          const result = clearMeal(cookExtra, DINNER, RECIPES, random);
          const lunch = result.days[1].lunch;
          expect(result.days[0].cookExtra, `seed ${seed}`).toBe(false);
          expect(lunch.recipe, `seed ${seed}`).toBeNull();
          expect('eatOut' in lunch, `seed ${seed}: ${JSON.stringify(lunch)}`).toBe(false);
          expectValidSuggestions(lunch, result, RECIPES, seed);
        }
      });
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
        ticked: [],
        added: [],
        shown: [],
        kidFriendly: false,
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
        ticked: [],
        added: [],
        shown: [],
        kidFriendly: false,
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
        ticked: [],
        added: [],
        shown: [],
        kidFriendly: false,
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
        ticked: [],
        added: [],
        shown: [],
        kidFriendly: false,
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
        ticked: [],
        added: [],
        shown: [],
        kidFriendly: false,
      };
      expectUnchanged(accepted, (p) => setCookExtra(p, 0, true, RECIPES, seededRandom(1)));
      const acceptedCookExtra = completeCookExtraPlan(true);
      expectUnchanged(acceptedCookExtra, (p) =>
        setCookExtra(p, 0, false, RECIPES, seededRandom(1)),
      );
    });

    it('replaces a next lunch eating out with the leftovers of the dinner, opens it with three suggestions and without eatOut when turned off, and rejects a dinner eating out', () => {
      const plan = planOf([
        day('2026-10-24', picked('Chili'), picked('Curry')),
        day(
          '2026-10-25',
          eatingOut(['Dal', 'Fajitas', 'Goulash']),
          open('Lasagne', 'Minestrone', 'Pesto'),
        ),
      ]);
      for (const seed of SEEDS) {
        const random = seededRandom(seed);
        const on = setCookExtra(plan, 0, true, RECIPES, random);
        expect(on.days[1].lunch, `seed ${seed}`).toStrictEqual(covered());
        expect(leftoversOf(on, 1), `seed ${seed}`).toBe('Curry');
        expect(on.shown, `seed ${seed}`).toEqual(plan.shown);

        const off = setCookExtra(on, 0, false, RECIPES, random);
        const lunch = off.days[1].lunch;
        expect(lunch.recipe, `seed ${seed}`).toBeNull();
        expect('eatOut' in lunch, `seed ${seed}: ${JSON.stringify(lunch)}`).toBe(false);
        expectValidSuggestions(lunch, off, RECIPES, seed);
      }

      const dinnerEatingOut = planOf([
        day('2026-10-24', picked('Chili'), eatingOut(['Curry', 'Dal', 'Fajitas'])),
        day('2026-10-25', open('Goulash', 'Lasagne', 'Minestrone'), picked('Pesto')),
      ]);
      expectUnchanged(dinnerEatingOut, (p) => setCookExtra(p, 0, true, RECIPES, seededRandom(1)));
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
      expect(result.days[1].dinner).toEqual(picked('Dal', ['Dal', 'Fajitas', 'Goulash']));
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

  describe('cookedMeals', () => {
    it("lists the picked meals for the plan's people, a dinner cooked extra for twice the people (#55)", () => {
      expect(cookedMeals(cookExtraPlan())).toEqual([
        { recipe: 'Chili', people: 2, cookExtra: false },
        { recipe: 'Curry', people: 4, cookExtra: true },
      ]);
    });

    it('leaves out open meals and meals eaten out (#55)', () => {
      expect(cookedMeals(oneDayPlan(eatingOut(), open('Curry', 'Dal', 'Fajitas')))).toEqual([]);
      expect(cookedMeals(storedPlan())).toEqual([
        { recipe: 'Chili', people: 2, cookExtra: false },
        { recipe: 'Curry', people: 2, cookExtra: false },
      ]);
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

    it('counts a meal eating out as filled: a one-day plan with the lunch eating out and the dinner picked is complete with 2 filled meals and can be accepted, and with the dinner open is incomplete with 1', () => {
      const complete = oneDayPlan(eatingOut(['Chili', 'Curry', 'Dal']), picked('Fajitas'));
      expect(isComplete(complete)).toBe(true);
      expect(filledMeals(complete)).toBe(2);
      expect(acceptPlan(complete).accepted).toBe(true);

      const dinnerOpen = oneDayPlan(
        eatingOut(['Chili', 'Curry', 'Dal']),
        open('Fajitas', 'Goulash', 'Lasagne'),
      );
      expect(isComplete(dinnerOpen)).toBe(false);
      expect(filledMeals(dinnerOpen)).toBe(1);
    });

    describe('edge cases', () => {
      it('counts a one-day plan with both meals eating out as complete with 2 filled meals, which can be accepted', () => {
        const plan = oneDayPlan(
          eatingOut(['Chili', 'Curry', 'Dal']),
          eatingOut(['Fajitas', 'Goulash', 'Lasagne']),
        );
        expect(isComplete(plan)).toBe(true);
        expect(filledMeals(plan)).toBe(2);
        expect(acceptPlan(plan)).toEqual({ ...plan, accepted: true });
      });
    });
  });

  describe('filledMeals', () => {
    it('counts the picked meals and a lunch covered by leftovers, but not an open meal', () => {
      expect(filledMeals(cookExtraPlan())).toBe(3);
    });

    it('is 0 when every meal is open', () => {
      expect(
        filledMeals(
          oneDayPlan(open('Chili', 'Curry', 'Dal'), open('Fajitas', 'Goulash', 'Lasagne')),
        ),
      ).toBe(0);
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
      expectUnchanged(plan, (p) => clearMeal(p, LUNCH, RECIPES, seededRandom(1)));
      expectUnchanged(plan, (p) => pickRecipe(p, DINNER, 'Curry', RECIPES, seededRandom(1)));
      expectUnchanged(plan, (p) => otherSuggestions(p, DINNER, RECIPES, seededRandom(1)));
      const complete: Plan = { ...oneDayPlan(picked('Chili'), picked('Curry')), accepted: true };
      expectUnchanged(complete, (p) => acceptPlan(p));
    });
  });

  describe('toggleTicked', () => {
    it('ticks an item of an accepted plan, keeps the other ticks, and unticks it again', () => {
      const plan: Plan = { ...oneDayPlan(picked('Chili'), picked('Curry')), accepted: true };
      const onion = toggleTicked(plan, 'onion');
      expect(onion.ticked).toEqual(['onion']);
      const both = toggleTicked(onion, 'rice');
      expect([...both.ticked].sort()).toEqual(['onion', 'rice']);
      expect(toggleTicked(both, 'onion').ticked).toEqual(['rice']);
      expect(plan.ticked, 'the input plan was modified').toEqual([]);
    });
  });

  describe('addItem', () => {
    it('adds nothing for an empty or blank entry, and adds an entry with its surrounding spaces trimmed', () => {
      const plan = acceptedPlan();
      expectUnchanged(plan, (p) => addItem(p, ''));
      expectUnchanged(plan, (p) => addItem(p, '   '));

      expect(addItem(plan, '  coffee  ').added).toEqual(['coffee']);
      expect(plan.added, 'the input plan was modified').toEqual([]);
    });

    it('keeps the items in the order they were added, as typed, a quantity included', () => {
      const plan = addItem(addItem(acceptedPlan(), 'toilet paper'), '2 l Milk');
      expect(plan.added).toEqual(['toilet paper', '2 l Milk']);
    });

    it('adds no second item for the same text in another case while it is still added', () => {
      const plan = addItem(acceptedPlan(), 'Coffee');
      expect(plan.added, 'item not added').toEqual(['Coffee']);

      expectUnchanged(plan, (p) => addItem(p, 'coffee'));
    });

    it('compares the trimmed text when looking for the same item', () => {
      const plan = addItem(acceptedPlan(), 'Coffee');
      expect(addItem(plan, ' tea ').added, 'other item not added').toEqual(['Coffee', 'tea']);

      expectUnchanged(plan, (p) => addItem(p, '  COFFEE '));
    });

    it('adds the same text in another case again once the item was removed', () => {
      const plan = removeItem(addItem(acceptedPlan(), 'Coffee'), 'Coffee');
      expect(plan.added, 'item not removed').toEqual([]);

      expect(addItem(plan, 'coffee').added).toEqual(['coffee']);
    });

    it("doesn't tick an item added again, even if a tick of it was left behind", () => {
      const plan: Plan = { ...acceptedPlan(), ticked: [addedKey('coffee'), 'onion'] };
      expect(addItem(plan, ' coffee ').ticked).toEqual(['onion']);
    });
  });

  describe('sameItem', () => {
    it('takes two texts for the same item when they are equal ignoring case, and only then', () => {
      expect(sameItem('coffee', 'COFFEE')).toBe(true);
      expect(sameItem('Toilet Paper', 'toilet paper')).toBe(true);
      expect(sameItem('Café', 'cafe')).toBe(false);
      expect(sameItem('toilet paper', 'toilet  paper')).toBe(false);
      expect(sameItem('coffee', ' coffee')).toBe(false);
    });
  });

  describe('removeItem', () => {
    it("removes an added item and its tick, keeps the other items and ticks, and doesn't tick it when added again", () => {
      let plan = addItem(addItem(acceptedPlan(), 'onion'), 'coffee');
      plan = toggleTicked(plan, addedKey('onion'));
      plan = toggleTicked(plan, addedKey('coffee'));
      plan = toggleTicked(plan, 'onion');
      expect(plan.ticked, 'items not ticked').toHaveLength(3);

      const removed = removeItem(plan, 'onion');
      expect(removed.added).toEqual(['coffee']);
      expect([...removed.ticked].sort()).toEqual([addedKey('coffee'), 'onion'].sort());
      expect(plan.added, 'the input plan was modified').toEqual(['onion', 'coffee']);

      expect(addItem(removed, 'onion').ticked).not.toContain(addedKey('onion'));
    });

    it('returns the same plan for text that is not on the list, the same text in another case included', () => {
      const plan = addItem(acceptedPlan(), 'coffee');
      expect(plan.added, 'item not added').toEqual(['coffee']);

      expectUnchanged(plan, (p) => removeItem(p, 'tea'));
      expectUnchanged(plan, (p) => removeItem(p, 'COFFEE'));
    });
  });

  describe('own items before acceptance (#52)', () => {
    it('adds "toilet paper" to a plan that is not accepted, ticks it, removes it with its tick, and keeps it and its tick when the complete plan is accepted (#52 1)', () => {
      const complete = oneDayPlan(picked('Chili'), picked('Curry'));
      const withPaper = addItem(complete, 'toilet paper');
      expect(withPaper.added).toEqual(['toilet paper']);
      const ticked = toggleTicked(withPaper, addedKey('toilet paper'));
      expect(ticked.ticked).toEqual([addedKey('toilet paper')]);
      const removed = removeItem(ticked, 'toilet paper');
      expect(removed.added).toEqual([]);
      expect(removed.ticked).toEqual([]);

      const saved: Plan = {
        ...complete,
        added: ['toilet paper'],
        ticked: [addedKey('toilet paper')],
      };
      const accepted = acceptPlan(saved);
      expect(accepted.accepted).toBe(true);
      expect(accepted.added).toEqual(['toilet paper']);
      expect(accepted.ticked).toEqual([addedKey('toilet paper')]);
    });

    it('adds nothing for a blank entry or the same text in another case to a plan that is not accepted (#52 1a)', () => {
      const plan = oneDayPlan(picked('Chili'), picked('Curry'));
      expectUnchanged(plan, (p) => addItem(p, ''));
      expectUnchanged(plan, (p) => addItem(p, '   '));

      const withCoffee = addItem(plan, ' Coffee ');
      expect(withCoffee.added, 'item not added').toEqual(['Coffee']);
      expectUnchanged(withCoffee, (p) => addItem(p, 'coffee'));
      expectUnchanged(withCoffee, (p) => addItem(p, ' COFFEE '));
    });

    it('adds, ticks and removes an item on a plan with an open meal, which acceptPlan still leaves as it is (#52 1b)', () => {
      const inProgress = oneDayPlan(picked('Chili'), open('Curry', 'Dal', 'Fajitas'));
      expectUnchanged({ ...inProgress, added: ['tea'], ticked: [addedKey('tea')] }, (p) =>
        acceptPlan(p),
      );

      const withTea = toggleTicked(addItem(inProgress, 'tea'), addedKey('tea'));
      expect(withTea.added).toEqual(['tea']);
      expect(withTea.ticked).toEqual([addedKey('tea')]);
      const removed = removeItem(withTea, 'tea');
      expect(removed.added).toEqual([]);
      expect(removed.ticked).toEqual([]);
    });
  });

  describe('parsePlan', () => {
    it('reads back a plan in progress and an accepted plan from their JSON', () => {
      const random = seededRandom(1);
      let plan = createPlan('2026-10-24', { ...DEFAULT_SETTINGS, people: 3 }, RECIPES, random);
      plan = pickRecipe(plan, LUNCH, plan.days[0].lunch.suggestions[0], RECIPES, random);
      expect(parsePlan(JSON.parse(JSON.stringify(plan)), RECIPES)).toEqual(plan);

      const accepted: Plan = { ...oneDayPlan(picked('Chili'), picked('Curry')), accepted: true };
      expect(parsePlan(JSON.parse(JSON.stringify(accepted)), RECIPES)).toEqual(accepted);
    });

    it('reads back the suggestions a picked meal showed, one of them picked for another meal since, so undoing it brings them back', () => {
      const shown = ['Chili', 'Curry', 'Dal', 'Fajitas', 'Goulash'];
      for (const seed of SEEDS) {
        const random = seededRandom(seed);
        const plan = oneDayPlan(
          open('Chili', 'Curry', 'Dal'),
          open('Fajitas', 'Curry', 'Goulash'),
          [...shown],
        );
        let picks = pickRecipe(plan, LUNCH, 'Chili', RECIPES, random);
        picks = pickRecipe(picks, DINNER, 'Curry', RECIPES, random);

        const parsed = parsePlan(JSON.parse(JSON.stringify(picks)), RECIPES);
        expect(parsed, `seed ${seed}`).toEqual(picks);
        const lunch = clearMeal(parsed!, LUNCH, RECIPES, random).days[0].lunch;
        expect(lunch.suggestions[0], `seed ${seed}: ${lunch.suggestions.join(', ')}`).toBe('Chili');
        expect(lunch.suggestions[2], `seed ${seed}: ${lunch.suggestions.join(', ')}`).toBe('Dal');
        expectNoneOf(lunch.suggestions, ['Curry'], `seed ${seed}:`);
      }
    });

    it('reads back a plan with "Cook extra", in progress and accepted, and a plan saved without the option as off', () => {
      for (const plan of [cookExtraPlan(), completeCookExtraPlan(true)]) {
        expect(parsePlan(JSON.parse(JSON.stringify(plan)), RECIPES)).toEqual(plan);
      }

      const savedBefore: any = storedPlan();
      savedBefore.days.forEach((d: any) => delete d.cookExtra);
      expect(parsePlan(savedBefore, RECIPES)).toEqual(storedPlan());
    });

    it('reads back the ticks of an accepted plan, and a plan saved without ticks as nothing ticked', () => {
      const ticked: Plan = { ...completeCookExtraPlan(true), ticked: ['onion', 'rice'] };
      expect(parsePlan(JSON.parse(JSON.stringify(ticked)), RECIPES)).toEqual(ticked);

      for (const plan of [storedPlan(), completeCookExtraPlan(true)]) {
        const savedBefore: any = structuredClone(plan);
        delete savedBefore.ticked;
        expect(parsePlan(savedBefore, RECIPES), JSON.stringify(plan)).toEqual(plan);
      }
    });

    it('returns null for ticks that are not a list of strings', () => {
      const plan = completeCookExtraPlan(true);
      expect(parsePlan(plan, RECIPES), 'valid base plan').not.toBeNull();
      for (const ticked of ['onion', null, {}, [1], ['onion', null]]) {
        expect(parsePlan({ ...plan, ticked }, RECIPES), JSON.stringify(ticked)).toBeNull();
      }
    });

    it('reads back a plan that is not accepted with the added "coffee" ticked, and one with a tick on no list as saved (#52 2)', () => {
      const saved = { ...storedPlan(), added: ['coffee'], ticked: ['["coffee"]'] };
      expect(parsePlan(JSON.parse(JSON.stringify(saved)), RECIPES)).toEqual(saved);

      const stale = { ...storedPlan(), added: ['coffee'], ticked: ['["onion","pc"]'] };
      expect(parsePlan(JSON.parse(JSON.stringify(stale)), RECIPES)).toEqual(stale);
    });

    it('returns null for an accepted plan with an open meal, also with an added item and its tick, which loads when not accepted (#52 2a)', () => {
      const withCoffee = { ...storedPlan(), added: ['coffee'], ticked: [addedKey('coffee')] };
      expect(parsePlan({ ...storedPlan(), accepted: true }, RECIPES)).toBeNull();
      expect(parsePlan({ ...withCoffee, accepted: true }, RECIPES)).toBeNull();

      expect(parsePlan(withCoffee, RECIPES), 'not accepted').toEqual(withCoffee);
    });

    it('reads back a plan that is not accepted saved with added items and without ticks as nothing ticked, and one saved before items could be added without either (#52 2b)', () => {
      const withoutTicks: any = { ...storedPlan(), added: ['coffee', 'toilet paper'] };
      delete withoutTicks.ticked;
      expect(parsePlan(withoutTicks, RECIPES)).toEqual({
        ...storedPlan(),
        added: ['coffee', 'toilet paper'],
      });

      const savedBefore: any = storedPlan();
      delete savedBefore.ticked;
      delete savedBefore.added;
      expect(parsePlan(savedBefore, RECIPES)).toEqual(storedPlan());
    });

    it('reads back the added items of an accepted plan in their order, and a plan saved without added items as none', () => {
      const added: Plan = {
        ...completeCookExtraPlan(true),
        added: ['toilet paper', '2 l Milk', 'onion'],
        ticked: [addedKey('onion')],
      };
      expect(parsePlan(JSON.parse(JSON.stringify(added)), RECIPES)).toEqual(added);

      for (const plan of [storedPlan(), completeCookExtraPlan(true)]) {
        const savedBefore: any = structuredClone(plan);
        delete savedBefore.added;
        expect(parsePlan(savedBefore, RECIPES), JSON.stringify(plan)).toEqual({
          ...plan,
          added: [],
        });
      }
    });

    it('returns null for added items that are not a list of strings', () => {
      const plan = completeCookExtraPlan(true);
      expect(parsePlan({ ...plan, added: ['coffee'] }, RECIPES), 'valid base plan').not.toBeNull();
      for (const added of ['coffee', null, {}, [1], ['coffee', null]]) {
        expect(parsePlan({ ...plan, added }, RECIPES), JSON.stringify(added)).toBeNull();
      }
    });

    it('returns null for added items that are untrimmed, blank or the same text twice ignoring case', () => {
      const plan = completeCookExtraPlan(true);
      expect(
        parsePlan({ ...plan, added: ['coffee', 'tea'] }, RECIPES),
        'valid base plan',
      ).not.toBeNull();
      const broken = [
        [' coffee'],
        ['coffee '],
        [''],
        ['  '],
        ['coffee', 'coffee'],
        ['coffee', 'Coffee'],
      ];
      for (const added of broken) {
        expect(parsePlan({ ...plan, added }, RECIPES), JSON.stringify(added)).toBeNull();
      }
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

    it('reads back the recipes a plan has shown, in the order they were shown', () => {
      const plan = oneDayPlan(open('Chili', 'Curry', 'Fajitas'), picked('Dal'), [
        'Lasagne',
        'Dal',
        'Goulash',
        'Chili',
        'Curry',
        'Fajitas',
      ]);
      expect(parsePlan(JSON.parse(JSON.stringify(plan)), RECIPES)).toEqual(plan);
    });

    it('reads back a plan saved before shown recipes were recorded as it was, with the suggestions it shows counted as shown', () => {
      for (const saved of [storedPlan(), cookExtraPlan()]) {
        const savedBefore: any = structuredClone(saved);
        delete savedBefore.shown;
        const parsed = parsePlan(savedBefore, RECIPES);
        expect(parsed, JSON.stringify(savedBefore)).not.toBeNull();
        expect(parsed!.days).toEqual(saved.days);
        expect(parsed!.people).toBe(saved.people);
        expect(parsed!.accepted).toBe(saved.accepted);
        expect(parsed!.shown).toEqual(expect.arrayContaining(suggestionsOf(saved)));
        expect(new Set(parsed!.shown).size, parsed!.shown.join(', ')).toBe(parsed!.shown.length);
        expectNoneOf(
          parsed!.shown,
          RECIPES.filter((name) => !recipesOf(saved).includes(name)),
        );
      }
    });

    it('reads back a plan whose shown recipes miss some of its suggestions with the missing ones added last, in day and meal order', () => {
      const plan = storedPlan();
      plan.shown = ['Quiche', 'Minestrone'];
      const parsed = parsePlan(JSON.parse(JSON.stringify(plan)), RECIPES);
      expect(parsed).toEqual({
        ...plan,
        shown: ['Quiche', 'Minestrone', 'Dal', 'Fajitas', 'Goulash', 'Lasagne', 'Pesto'],
      });
    });

    it('reads back a plan whose shown recipes miss some suggestions a picked meal showed with the missing ones added last', () => {
      const plan = storedPlan();
      plan.days[0].lunch = picked('Chili', ['Risotto', 'Chili', 'Shakshuka']);
      const parsed = parsePlan(JSON.parse(JSON.stringify(plan)), RECIPES);
      expect(parsed).toEqual({ ...plan, shown: [...plan.shown, 'Risotto', 'Shakshuka'] });
    });

    it('returns null for a plan whose shown recipes are not a list of recipe names', () => {
      for (const shown of ['Chili', 42, { Chili: true }, [42], ['Chili', null]]) {
        const plan: any = storedPlan();
        plan.shown = shown;
        expect(parsePlan(plan, RECIPES), JSON.stringify(shown)).toBeNull();
      }
    });

    it('returns null for a plan whose shown recipes name a recipe that does not exist', () => {
      const plan = storedPlan();
      plan.shown = ['Pizza', ...plan.shown];
      expect(parsePlan(plan, RECIPES)).toBeNull();
    });

    it('returns null for a plan whose shown recipes name a recipe twice', () => {
      const plan = storedPlan();
      plan.shown = [...plan.shown, 'Dal'];
      expect(parsePlan(plan, RECIPES)).toBeNull();
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

    it('returns null for a picked meal whose remembered suggestions are not three different recipe names including its own recipe', () => {
      // Dal is showing in the open dinner and Curry is picked on day 1: a remembered suggestion may be
      // either, since restoring it isn't suggesting it again
      const valid: any = storedPlan();
      valid.days[0].lunch = picked('Chili', ['Dal', 'Chili', 'Curry']);
      expect(parsePlan(structuredClone(valid), RECIPES), 'valid base plan').toEqual(valid);

      const broken = [
        'Dal, Chili, Curry',
        [42, 'Chili', 'Curry'],
        ['Pizza', 'Chili', 'Curry'],
        ['Dal', 'Quiche', 'Curry'],
        ['Dal', 'Chili'],
        ['Dal', 'Chili', 'Curry', 'Quiche'],
        ['Dal', 'Chili', 'Dal'],
      ];
      for (const offered of broken) {
        const plan: any = storedPlan();
        plan.days[0].lunch.offered = offered;
        expect(parsePlan(plan, RECIPES), JSON.stringify(offered)).toBeNull();
      }
    });

    it('returns null for an open meal or a lunch covered by leftovers with remembered suggestions', () => {
      expect(parsePlan(storedPlan(), RECIPES), 'valid base plan').not.toBeNull();
      expect(parsePlan(cookExtraPlan(), RECIPES), 'valid "Cook extra" plan').not.toBeNull();
      for (const offered of [['Lasagne', 'Minestrone', 'Pesto'], []]) {
        const openMeal: any = storedPlan();
        openMeal.days[1].lunch.offered = offered;
        expect(parsePlan(openMeal, RECIPES), `open, ${JSON.stringify(offered)}`).toBeNull();

        const coveredLunch: any = cookExtraPlan();
        coveredLunch.days[1].lunch.offered = offered;
        expect(parsePlan(coveredLunch, RECIPES), `covered, ${JSON.stringify(offered)}`).toBeNull();
      }
    });

    it('reads back a lunch eating out as it is with the suggestions it showed counted as shown, returns null for eatOut with a recipe, with suggestions, with two offered recipes, false or "yes", or on a covered lunch, and reads back a plan saved without eatOut as before', () => {
      const offered = ['Lasagne', 'Minestrone', 'Pesto'];
      const plan = storedPlan();
      plan.days[1].lunch = eatingOut(offered);
      const saved = JSON.parse(JSON.stringify(plan));
      saved.shown = plan.shown.filter((name) => !offered.includes(name));
      const parsed = parsePlan(saved, RECIPES);
      expect(parsed?.days, 'meal eating out not read back').toEqual(plan.days);
      expect(parsed!.shown).toEqual(expect.arrayContaining(offered));

      const broken: unknown[] = [
        { recipe: 'Lasagne', suggestions: [], offered, eatOut: true },
        { recipe: null, suggestions: offered, eatOut: true },
        { recipe: null, suggestions: [], offered: ['Lasagne', 'Minestrone'], eatOut: true },
        { recipe: null, suggestions: [], offered, eatOut: false },
        { recipe: null, suggestions: [], offered, eatOut: 'yes' },
      ];
      for (const meal of broken) {
        const brokenPlan: any = storedPlan();
        brokenPlan.days[1].lunch = meal;
        expect(parsePlan(brokenPlan, RECIPES), JSON.stringify(meal)).toBeNull();
      }
      for (const lunch of [eatingOut(['Dal', 'Fajitas', 'Goulash']), eatingOut()]) {
        const coveredLunch = cookExtraPlan();
        coveredLunch.days[1].lunch = lunch;
        expect(parsePlan(coveredLunch, RECIPES), `covered, ${JSON.stringify(lunch)}`).toBeNull();
      }

      for (const savedBefore of [storedPlan(), cookExtraPlan(), completeCookExtraPlan(true)]) {
        const read = parsePlan(JSON.parse(JSON.stringify(savedBefore)), RECIPES);
        expect(read).toEqual(savedBefore);
        expect(meals(read!).filter((meal) => 'eatOut' in meal)).toEqual([]);
      }
    });

    it('reads a plan saved without kidFriendly as not kid-friendly, returns null for kidFriendly "yes", and reads back a kid-friendly plan with a dinner picked as "Pad thai with chicken"', () => {
      const names = ['Pad thai with chicken', 'Mac and cheese', 'Spaghetti pomodoro', 'Fish tacos'];
      const plan = planOf([
        day(
          '2026-10-24',
          open('Mac and cheese', 'Spaghetti pomodoro', 'Fish tacos'),
          picked('Pad thai with chicken'),
        ),
      ]);
      const { kidFriendly: _, ...savedBefore } = plan;
      expect(parsePlan(structuredClone(savedBefore), names)?.kidFriendly).toBe(false);
      expect(parsePlan({ ...structuredClone(plan), kidFriendly: 'yes' }, names)).toBeNull();
      const kidFriendly = { ...plan, kidFriendly: true };
      expect(parsePlan(structuredClone(kidFriendly), names)).toEqual(kidFriendly);
    });

    describe('edge cases', () => {
      it('returns null for kidFriendly 1 or null, and reads back kidFriendly false', () => {
        const plan = storedPlan();
        expect(parsePlan({ ...structuredClone(plan), kidFriendly: 1 }, RECIPES), '1').toBeNull();
        expect(
          parsePlan({ ...structuredClone(plan), kidFriendly: null }, RECIPES),
          'null',
        ).toBeNull();
        expect(parsePlan({ ...structuredClone(plan), kidFriendly: false }, RECIPES)).toEqual({
          ...plan,
          kidFriendly: false,
        });
      });

      it('reads back a meal eating out without offered, a dinner eating out, one whose offered names a recipe picked or suggested for another meal, and an accepted plan with meals eating out', () => {
        const withoutOffered = storedPlan();
        withoutOffered.days[1].lunch = eatingOut();
        const dinner = storedPlan();
        dinner.days[0].dinner = eatingOut(['Dal', 'Fajitas', 'Goulash']);
        // Chili and Curry are picked, Lasagne is suggested for day 1's lunch
        const offeredElsewhere = storedPlan();
        offeredElsewhere.days[0].dinner = eatingOut(['Chili', 'Lasagne', 'Curry']);
        const accepted = planOf(
          [
            day('2026-10-24', eatingOut(['Dal', 'Fajitas', 'Goulash']), picked('Chili')),
            day('2026-10-25', picked('Curry'), eatingOut()),
          ],
          { accepted: true },
        );
        for (const plan of [withoutOffered, dinner, offeredElsewhere, accepted]) {
          expect(
            parsePlan(JSON.parse(JSON.stringify(plan)), RECIPES),
            JSON.stringify(plan),
          ).toEqual(plan);
        }
      });

      it('returns null for a meal eating out whose offered is not three different recipe names or whose eatOut is null, and for a dinner eating out with "Cook extra"', () => {
        const valid = storedPlan();
        valid.days[1].lunch = eatingOut(['Lasagne', 'Minestrone', 'Pesto']);
        expect(parsePlan(structuredClone(valid), RECIPES), 'valid base plan').toEqual(valid);

        const brokenOffered = [
          'Lasagne, Minestrone, Pesto',
          [42, 'Minestrone', 'Pesto'],
          ['Pizza', 'Minestrone', 'Pesto'],
          ['Lasagne', 'Minestrone', 'Lasagne'],
          ['Lasagne', 'Minestrone', 'Pesto', 'Quiche'],
          [],
        ];
        for (const offered of brokenOffered) {
          const plan: any = structuredClone(valid);
          plan.days[1].lunch.offered = offered;
          expect(parsePlan(plan, RECIPES), JSON.stringify(offered)).toBeNull();
        }
        const nullEatOut: any = structuredClone(valid);
        nullEatOut.days[1].lunch.eatOut = null;
        expect(parsePlan(nullEatOut, RECIPES), 'eatOut null').toBeNull();

        const cookExtra = storedPlan();
        cookExtra.days[0].dinner = eatingOut(['Dal', 'Fajitas', 'Goulash']);
        cookExtra.days[0].cookExtra = true;
        cookExtra.days[1].lunch = covered();
        expect(parsePlan(cookExtra, RECIPES), 'dinner eating out with "Cook extra"').toBeNull();
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
      ticked: [],
      added: [],
      shown: [
        'Chili',
        'Quiche',
        'Dal',
        'Fajitas',
        'Goulash',
        'Lasagne',
        'Minestrone',
        'Pesto',
        'Curry',
      ],
      kidFriendly: false,
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
      ticked: [],
      added: [],
      shown: ['Chili', 'Curry', 'Dal', 'Fajitas', 'Goulash'],
      kidFriendly: false,
    };
  }

  function completeCookExtraPlan(accepted: boolean): Plan {
    const plan = cookExtraPlan();
    plan.days[1].dinner = picked('Dal');
    return { ...plan, accepted };
  }

  function acceptedPlan(): Plan {
    return { ...oneDayPlan(picked('Chili'), picked('Curry')), accepted: true };
  }

  function oneDayPlan(lunch: Meal, dinner: Meal, shown: string[] = []): Plan {
    return {
      days: [day('2026-10-24', lunch, dinner)],
      people: 2,
      accepted: false,
      ticked: [],
      added: [],
      shown,
      kidFriendly: false,
    };
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
    expectNoneOf(meal.suggestions, pickedRecipes(plan), context);
  }

  function meals(plan: Plan): Meal[] {
    return plan.days.flatMap((d) => [d.lunch, d.dinner]);
  }

  function openMealsOf(plan: Plan): Meal[] {
    return meals(plan).filter((meal) => meal.recipe === null);
  }

  function recipesOf(plan: Plan): string[] {
    return [...pickedRecipes(plan), ...suggestionsOf(plan)];
  }

  function expectNoneOf(suggestions: readonly string[], excluded: readonly string[], context = '') {
    expect(
      suggestions.filter((name) => excluded.includes(name)),
      `${context} ${suggestions.join(', ')}`,
    ).toEqual([]);
  }

  function pickedRecipes(plan: Plan): string[] {
    return meals(plan).flatMap((meal) => (meal.recipe === null ? [] : [meal.recipe]));
  }
});
