import { Recipe } from '../recipes/recipe';
import { RECIPES } from '../recipes/recipes';
import { Cooked, Meal, MealRef, Plan, Score } from './plan';
import { baseOf, proteinOf, scoreWith } from './ranking';
import { covered, day, DINNER, LUNCH, open, picked, planOf, R } from './testing';

const TUESDAY = '2026-10-27';
const FIXTURE = [
  R('pasta-chicken', ['spaghetti', 'chicken breast', 'onion'], 25),
  R('rice-chicken', ['rice', 'chicken thigh'], 30),
  R('bread-veg', ['bread', 'feta'], 15),
  R('potato-fish', ['potato', 'cod', 'onion'], 45),
];

describe('ranking', () => {
  describe('baseOf and proteinOf', () => {
    it('classify a recipe by the first base list and the first protein list holding one of its ingredient names, else as "other", and the built-in recipes "Bean burritos", "Beef burgers with oven fries", "Chicken Caesar salad", "Niçoise salad", "Spaghetti carbonara" and "Couscous salad with halloumi" accordingly', () => {
      expect(baseOf(R('a', ['spaghetti', 'rice']))).toBe('pasta');
      expect(baseOf(R('a', ['rice', 'tortilla']))).toBe('rice');
      expect(baseOf(R('a', ['burger bun', 'potato']))).toBe('potato');
      expect(baseOf(R('a', ['bread']))).toBe('bread');
      expect(baseOf(R('a', ['couscous', 'feta']))).toBe('other');
      expect(proteinOf(R('a', ['chicken breast', 'anchovy']))).toBe('chicken');
      expect(proteinOf(R('a', ['guanciale']))).toBe('meat');
      expect(proteinOf(R('a', ['canned tuna', 'anchovy']))).toBe('fish');
      expect(proteinOf(R('a', ['egg', 'feta']))).toBe('other');

      const classes = Object.fromEntries(
        RECIPES.map((recipe) => [recipe.name, `${baseOf(recipe)}/${proteinOf(recipe)}`]),
      );
      expect(classes['Bean burritos']).toBe('rice/other');
      expect(classes['Beef burgers with oven fries']).toBe('potato/meat');
      expect(classes['Chicken Caesar salad']).toBe('bread/chicken');
      expect(classes['Niçoise salad']).toBe('potato/fish');
      expect(classes['Spaghetti carbonara']).toBe('pasta/meat');
      expect(classes['Couscous salad with halloumi']).toBe('other/other');
    });

    describe('edge cases', () => {
      it('classify an own recipe by its ingredient names like a built-in one', () => {
        const own: Recipe = { ...R('Own pasta', ['spaghetti', 'onion']), own: true };
        expect([baseOf(own), proteinOf(own)]).toEqual(['pasta', 'other']);
      });
    });
  });

  describe('scoreWith', () => {
    const score = scoreUncooked(FIXTURE);

    it('scores a dinner candidate on a Tuesday with the lunch picked as "pasta-chicken": "rice-chicken" -2 (same protein as the same-day meal, 30 minutes), "bread-veg" 0, "potato-fish" 2 (overlap onion, 45 minutes), and "potato-fish" 3 on a Saturday', () => {
      const plan = oneDay(
        TUESDAY,
        picked('pasta-chicken'),
        open('rice-chicken', 'bread-veg', 'potato-fish'),
      );
      expect(score('rice-chicken', { plan, meal: DINNER, alongside: [] })).toBe(-2);
      expect(score('bread-veg', { plan, meal: DINNER, alongside: [] })).toBe(0);
      expect(score('potato-fish', { plan, meal: DINNER, alongside: [] })).toBe(2);

      const saturday = oneDay(
        '2026-10-31',
        picked('pasta-chicken'),
        open('rice-chicken', 'bread-veg', 'potato-fish'),
      );
      expect(score('potato-fish', { plan: saturday, meal: DINNER, alongside: [] })).toBe(3);
    });

    it('scores a lunch candidate the day after a dinner picked as "rice-chicken": "pasta-chicken" -1 (same protein as an adjacent meal, 25 minutes), "bread-veg" 2 (15 minutes); with that dinner cooked extra, scores the next dinner\'s "pasta-chicken" -4 (same protein as the leftovers lunch and as the adjacent dinner, 25 minutes)', () => {
      const plan = planOf([
        day(TUESDAY, open('bread-veg', 'potato-fish', 'pasta-chicken'), picked('rice-chicken')),
        day('2026-10-28', open('pasta-chicken', 'bread-veg', 'potato-fish'), open('a', 'b', 'c')),
      ]);
      const nextLunch: MealRef = { day: 1, kind: 'lunch' };
      expect(score('pasta-chicken', { plan, meal: nextLunch, alongside: [] })).toBe(-1);
      expect(score('bread-veg', { plan, meal: nextLunch, alongside: [] })).toBe(2);

      const cookExtra = planOf([
        day(
          TUESDAY,
          open('bread-veg', 'potato-fish', 'pasta-chicken'),
          picked('rice-chicken'),
          true,
        ),
        day('2026-10-28', covered(), open('pasta-chicken', 'bread-veg', 'potato-fish')),
      ]);
      const nextDinner: MealRef = { day: 1, kind: 'dinner' };
      expect(score('pasta-chicken', { plan: cookExtra, meal: nextDinner, alongside: [] })).toBe(-4);
    });

    it('scores "rice-chicken" for the lunch of an empty plan -2 alongside "pasta-chicken" (same protein, 30 minutes), -2 alongside "pasta-chicken" and "potato-fish", and 0 alongside "bread-veg"', () => {
      const plan = oneDay(TUESDAY, open('a', 'b', 'c'), open('d', 'e', 'f'));
      expect(score('rice-chicken', { plan, meal: LUNCH, alongside: ['pasta-chicken'] })).toBe(-2);
      expect(
        score('rice-chicken', { plan, meal: LUNCH, alongside: ['pasta-chicken', 'potato-fish'] }),
      ).toBe(-2);
      expect(score('rice-chicken', { plan, meal: LUNCH, alongside: ['bread-veg'] })).toBe(0);
    });

    it('caps the overlap with picked recipes at 3 and leaves olive oil out of it, gives a recipe without minutes no fit term for lunch or dinner, and scores a name not among the recipes 0', () => {
      const shared = ['onion', 'garlic clove', 'tomato', 'olive oil', 'egg'];
      const overlap = scoreUncooked([
        ...FIXTURE,
        R('picked', shared),
        R('sharer', shared),
        R('oiled', ['olive oil', 'onion']),
        R('own', ['feta']),
      ]);
      const plan = oneDay(TUESDAY, picked('picked'), open('sharer', 'oiled', 'own'));
      expect(overlap('sharer', { plan, meal: DINNER, alongside: [] })).toBe(3);
      expect(overlap('oiled', { plan, meal: DINNER, alongside: [] })).toBe(1);

      const saturday = oneDay('2026-10-31', open('a', 'b', 'c'), open('d', 'e', 'f'));
      for (const meal of [LUNCH, DINNER]) {
        expect(overlap('own', { plan: saturday, meal, alongside: [] }), meal.kind).toBe(0);
      }

      const busy = oneDay(
        TUESDAY,
        picked('pasta-chicken'),
        open('rice-chicken', 'bread-veg', 'potato-fish'),
      );
      expect(score('bread-veg', { plan: busy, meal: DINNER, alongside: [] })).toBe(0);
      expect(
        score('unknown', { plan: busy, meal: DINNER, alongside: ['pasta-chicken', 'potato-fish'] }),
      ).toBe(0);
      // A known recipe in the same context scores, so the 0 above is the unknown name's
      expect(
        score('rice-chicken', { plan: busy, meal: DINNER, alongside: ['pasta-chicken'] }),
      ).toBe(-4);
    });

    describe('edge cases', () => {
      it('never counts a base or protein of "other" as the same, for the same-day meal, an adjacent meal or alongside', () => {
        const others = scoreUncooked([
          R('other-a', ['couscous', 'feta']),
          R('other-b', ['lentil', 'halloumi']),
          R('other-c', ['quinoa'], 15),
        ]);
        const plan = planOf([
          day(TUESDAY, open('x', 'y', 'z'), picked('other-a')),
          day('2026-10-28', open('other-c', 'x2', 'y2'), picked('other-b')),
        ]);
        expect(
          others('other-c', {
            plan,
            meal: { day: 1, kind: 'lunch' },
            alongside: ['other-a', 'other-b'],
          }),
        ).toBe(2);
      });

      it('counts each ingredient name the candidate shares with the picked recipes once, however often the candidate or the picks list it', () => {
        const repeated = scoreUncooked([
          R('lunch', ['onion', 'feta']),
          R('dinner', ['onion', 'couscous']),
          R('candidate', ['onion', 'onion', 'lentil']),
        ]);
        const plan = planOf([
          day(TUESDAY, picked('lunch'), picked('dinner')),
          day('2026-10-28', open('candidate', 'x', 'y'), open('a', 'b', 'c')),
        ]);
        expect(
          repeated('candidate', { plan, meal: { day: 1, kind: 'lunch' }, alongside: [] }),
        ).toBe(1);
      });

      it('adds 1 for a dinner of 25 minutes or more and 1 more for 35 minutes or more on a Friday, Saturday or Sunday only', () => {
        const timed = scoreUncooked([
          R('20', ['feta'], 20),
          R('25', ['feta'], 25),
          R('30', ['feta'], 30),
          R('35', ['feta'], 35),
        ]);
        const cases: [string, string, number][] = [
          ['2026-10-29', '35', 1], // Thursday
          ['2026-10-30', '30', 1], // Friday
          ['2026-10-30', '35', 2],
          ['2026-10-31', '35', 2], // Saturday
          ['2026-11-01', '35', 2], // Sunday
          ['2026-11-01', '25', 1],
          ['2026-11-01', '20', 0],
          ['2026-11-02', '35', 1], // Monday
        ];
        for (const [date, name, expected] of cases) {
          const plan = oneDay(date, open('a', 'b', 'c'), open('d', 'e', 'f'));
          expect(timed(name, { plan, meal: DINNER, alongside: [] }), `${date} ${name}`).toBe(
            expected,
          );
        }
      });

      it('adds 2 for a lunch of at most 15 minutes, 1 for 20 or 25, nothing for 30 and takes 1 off for 35 or more, on any day', () => {
        const timed = scoreUncooked(
          [10, 15, 20, 25, 30, 35, 45].map((minutes) => R(`${minutes}`, ['feta'], minutes)),
        );
        const expected: Record<string, number> = {
          10: 2,
          15: 2,
          20: 1,
          25: 1,
          30: 0,
          35: -1,
          45: -1,
        };
        for (const date of [TUESDAY, '2026-10-31']) {
          const plan = oneDay(date, open('a', 'b', 'c'), open('d', 'e', 'f'));
          for (const [name, value] of Object.entries(expected)) {
            expect(timed(name, { plan, meal: LUNCH, alongside: [] }), `${date} ${name}`).toBe(
              value,
            );
          }
        }
      });
    });
  });

  describe('recently cooked (#57)', () => {
    const TODAY = '2026-10-31';
    // Base and protein "other" and no minutes: every other term is 0 for them on an empty plan
    const PLAIN = ['A', 'B', 'C', 'D', 'E'].map((name) => R(name, [`${name} only`]));
    const EMPTY = oneDay(TODAY, open('x', 'y', 'z'), open('u', 'v', 'w'));

    it('scores A cooked 6 days ago -4, B 11 days ago -2, C 21 days ago 0, D dated after today 0 and E not in the history 0, and A dated 7 days ago -2, 14 days ago 0 and today -4 (#57 3)', () => {
      const score = scoreWith(
        PLAIN,
        { A: '2026-10-25', B: '2026-10-20', C: '2026-10-10', D: '2026-11-02' },
        TODAY,
      );
      const expected: Record<string, number> = { A: -4, B: -2, C: 0, D: 0, E: 0 };
      for (const [name, value] of Object.entries(expected)) {
        for (const meal of [LUNCH, DINNER]) {
          expect(score(name, { plan: EMPTY, meal, alongside: [] }), `${name} ${meal.kind}`).toBe(
            value,
          );
        }
      }
      for (const [date, value] of [
        ['2026-10-24', -2],
        ['2026-10-17', 0],
        ['2026-10-31', -4],
      ] as const) {
        expect(scoreA({ A: date }, TODAY), date).toBe(value);
      }
    });

    describe('edge cases', () => {
      it('scores A -4 dated 1 and 6 days ago, -2 dated 7 and 13 days ago, 0 dated 14 and 40 days ago, and 0 dated tomorrow or a year ahead (#57 3a)', () => {
        const cases: [string, number][] = [
          ['2026-10-30', -4],
          ['2026-10-25', -4],
          ['2026-10-24', -2],
          ['2026-10-18', -2],
          ['2026-10-17', 0],
          ['2026-09-21', 0],
          ['2026-11-01', 0],
          ['2027-10-31', 0],
        ];
        for (const [date, value] of cases) {
          expect(scoreA({ A: date }, TODAY), date).toBe(value);
        }
      });

      it('counts whole calendar days across a month end and a year end: 6 days from 2026-03-25 to 2026-03-31 -4, 7 days from 2026-03-24 -2, 13 days from 2026-10-18 to 2026-10-31 -2, 6 days from 2026-12-30 to 2027-01-05 -4 and 14 days from 2026-12-22 0 (#57 3b)', () => {
        const cases: [string, string, number][] = [
          ['2026-03-25', '2026-03-31', -4],
          ['2026-03-24', '2026-03-31', -2],
          ['2026-10-18', '2026-10-31', -2],
          ['2026-12-30', '2027-01-05', -4],
          ['2026-12-22', '2027-01-05', 0],
        ];
        for (const [date, today, value] of cases) {
          expect(scoreA({ A: date }, today), `${date} to ${today}`).toBe(value);
        }
      });

      it('adds the recently-cooked term to the other terms: "bread-veg" for lunch (2 for 15 minutes) cooked 3 days ago 2 - 4 = -2, and "potato-fish" for a Saturday dinner (3) cooked 10 days ago 3 - 2 = 1 (#57 3c)', () => {
        const cooked: Cooked = { 'bread-veg': '2026-10-28', 'potato-fish': '2026-10-21' };
        const score = scoreWith(FIXTURE, cooked, TODAY);
        const saturday = oneDay(
          TODAY,
          open('bread-veg', 'rice-chicken', 'x'),
          open('potato-fish', 'bread-veg', 'y'),
        );
        expect(score('bread-veg', { plan: saturday, meal: LUNCH, alongside: [] })).toBe(-2);
        const withLunch = oneDay(
          TODAY,
          picked('pasta-chicken'),
          open('rice-chicken', 'bread-veg', 'potato-fish'),
        );
        expect(score('potato-fish', { plan: withLunch, meal: DINNER, alongside: [] })).toBe(1);
      });
    });

    function scoreA(cooked: Cooked, today: string): number {
      return scoreWith(PLAIN, cooked, today)('A', { plan: EMPTY, meal: LUNCH, alongside: [] });
    }
  });
});

function oneDay(date: string, lunch: Meal, dinner: Meal): Plan {
  return planOf([day(date, lunch, dinner)]);
}

// Nothing cooked, so the recently-cooked term is 0 whatever the day
function scoreUncooked(recipes: readonly Recipe[]): Score {
  return scoreWith(recipes, {}, '2026-10-24');
}
