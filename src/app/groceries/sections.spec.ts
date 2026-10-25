import { RECIPES } from '../recipes/recipes';
import { INGREDIENTS_BY_SECTION, PANTRY_STAPLES, sectionOf } from './sections';

const REMOVED_INGREDIENTS = [
  'arborio rice',
  'baking powder',
  'beef',
  'beer',
  'canned kidney beans',
  'canned pineapple',
  'canned white beans',
  'cannelloni tube',
  'celery stalk',
  'chicken drumstick',
  'chicken stock',
  'cornstarch',
  'ditalini',
  'dried chickpeas',
  'dried fenugreek leaf',
  'dry yeast',
  'emmental',
  'fish stock',
  'flatbread',
  'garam masala',
  'ground lamb',
  'gruyère',
  'hummus',
  'lasagne sheet',
  'mussel',
  'naan',
  'paella rice',
  'pea',
  'pork cutlet',
  'pork shoulder',
  'quark',
  'red wine',
  'rice vinegar',
  'ricotta',
  'saffron',
  'shortcrust pastry',
  'squid',
  'thyme',
  'white wine',
  'yogurt',
  'zucchini',
];

const SOUP_INGREDIENTS = ['chive', 'cream', 'leek', 'pumpkin', 'pumpkin seed', 'red lentil'];

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

  it('maps none of the 41 ingredients only removed recipes used, and still every ingredient of the recipes except the pantry staples', () => {
    const mapped = Object.values(INGREDIENTS_BY_SECTION).flat();
    expect(mapped.filter((name) => REMOVED_INGREDIENTS.includes(name))).toEqual([]);

    const names = new Set(RECIPES.flatMap((recipe) => recipe.ingredients.map((i) => i.name)));
    expect(names.size, 'no ingredients').toBeGreaterThan(0);
    const unmapped = [...names].filter(
      (name) => !PANTRY_STAPLES.includes(name) && !mapped.includes(name),
    );
    expect(unmapped).toEqual([]);
  });

  it('maps none of the 6 ingredients only the soups used, lists "Nuts & seeds" as peanut, pine nut and sesame seed, and still every ingredient of the recipes except the pantry staples', () => {
    const mapped = Object.values(INGREDIENTS_BY_SECTION).flat();
    expect(mapped.filter((name) => SOUP_INGREDIENTS.includes(name))).toEqual([]);
    expect(INGREDIENTS_BY_SECTION['Nuts & seeds']).toEqual(['peanut', 'pine nut', 'sesame seed']);

    const names = new Set(RECIPES.flatMap((recipe) => recipe.ingredients.map((i) => i.name)));
    expect(names.size, 'no ingredients').toBeGreaterThan(0);
    const unmapped = [...names].filter(
      (name) => !PANTRY_STAPLES.includes(name) && !mapped.includes(name),
    );
    expect(unmapped).toEqual([]);
  });

  it('puts each of the 6 ingredients only the soups used under "Other", but keeps sour cream, pine nut, sesame seed, potato and red onion in their sections', () => {
    expect(SOUP_INGREDIENTS.map((name) => [name, sectionOf(name)])).toEqual(
      SOUP_INGREDIENTS.map((name) => [name, 'Other']),
    );
    expect(['sour cream', 'pine nut', 'sesame seed', 'potato', 'red onion'].map(sectionOf)).toEqual(
      ['Dairy & eggs', 'Nuts & seeds', 'Nuts & seeds', 'Fruit & vegetables', 'Fruit & vegetables'],
    );
  });
});
