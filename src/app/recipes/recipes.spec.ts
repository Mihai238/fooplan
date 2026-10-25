import { Recipe, UNITS, Unit } from './recipe';
import { RECIPES } from './recipes';

const SPEC_NAMES = [
  'Spaghetti pomodoro',
  'Spaghetti carbonara',
  'Pesto pasta with cherry tomatoes',
  'Beef burgers with oven fries',
  'Chicken curry with rice',
  'Teriyaki chicken with rice',
  'Chicken fajitas',
  'Chicken Caesar salad',
  'Oven-baked salmon with potatoes and green beans',
  'Fish tacos',
  'Chickpea and spinach curry',
  'Vegetable stir-fry with noodles',
  'Shakshuka with bread',
  'Couscous salad with halloumi',
  'Greek salad with feta and bread',
  'Penne arrabbiata',
  'Spaghetti aglio e olio',
  'Mac and cheese',
  'Gnocchi with tomato sauce and mozzarella',
  'Beef stroganoff with rice',
  'Bratwurst with sauerkraut and mashed potatoes',
  'Chicken quesadillas',
  'Pad thai with chicken',
  'Tuna pasta bake',
  'Thai green curry with prawns',
  'Bean burritos',
  'Potato goulash',
  'Sweet potato and black bean chili',
  'Niçoise salad',
  'Hummus plate with bread and vegetables',
  'Avocado toast with fried egg',
  'Caprese salad with bread',
  'Spinach and feta omelette',
  'Tuna and white bean salad with bread',
];

const SPEC_TIMES: Record<string, { minutes: number; workMinutes: number }> = {
  'Spaghetti pomodoro': { minutes: 25, workMinutes: 15 },
  'Spaghetti carbonara': { minutes: 20, workMinutes: 20 },
  'Pesto pasta with cherry tomatoes': { minutes: 20, workMinutes: 15 },
  'Beef burgers with oven fries': { minutes: 45, workMinutes: 25 },
  'Chicken curry with rice': { minutes: 40, workMinutes: 25 },
  'Teriyaki chicken with rice': { minutes: 30, workMinutes: 25 },
  'Chicken fajitas': { minutes: 30, workMinutes: 25 },
  'Chicken Caesar salad': { minutes: 25, workMinutes: 25 },
  'Oven-baked salmon with potatoes and green beans': { minutes: 45, workMinutes: 15 },
  'Fish tacos': { minutes: 30, workMinutes: 30 },
  'Chickpea and spinach curry': { minutes: 30, workMinutes: 20 },
  'Vegetable stir-fry with noodles': { minutes: 25, workMinutes: 20 },
  'Shakshuka with bread': { minutes: 30, workMinutes: 15 },
  'Couscous salad with halloumi': { minutes: 25, workMinutes: 25 },
  'Greek salad with feta and bread': { minutes: 15, workMinutes: 15 },
  'Penne arrabbiata': { minutes: 25, workMinutes: 15 },
  'Spaghetti aglio e olio': { minutes: 15, workMinutes: 15 },
  'Mac and cheese': { minutes: 35, workMinutes: 15 },
  'Gnocchi with tomato sauce and mozzarella': { minutes: 30, workMinutes: 15 },
  'Beef stroganoff with rice': { minutes: 35, workMinutes: 30 },
  'Bratwurst with sauerkraut and mashed potatoes': { minutes: 40, workMinutes: 20 },
  'Chicken quesadillas': { minutes: 25, workMinutes: 20 },
  'Pad thai with chicken': { minutes: 30, workMinutes: 20 },
  'Tuna pasta bake': { minutes: 45, workMinutes: 20 },
  'Thai green curry with prawns': { minutes: 30, workMinutes: 25 },
  'Bean burritos': { minutes: 35, workMinutes: 25 },
  'Potato goulash': { minutes: 45, workMinutes: 20 },
  'Sweet potato and black bean chili': { minutes: 45, workMinutes: 20 },
  'Niçoise salad': { minutes: 30, workMinutes: 15 },
  'Hummus plate with bread and vegetables': { minutes: 10, workMinutes: 10 },
  'Avocado toast with fried egg': { minutes: 15, workMinutes: 15 },
  'Caprese salad with bread': { minutes: 10, workMinutes: 10 },
  'Spinach and feta omelette': { minutes: 15, workMinutes: 15 },
  'Tuna and white bean salad with bread': { minutes: 10, workMinutes: 5 },
};

