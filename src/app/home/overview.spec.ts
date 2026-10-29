import { covered, day, eatingOut, open, picked, planOf } from '../plan/testing';
import { planStage, todayMeals } from './overview';

describe('overview', () => {
  describe('planStage', () => {
    it('is empty without a filled meal, started with one, complete once every meal is filled and accepted once accepted', () => {
      const days = (lunch = open('A', 'B', 'C')) => [
        day('2026-10-29', lunch, picked('Dal'), true),
        day('2026-10-30', covered(), picked('Stew')),
      ];
      expect(planStage(planOf([day('2026-10-29', open('A', 'B', 'C'), open('D', 'E', 'F'))]))).toBe(
        'empty',
      );
      expect(planStage(planOf(days()))).toBe('started');
      expect(planStage(planOf(days(eatingOut())))).toBe('complete');
      expect(planStage(planOf(days(eatingOut()), { accepted: true }))).toBe('accepted');
    });
  });

  describe('todayMeals', () => {
    const plan = planOf([
      day('2026-10-28', picked('Soup'), picked('Dal'), true),
      day('2026-10-29', covered(), eatingOut()),
      day('2026-10-30', open('A', 'B', 'C'), picked('Stew')),
    ]);

    it('tells the meals of the day with the given date: a recipe, leftovers, eating out or open', () => {
      expect(todayMeals(plan, '2026-10-28')).toEqual({
        lunch: { shows: 'recipe', recipe: 'Soup' },
        dinner: { shows: 'recipe', recipe: 'Dal' },
      });
      expect(todayMeals(plan, '2026-10-29')).toEqual({
        lunch: { shows: 'leftovers', recipe: 'Dal' },
        dinner: { shows: 'eatingOut' },
      });
      expect(todayMeals(plan, '2026-10-30')).toEqual({
        lunch: { shows: 'open' },
        dinner: { shows: 'recipe', recipe: 'Stew' },
      });
    });

    it('is null for a date the plan has no day for', () => {
      expect(todayMeals(plan, '2026-10-27')).toBeNull();
      expect(todayMeals(plan, '2026-10-31')).toBeNull();
    });
  });
});
