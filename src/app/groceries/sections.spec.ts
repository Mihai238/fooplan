import { RECIPES } from '../recipes/recipes';
import { INGREDIENTS_BY_SECTION, PANTRY_STAPLES, sectionOf } from './sections';

describe('sections', () => {
  it('has a section for every ingredient of the recipes except the pantry staples', () => {
    expect(sectionOf('dragon fruit'), 'unknown ingredient').toBe('Other');
    const names = new Set(RECIPES.flatMap((recipe) => recipe.ingredients.map((i) => i.name)));
    expect(names.size, 'no ingredients').toBeGreaterThan(0);

    const unmapped = [...names].filter(
      (name) => !PANTRY_STAPLES.includes(name) && sectionOf(name) === 'Other',
    );
    expect(unmapped).toEqual([]);
  });

  it('maps every ingredient to one section only', () => {
    const mapped = Object.values(INGREDIENTS_BY_SECTION).flat();
    expect(mapped.length, 'no ingredients mapped').toBeGreaterThan(0);

    const duplicates = mapped.filter((name, i) => mapped.indexOf(name) !== i);
    expect(duplicates).toEqual([]);
  });

  it('maps only ingredients that some recipe uses', () => {
    const used = new Set(RECIPES.flatMap((recipe) => recipe.ingredients.map((i) => i.name)));
    const mapped = Object.values(INGREDIENTS_BY_SECTION).flat();
    expect(mapped.length, 'no ingredients mapped').toBeGreaterThan(0);

    expect(mapped.filter((name) => !used.has(name))).toEqual([]);
  });
});