// #29's data, so a changed amount or a typo in a step fails, not just a broken rule
const EASY_RECIPES: Recipe[] = [
  {
    name: 'Hummus plate with bread and vegetables',
    servings: 2,
    minutes: 10,
    workMinutes: 10,
    ingredients: [
      { name: 'hummus', amount: 200, unit: 'g' },
      { name: 'bread', amount: 200, unit: 'g' },
      { name: 'cucumber', amount: 1, unit: 'pc' },
      { name: 'carrot', amount: 2, unit: 'pc' },
      { name: 'cherry tomato', amount: 150, unit: 'g' },
      { name: 'lemon', amount: 0.5, unit: 'pc' },
      { name: 'olive oil', amount: 1, unit: 'tbsp' },
      { name: 'paprika', amount: 1, unit: 'tsp' },
    ],
    steps: [
      'Cut the cucumber and the carrots into sticks and halve the cherry tomatoes.',
      'Spread the hummus in a shallow bowl, squeeze the lemon over it, drizzle it with the olive oil and sprinkle it with the paprika.',
      'Toast the bread slices in a dry pan over medium heat, about 1 minute per side.',
      'Serve the hummus with the bread and the vegetables for dipping.',
    ],
  },
  {
    name: 'Avocado toast with fried egg',
    servings: 2,
    minutes: 15,
    workMinutes: 15,
    ingredients: [
      { name: 'bread', amount: 150, unit: 'g' },
      { name: 'avocado', amount: 1, unit: 'pc' },
      { name: 'lemon', amount: 0.5, unit: 'pc' },
      { name: 'egg', amount: 2, unit: 'pc' },
      { name: 'olive oil', amount: 1, unit: 'tbsp' },
      { name: 'chili flakes', amount: 0.5, unit: 'tsp' },
    ],
    steps: [
      'Toast the bread slices in a toaster or a dry pan until golden.',
      'Halve the avocado, scoop out the flesh and mash it with the juice of the lemon, salt and pepper.',
      'Heat the olive oil in a pan over medium heat and fry the eggs for 3 to 4 minutes until the whites are set and the yolks still soft.',
      'Spread the avocado on the toast, top each slice with a fried egg and sprinkle with the chili flakes.',
    ],
  },
  {
    name: 'Caprese salad with bread',
    servings: 2,
    minutes: 10,
    workMinutes: 10,
    ingredients: [
      { name: 'tomato', amount: 4, unit: 'pc' },
      { name: 'mozzarella', amount: 250, unit: 'g' },
      { name: 'basil', amount: 15, unit: 'g' },
      { name: 'olive oil', amount: 3, unit: 'tbsp' },
      { name: 'bread', amount: 200, unit: 'g' },
    ],
    steps: [
      'Slice the tomatoes and the mozzarella into rounds about 1 cm thick.',
      'Arrange them on a plate in alternating, overlapping slices and tuck the basil leaves in between.',
      'Season with salt and pepper and drizzle the olive oil over the salad.',
      'Slice the bread and serve it with the salad.',
    ],
  },
  {
    name: 'Spinach and feta omelette',
    servings: 2,
    minutes: 15,
    workMinutes: 15,
    ingredients: [
      { name: 'egg', amount: 4, unit: 'pc' },
      { name: 'spinach', amount: 100, unit: 'g' },
      { name: 'feta', amount: 100, unit: 'g' },
      { name: 'spring onion', amount: 2, unit: 'pc' },
      { name: 'butter', amount: 20, unit: 'g' },
    ],
    steps: [
      'Rinse the spinach and slice the spring onions finely.',
      'Whisk the eggs with salt and pepper and crumble the feta.',
      'Melt the butter in a non-stick pan over medium heat and cook the spring onions and the spinach for 2 minutes until the spinach wilts.',
      'Pour in the eggs, scatter the feta over them and cook for 3 to 4 minutes until the omelette is set at the edges but still soft on top.',
      'Fold the omelette in half, cut it in two and serve.',
    ],
  },
  {
    name: 'Tuna and white bean salad with bread',
    servings: 2,
    minutes: 10,
    workMinutes: 5,
    ingredients: [
      { name: 'canned white beans', amount: 400, unit: 'g' },
      { name: 'canned tuna', amount: 150, unit: 'g' },
      { name: 'red onion', amount: 0.5, unit: 'pc' },
      { name: 'parsley', amount: 10, unit: 'g' },
      { name: 'lemon', amount: 1, unit: 'pc' },
      { name: 'olive oil', amount: 3, unit: 'tbsp' },
      { name: 'bread', amount: 200, unit: 'g' },
    ],
    steps: [
      'Drain and rinse the canned white beans and drain the canned tuna.',
      'Slice the red onion into thin half-rings and chop the parsley.',
      'Mix the beans, the tuna, the red onion and the parsley in a bowl with the juice of the lemon, the olive oil, salt and pepper.',
      'Let the salad stand for 5 minutes, then slice the bread and serve it alongside.',
    ],
  },
];

