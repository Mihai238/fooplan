import { recipeSlug } from './recipe-slug';
import { RECIPES } from './recipes';

describe('recipeSlug', () => {
  it('makes the name lowercase, without accents or punctuation, with hyphens between words', () => {
    expect(recipeSlug('Spaghetti carbonara')).toBe('spaghetti-carbonara');
    expect(recipeSlug("Shepherd's pie")).toBe('shepherds-pie');
    expect(recipeSlug('Niçoise salad')).toBe('nicoise-salad');
  });

  it('drops the accents of "Käsespätzle" and "Niçoise", keeping their base letters', () => {
    expect(recipeSlug('Käsespätzle')).toBe('kasespatzle');
    expect(recipeSlug('Niçoise salad')).toBe('nicoise-salad');
  });

  it('drops the apostrophe of "Shepherd\'s pie" instead of turning it into a hyphen', () => {
    expect(recipeSlug("Shepherd's pie")).toBe('shepherds-pie');
  });

  it('keeps the hyphen of "Oven-baked" and "stir-fry" as the one between those words', () => {
    expect(recipeSlug('Oven-baked salmon with potatoes and green beans')).toBe(
      'oven-baked-salmon-with-potatoes-and-green-beans',
    );
    expect(recipeSlug('Vegetable stir-fry with noodles')).toBe('vegetable-stir-fry-with-noodles');
  });

  it('lowercases a capital letter inside the name, as in "Chicken Caesar salad"', () => {
    expect(recipeSlug('Chicken Caesar salad')).toBe('chicken-caesar-salad');
  });

  it('keeps digits, joins runs of spaces and hyphens into one hyphen and trims hyphens at the ends', () => {
    expect(recipeSlug('Mac & cheese')).toBe('mac-cheese');
    expect(recipeSlug('  Fish -  chips  ')).toBe('fish-chips');
    expect(recipeSlug('-5-minute soup!-')).toBe('5-minute-soup');
  });

  it('gives every recipe a slug of lowercase letters and digits with single hyphens between them', () => {
    for (const recipe of RECIPES) {
      expect(recipeSlug(recipe.name), recipe.name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('gives no two recipes the same slug', () => {
    const slugs = RECIPES.map((recipe) => recipeSlug(recipe.name));
    expect(RECIPES.length, 'no recipes loaded').toBeGreaterThan(0);
    const shared = slugs.filter((slug, i) => slugs.indexOf(slug) !== i);
    expect(shared).toEqual([]);
  });
});
