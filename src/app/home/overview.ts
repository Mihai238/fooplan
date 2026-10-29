import { filledMeals, isComplete, leftoversOf, MealKind, Plan } from '../plan/plan';

export type PlanStage = 'empty' | 'started' | 'complete' | 'accepted';

export type TodayMeal =
  { shows: 'recipe' | 'leftovers'; recipe: string } | { shows: 'eatingOut' | 'open' };

export function planStage(plan: Plan): PlanStage {
  if (plan.accepted) {
    return 'accepted';
  }
  if (isComplete(plan)) {
    return 'complete';
  }
  return filledMeals(plan) > 0 ? 'started' : 'empty';
}

export function todayMeals(plan: Plan, today: string): Record<MealKind, TodayMeal> | null {
  const day = plan.days.findIndex((planDay) => planDay.date === today);
  if (day === -1) {
    return null;
  }
  return { lunch: todayMeal(plan, day, 'lunch'), dinner: todayMeal(plan, day, 'dinner') };
}

function todayMeal(plan: Plan, day: number, kind: MealKind): TodayMeal {
  const meal = plan.days[day][kind];
  const leftovers = kind === 'lunch' ? leftoversOf(plan, day) : null;
  if (meal.recipe !== null) {
    return { shows: 'recipe', recipe: meal.recipe };
  }
  if (leftovers !== null) {
    return { shows: 'leftovers', recipe: leftovers };
  }
  return { shows: meal.eatOut ? 'eatingOut' : 'open' };
}