const EASY_START = SPEC_NAMES.length - EASY_RECIPES.length;

const REMOVED_NAMES = [
  'Lasagne',
  'Chili con carne',
  'Goulash with bread',
  'Stuffed peppers',
  'Schnitzel with potato salad',
  'Fried rice with egg and vegetables',
  'Ratatouille with rice',
  'Spinach and feta quiche',
  'Baked potatoes with herb quark',
  'Minestrone',
  'Spaghetti bolognese',
  'Spinach and ricotta cannelloni',
  'Pizza margherita',
  "Shepherd's pie",
  'Meatballs in tomato sauce with rice',
  'Chicken drumsticks with roasted vegetables',
  'Butter chicken with naan',
  'Chicken noodle soup',
  'Fish and chips',
  'Seafood paella',
  'Falafel wraps with hummus',
  'Eggplant parmigiana',
  'Spanish tortilla with salad',
  'French onion soup',
  'Käsespätzle',
  'Mushroom risotto',
  'Sweet and sour pork with rice',
];

const SOUP_INGREDIENTS = ['chive', 'cream', 'leek', 'pumpkin', 'pumpkin seed', 'red lentil'];

describe('RECIPES', () => {
  it('has a unique name, servings > 0 and at least one ingredient with amount > 0 and a known unit per recipe', () => {
    expectRecipesLoaded();
    const problems: string[] = [];
    const seenNames = new Set<string>();
    for (const recipe of RECIPES) {
      if (seenNames.has(recipe.name)) problems.push(`"${recipe.name}": duplicate name`);
      seenNames.add(recipe.name);
      if (!(recipe.servings > 0)) problems.push(`"${recipe.name}": servings ${recipe.servings}`);
      if (recipe.ingredients.length === 0) problems.push(`"${recipe.name}": no ingredients`);
      for (const ingredient of recipe.ingredients) {
        if (!(ingredient.amount > 0)) {
          problems.push(`"${recipe.name}" / "${ingredient.name}": amount ${ingredient.amount}`);
        }
        if (!UNITS.includes(ingredient.unit)) {
          problems.push(
            `"${recipe.name}" / "${ingredient.name}": unknown unit "${ingredient.unit}"`,
          );
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('has whole-number servings', () => {
    expectRecipesLoaded();
    const problems = RECIPES.filter((recipe) => !Number.isInteger(recipe.servings)).map(
      (recipe) => `"${recipe.name}": servings ${recipe.servings}`,
    );
    expect(problems).toEqual([]);
  });

  it('contains exactly the 34 recipes of the spec table, in its order, each with its minutes and workMinutes', () => {
    expect(Object.keys(SPEC_TIMES), 'recipes in the times table').toEqual(SPEC_NAMES);
    expect(
      RECIPES.map(({ name, minutes, workMinutes }) => ({ name, minutes, workMinutes })),
    ).toEqual(SPEC_NAMES.map((name) => ({ name, ...SPEC_TIMES[name] })));
  });

  it('holds the 5 easy recipes of #29 after the first 29, in their order, each with exactly its servings, minutes, workMinutes, ingredients and steps', () => {
    expect(RECIPES.slice(EASY_START)).toEqual(EASY_RECIPES);
  });

  it('uses "canned white beans" and "hummus" as the only ingredient names in the 5 easy recipes that the first 29 recipes do not use', () => {
    const known = new Set(
      RECIPES.slice(0, EASY_START).flatMap((recipe) =>
        recipe.ingredients.map((ingredient) => ingredient.name),
      ),
    );
    const easy = RECIPES.slice(EASY_START).flatMap((recipe) =>
      recipe.ingredients.map((ingredient) => ingredient.name),
    );
    expect(easy.length, 'no easy recipes loaded').toBeGreaterThan(0);
    expect([...new Set(easy.filter((name) => !known.has(name)))].sort()).toEqual([
      'canned white beans',
      'hummus',
    ]);
  });

  it('has workMinutes that are a whole multiple of 5 from 5 up to its minutes and at most 30, and minutes of at most 45, for every recipe', () => {
    expectRecipesLoaded();
    const problems = RECIPES.filter(
      (recipe) =>
        !Number.isInteger(recipe.workMinutes) ||
        recipe.workMinutes! % 5 !== 0 ||
        recipe.workMinutes! < 5 ||
        recipe.workMinutes! > recipe.minutes! ||
        recipe.workMinutes! > 30 ||
        recipe.minutes! > 45,
    ).map(
      (recipe) => `"${recipe.name}": workMinutes ${recipe.workMinutes}, minutes ${recipe.minutes}`,
    );
    expect(problems).toEqual([]);
  });

  it('contains none of the 27 recipes the spec removes', () => {
    expectRecipesLoaded();
    expect(
      RECIPES.map((recipe) => recipe.name).filter((name) => REMOVED_NAMES.includes(name)),
    ).toEqual([]);
  });

  it('has no recipe whose name contains "soup"', () => {
    expectRecipesLoaded();
    expect(RECIPES.map((recipe) => recipe.name).filter((name) => /soup/i.test(name))).toEqual([]);
  });

  it('uses none of the 6 ingredients only the soups used in any recipe', () => {
    expectRecipesLoaded();
    const problems = RECIPES.flatMap((recipe) =>
      recipe.ingredients
        .filter((ingredient) => SOUP_INGREDIENTS.includes(ingredient.name))
        .map((ingredient) => `"${recipe.name}": "${ingredient.name}"`),
    );
    expect(problems).toEqual([]);
  });

  it('has minutes that are a whole multiple of 5 from 10 to 240 for every recipe', () => {
    expectRecipesLoaded();
    const problems = RECIPES.filter(
      (recipe) =>
        !Number.isInteger(recipe.minutes) ||
        recipe.minutes! % 5 !== 0 ||
        recipe.minutes! < 10 ||
        recipe.minutes! > 240,
    ).map((recipe) => `"${recipe.name}": minutes ${recipe.minutes}`);
    expect(problems).toEqual([]);
  });

  it('lists no ingredient name twice within a recipe', () => {
    expectRecipesLoaded();
    const problems: string[] = [];
    for (const recipe of RECIPES) {
      const seen = new Set<string>();
      for (const ingredient of recipe.ingredients) {
        if (seen.has(ingredient.name)) {
          problems.push(`"${recipe.name}": "${ingredient.name}" twice`);
        }
        seen.add(ingredient.name);
      }
    }
    expect(problems).toEqual([]);
  });

  it('spells ingredient names in lowercase without leading or trailing whitespace', () => {
    expectRecipesLoaded();
    const problems = RECIPES.flatMap((recipe) =>
      recipe.ingredients
        .filter((ingredient) => ingredient.name !== ingredient.name.trim().toLowerCase())
        .map((ingredient) => `"${recipe.name}": "${ingredient.name}"`),
    );
    expect(problems).toEqual([]);
  });

  it('uses the same unit for an ingredient name in every recipe', () => {
    expectRecipesLoaded();
    const firstUse = new Map<string, { unit: Unit; recipe: string }>();
    const problems: string[] = [];
    for (const recipe of RECIPES) {
      for (const ingredient of recipe.ingredients) {
        const first = firstUse.get(ingredient.name);
        if (!first) {
          firstUse.set(ingredient.name, { unit: ingredient.unit, recipe: recipe.name });
        } else if (first.unit !== ingredient.unit) {
          problems.push(
            `"${ingredient.name}": ${first.unit} in "${first.recipe}", ${ingredient.unit} in "${recipe.name}"`,
          );
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('has no ingredient name that is another ingredient name plus "s" or "es"', () => {
    expectRecipesLoaded();
    const names = new Set(
      RECIPES.flatMap((recipe) => recipe.ingredients.map((ingredient) => ingredient.name)),
    );
    const problems = [...names].flatMap((name) =>
      ['s', 'es']
        .filter((suffix) => names.has(name + suffix))
        .map((suffix) => `"${name}" and "${name + suffix}"`),
    );
    expect(problems).toEqual([]);
  });

  it('stores vegetable oil in ml in every recipe', () => {
    const oils = RECIPES.flatMap((recipe) =>
      recipe.ingredients
        .filter((ingredient) => ingredient.name === 'vegetable oil')
        .map((ingredient) => ({ recipe: recipe.name, unit: ingredient.unit })),
    );
    expect(oils.length, 'no recipe with vegetable oil').toBeGreaterThan(0);
    expect(oils.filter((oil) => oil.unit !== 'ml')).toEqual([]);
  });

  it('has at least three steps per recipe, none of them empty', () => {
    expectRecipesLoaded();
    const problems: string[] = [];
    for (const recipe of RECIPES) {
      const steps = stepsOf(recipe);
      if (steps.length < 3) problems.push(`"${recipe.name}": ${steps.length} steps`);
      steps.forEach((step, index) => {
        if (typeof step !== 'string' || step.trim() === '') {
          problems.push(`"${recipe.name}": step ${index + 1} empty`);
        }
      });
    }
    expect(problems).toEqual([]);
  });

  it('names every ingredient of a recipe in at least one of its steps', () => {
    expectRecipesLoaded();
    const problems = RECIPES.flatMap((recipe) => {
      const text = stepsOf(recipe).join('\n').toLowerCase();
      return recipe.ingredients
        .filter((ingredient) => !containsWord(text, ingredient.name))
        .map((ingredient) => `"${recipe.name}": "${ingredient.name}" in no step`);
    });
    expect(problems).toEqual([]);
  });

  // Water, salt and pepper, which steps may use, need no exception: the recipe rules keep them off
  // every ingredient list, so they aren't in the catalog
  it('names no ingredient of the catalog that the recipe does not list as a whole word in its steps', () => {
    expectRecipesLoaded();
    const recipesWithoutSteps = RECIPES.filter((recipe) => stepsOf(recipe).length === 0);
    expect(
      recipesWithoutSteps.map((recipe) => recipe.name),
      'recipes without steps pass vacuously',
    ).toEqual([]);
    const catalog = new Set(
      RECIPES.flatMap((recipe) => recipe.ingredients.map((ingredient) => ingredient.name)),
    );
    const problems = RECIPES.flatMap((recipe) =>
      unlistedIngredients(
        stepsOf(recipe),
        recipe.ingredients.map((ingredient) => ingredient.name),
        catalog,
      ).map((name) => `"${recipe.name}": "${name}" not listed`),
    );
    expect(problems).toEqual([]);
  });

  it('reports an unlisted ingredient that contains a listed name or is in the plural, but not a listed plural or a name inside another word', () => {
    const catalog = [
      'egg',
      'eggplant',
      'onion',
      'red onion',
      'spring onion',
      'oil',
      'pea',
      'anchovy',
    ];
    expect(unlistedIngredients(['Fry the eggplant.'], ['egg'], catalog)).toEqual(['eggplant']);
    expect(unlistedIngredients(['Chop the spring onion.'], ['onion'], catalog)).toEqual([
      'spring onion',
    ]);
    expect(unlistedIngredients(['Slice the onions.'], ['red onion'], catalog)).toEqual(['onion']);
    expect(unlistedIngredients(['Slice the red onions.'], ['red onion'], catalog)).toEqual([]);
    expect(unlistedIngredients(['Beat the eggs.'], ['egg'], catalog)).toEqual([]);
    expect(unlistedIngredients(['Boil the peanuts.'], [], catalog)).toEqual([]);
    expect(unlistedIngredients(['Chop the anchovies.'], [], catalog)).toEqual(['anchovy']);
    expect(unlistedIngredients(['Add the bay leaves.'], ['bay leaf'], catalog)).toEqual([]);
  });

  it('names an ingredient as a whole word or its plural, not inside another word', () => {
    expect(containsWord('slice the onions', 'onion')).toBe(true);
    expect(containsWord('peel the potatoes', 'potato')).toBe(true);
    expect(containsWord('grate the gruyère', 'gruyère')).toBe(true);
    expect(containsWord('chop the anchovies', 'anchovy')).toBe(true);
    expect(containsWord('add the bay leaves', 'bay leaf')).toBe(true);
    expect(containsWord('bring to the boil', 'oil')).toBe(false);
    expect(containsWord('add the peanuts', 'pea')).toBe(false);
    expect(containsWord('roast the turkies', 'turkey')).toBe(false);
    expect(containsWord('brown the beeves', 'beef')).toBe(false);
  });

  // Without it, the invariant tests would pass vacuously on an empty list
  function expectRecipesLoaded() {
    expect(RECIPES.length, 'no recipes loaded').toBeGreaterThan(0);
  }

  // recipes.json is only cast to Recipe, so a recipe without steps gets here as undefined
  function stepsOf(recipe: Recipe): string[] {
    return recipe.steps ?? [];
  }

  // Longest first, each name blanked once looked for: a listed "red onion" leaves no "onion" behind,
  // and an unlisted "spring onion" is found before a listed "onion" inside it is blanked
  function unlistedIngredients(
    steps: string[],
    own: string[],
    catalog: Iterable<string>,
  ): string[] {
    const unlisted: string[] = [];
    let text = steps.join('\n').toLowerCase();
    for (const name of [...new Set([...catalog, ...own])].sort((a, b) => b.length - a.length)) {
      if (!own.includes(name) && containsWord(text, name)) unlisted.push(name);
      text = text.replace(wordPattern(name, 'gu'), ' ');
    }
    return unlisted;
  }

  function containsWord(text: string, name: string): boolean {
    return wordPattern(name, 'u').test(text);
  }

  // \b only knows ASCII letters, and names like "gruyère" have others. The plural endings let
  // "onions", "tomatoes", "anchovies" and "leaves" name their ingredient. f→ves only after a, l or r,
  // since "beef" has no "beeves"
  function wordPattern(name: string, flags: string): RegExp {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const irregular = escaped.replace(/(?<=[^aeiou])y$/, 'ies').replace(/(?<=[alr])f$/, 'ves');
    const plurals = irregular === escaped ? '(?:e?s)?' : `(?:e?s)?|${irregular}`;
    return new RegExp(`(?<![\\p{L}\\p{N}])(?:${escaped}${plurals})(?![\\p{L}\\p{N}])`, flags);
  }
});
