import { RECIPES } from './recipes';
import german from './recipes.de.json';

describe('recipes.de.json', () => {
  it('translates every recipe of RECIPES with a name and one non-empty step per English step, every ingredient name RECIPES uses, and nothing RECIPES does not have', () => {
    const recipes: Record<string, { name: string; steps: string[] }> = german.recipes;
    const ingredients: Record<string, string> = german.ingredients;

    expect(Object.keys(recipes).sort()).toEqual(RECIPES.map((recipe) => recipe.name).sort());
    for (const recipe of RECIPES) {
      const translation = recipes[recipe.name];
      expect(translation.name.trim(), `German name of "${recipe.name}"`).not.toBe('');
      expect(translation.steps, `German steps of "${recipe.name}"`).toHaveLength(
        recipe.steps?.length ?? 0,
      );
      expect(
        translation.steps.filter((step) => step.trim() === ''),
        `empty German steps of "${recipe.name}"`,
      ).toEqual([]);
    }

    const used = new Set(RECIPES.flatMap((recipe) => recipe.ingredients.map(({ name }) => name)));
    expect(Object.keys(ingredients).sort()).toEqual([...used].sort());
    for (const [name, translation] of Object.entries(ingredients)) {
      expect(translation.trim(), `German name of "${name}"`).not.toBe('');
    }
  });
});
