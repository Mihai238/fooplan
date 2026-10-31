import { RECIPES } from '../recipes/recipes';
import { INGREDIENTS_BY_SECTION, PANTRY_STAPLES, Section, sectionOf } from './sections';

const REMOVED_INGREDIENTS = [
  'arborio rice',
  'baking powder',
  'beef',
  'beer',
  'canned kidney beans',
  'canned pineapple',
  'cannelloni tube',
  'celery stalk',
  'chicken drumstick',
  'chicken stock',
  'cornstarch',
  'ditalini',
  'dried chickpeas',
  'dried fenugreek leaf',
  'dry yeast',
  'fish stock',
  'flatbread',
  'garam masala',
  'gruyère',
  'lasagne sheet',
  'mussel',
  'naan',
  'paella rice',
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
];

// #58's new ingredients and their sections
const ADDED_SECTIONS: [string, Section][] = [
  ['apple', 'Fruit & vegetables'],
  ['bacon', 'Meat & fish'],
  ['bagel', 'Bread & bakery'],
  ['caper', 'Cans & jars'],
  ['cauliflower', 'Fruit & vegetables'],
  ['chorizo', 'Meat & fish'],
  ['cream cheese', 'Dairy & eggs'],
  ['emmental', 'Dairy & eggs'],
  ['fusilli', 'Pasta, rice & grains'],
  ['ground lamb', 'Meat & fish'],
  ['ham', 'Meat & fish'],
  ['italian sausage', 'Meat & fish'],
  ['mayonnaise', 'Spices & sauces'],
  ['peanut butter', 'Cans & jars'],
  ['pita bread', 'Bread & bakery'],
  ['pork chop', 'Meat & fish'],
  ['pork tenderloin', 'Meat & fish'],
  ['rocket', 'Fruit & vegetables'],
  ['rosemary', 'Fruit & vegetables'],
  ['smoked salmon', 'Meat & fish'],
  ['spätzle', 'Pasta, rice & grains'],
  ['tagliatelle', 'Pasta, rice & grains'],
  ['tortellini', 'Pasta, rice & grains'],
  ['trout', 'Meat & fish'],
  ['yogurt', 'Dairy & eggs'],
];

// #24's list without "chive" and "cream", which #32's recipes use again
const SOUP_INGREDIENTS = ['leek', 'pumpkin', 'pumpkin seed', 'red lentil'];

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

  it('maps none of the 34 ingredients only removed recipes used, and still every ingredient of the recipes except the pantry staples', () => {
    const mapped = Object.values(INGREDIENTS_BY_SECTION).flat();
    expect(mapped.filter((name) => REMOVED_INGREDIENTS.includes(name))).toEqual([]);

    const names = new Set(RECIPES.flatMap((recipe) => recipe.ingredients.map((i) => i.name)));
    expect(names.size, 'no ingredients').toBeGreaterThan(0);
    const unmapped = [...names].filter(
      (name) => !PANTRY_STAPLES.includes(name) && !mapped.includes(name),
    );
    expect(unmapped).toEqual([]);
  });

  it('maps none of the 4 ingredients only the soups used, lists "Nuts & seeds" as peanut, pine nut and sesame seed, and still every ingredient of the recipes except the pantry staples', () => {
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

  it('lists "broccoli" right after "bell pepper", "chive" right after "cherry tomato", "pea" right after "parsley" and "zucchini" last in "Fruit & vegetables", and "cream" right after "cheddar" in "Dairy & eggs"', () => {
    const vegetables = INGREDIENTS_BY_SECTION['Fruit & vegetables'];
    expect(vegetables[vegetables.indexOf('bell pepper') + 1], 'after bell pepper').toBe('broccoli');
    expect(vegetables[vegetables.indexOf('cherry tomato') + 1], 'after cherry tomato').toBe(
      'chive',
    );
    expect(vegetables[vegetables.indexOf('parsley') + 1], 'after parsley').toBe('pea');
    expect(vegetables.at(-1), 'last').toBe('zucchini');
    const dairy = INGREDIENTS_BY_SECTION['Dairy & eggs'];
    expect(dairy[dairy.indexOf('cheddar') + 1], 'after cheddar').toBe('cream');
  });

  it('puts none of "broccoli", "pea", "zucchini", "chive" and "cream" under "Other", and lists none of them as an ingredient only removed recipes or the soups used', () => {
    const names = ['broccoli', 'pea', 'zucchini', 'chive', 'cream'];
    expect(names.map((name) => [name, sectionOf(name)])).toEqual([
      ['broccoli', 'Fruit & vegetables'],
      ['pea', 'Fruit & vegetables'],
      ['zucchini', 'Fruit & vegetables'],
      ['chive', 'Fruit & vegetables'],
      ['cream', 'Dairy & eggs'],
    ]);
    expect(
      names.filter((name) => REMOVED_INGREDIENTS.includes(name)),
      'removed',
    ).toEqual([]);
    expect(
      names.filter((name) => SOUP_INGREDIENTS.includes(name)),
      'soups only',
    ).toEqual([]);
  });

  it('lists "canned white beans" right after "canned tuna" and "hummus" right after "green curry paste" in "Cans & jars", and puts both there', () => {
    const cansAndJars = INGREDIENTS_BY_SECTION['Cans & jars'];
    expect(cansAndJars[cansAndJars.indexOf('canned tuna') + 1]).toBe('canned white beans');
    expect(cansAndJars[cansAndJars.indexOf('green curry paste') + 1]).toBe('hummus');
    expect(['hummus', 'canned white beans'].map(sectionOf)).toEqual(['Cans & jars', 'Cans & jars']);
  });

  it('puts each of the 4 ingredients only the soups used under "Other", but keeps sour cream, pine nut, sesame seed, potato and red onion in their sections', () => {
    expect(SOUP_INGREDIENTS.map((name) => [name, sectionOf(name)])).toEqual(
      SOUP_INGREDIENTS.map((name) => [name, 'Other']),
    );
    expect(['sour cream', 'pine nut', 'sesame seed', 'potato', 'red onion'].map(sectionOf)).toEqual(
      ['Dairy & eggs', 'Nuts & seeds', 'Nuts & seeds', 'Fruit & vegetables', 'Fruit & vegetables'],
    );
  });

  it('puts each of the 25 ingredients of #58 in its section, at its alphabetical position there, none under "Other", and none of them among the ingredients only removed recipes used (#58 5)', () => {
    expect(ADDED_SECTIONS.map(([name]) => [name, sectionOf(name)])).toEqual(ADDED_SECTIONS);
    for (const [section, names] of Object.entries(INGREDIENTS_BY_SECTION)) {
      expect(names, `"${section}" in alphabetical order`).toEqual([...names].sort());
    }
    expect(
      ADDED_SECTIONS.filter(([name]) => REMOVED_INGREDIENTS.includes(name)),
      'removed',
    ).toEqual([]);
  });
});
