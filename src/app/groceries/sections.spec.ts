import { RECIPES } from '../recipes/recipes';
import {
  AT_HOME,
  INGREDIENTS_BY_SECTION,
  PANTRY_STAPLES,
  Section,
  SECTIONS,
  sectionOf,
} from './sections';

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
  ['mayonnaise', 'Probably at home'],
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

// #61's ingredients most kitchens keep
const AT_HOME_NAMES = [
  'bay leaf',
  'beef stock',
  'breadcrumbs',
  'butter',
  'caraway',
  'chili flakes',
  'chili powder',
  'cumin',
  'curry powder',
  'egg',
  'flour',
  'garlic clove',
  'ketchup',
  'lemon',
  'marjoram',
  'mayonnaise',
  'milk',
  'mustard',
  'nutmeg',
  'onion',
  'oregano',
  'paprika',
  'rice',
  'soy sauce',
  'sugar',
  'tomato paste',
  'vegetable stock',
  'white wine vinegar',
  'worcestershire sauce',
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

  it('puts each of the 25 ingredients of #58 in its section, mayonnaise under "Probably at home", at its alphabetical position there, none under "Other", and none of them among the ingredients only removed recipes used (#58 5, changed by #61)', () => {
    expect(ADDED_SECTIONS.map(([name]) => [name, sectionOf(name)])).toEqual(ADDED_SECTIONS);
    for (const [section, names] of Object.entries(INGREDIENTS_BY_SECTION)) {
      expect(names, `"${section}" in alphabetical order`).toEqual([...names].sort());
    }
    expect(
      ADDED_SECTIONS.filter(([name]) => REMOVED_INGREDIENTS.includes(name)),
      'removed',
    ).toEqual([]);
  });

  describe('"Probably at home" (#61)', () => {
    it('lists exactly the 29 ingredients most kitchens keep in AT_HOME, in alphabetical order, each mapped to a shop section and none a pantry staple, puts "Probably at home" first in SECTIONS, and gives "Probably at home" for lemon, rice, egg and soy sauce, "Fruit & vegetables" for carrot, "Dairy & eggs" for cheddar and "Other" for olive oil and mystery spice (#61 1)', () => {
      expect(AT_HOME).toEqual(AT_HOME_NAMES);
      expect(AT_HOME, 'alphabetical').toEqual([...AT_HOME].sort());
      const mapped = Object.values(INGREDIENTS_BY_SECTION).flat();
      expect(
        AT_HOME.filter((name) => !mapped.includes(name)),
        'not mapped',
      ).toEqual([]);
      expect(
        AT_HOME.filter((name) => PANTRY_STAPLES.includes(name)),
        'pantry staples',
      ).toEqual([]);
      expect(SECTIONS).toEqual([
        'Probably at home',
        'Fruit & vegetables',
        'Meat & fish',
        'Dairy & eggs',
        'Bread & bakery',
        'Pasta, rice & grains',
        'Cans & jars',
        'Spices & sauces',
        'Nuts & seeds',
        'Drinks',
        'Other',
      ]);
      const names = [
        'lemon',
        'rice',
        'egg',
        'soy sauce',
        'carrot',
        'cheddar',
        'olive oil',
        'mystery spice',
      ];
      expect(names.map((name) => [name, sectionOf(name)])).toEqual([
        ['lemon', 'Probably at home'],
        ['rice', 'Probably at home'],
        ['egg', 'Probably at home'],
        ['soy sauce', 'Probably at home'],
        ['carrot', 'Fruit & vegetables'],
        ['cheddar', 'Dairy & eggs'],
        ['olive oil', 'Other'],
        ['mystery spice', 'Other'],
      ]);
    });

    describe('edge cases', () => {
      it('puts only the exact names under "Probably at home": onion, lemon, rice, egg, milk and mustard there, but red onion, spring onion and lime under "Fruit & vegetables", rice noodle and egg noodle under "Pasta, rice & grains", coconut milk under "Cans & jars" and fish sauce under "Spices & sauces" (#61 1a)', () => {
        const names = [
          'onion',
          'lemon',
          'rice',
          'egg',
          'milk',
          'mustard',
          'red onion',
          'spring onion',
          'lime',
          'rice noodle',
          'egg noodle',
          'coconut milk',
          'fish sauce',
        ];
        expect(names.map((name) => [name, sectionOf(name)])).toEqual([
          ['onion', 'Probably at home'],
          ['lemon', 'Probably at home'],
          ['rice', 'Probably at home'],
          ['egg', 'Probably at home'],
          ['milk', 'Probably at home'],
          ['mustard', 'Probably at home'],
          ['red onion', 'Fruit & vegetables'],
          ['spring onion', 'Fruit & vegetables'],
          ['lime', 'Fruit & vegetables'],
          ['rice noodle', 'Pasta, rice & grains'],
          ['egg noodle', 'Pasta, rice & grains'],
          ['coconut milk', 'Cans & jars'],
          ['fish sauce', 'Spices & sauces'],
        ]);
      });

      it('gives "Probably at home" for each of the 29 names and its mapped section for every other mapped ingredient, while INGREDIENTS_BY_SECTION keeps the 29 in their shop sections and has no "Probably at home" key (#61 1b)', () => {
        expect(AT_HOME.map((name) => [name, sectionOf(name)])).toEqual(
          AT_HOME_NAMES.map((name) => [name, 'Probably at home']),
        );
        for (const [section, names] of Object.entries(INGREDIENTS_BY_SECTION)) {
          const others = names.filter((name) => !AT_HOME.includes(name));
          expect(others.map(sectionOf), section).toEqual(others.map(() => section));
        }
        expect(Object.keys(INGREDIENTS_BY_SECTION)).toEqual(
          SECTIONS.filter((section) => section !== 'Probably at home' && section !== 'Other'),
        );
        expect(INGREDIENTS_BY_SECTION['Fruit & vegetables'], 'lemon mapped').toContain('lemon');
        expect(INGREDIENTS_BY_SECTION['Pasta, rice & grains'], 'rice mapped').toContain('rice');
      });
    });
  });
});
