import { Recipe, UNITS, Unit } from './recipe';
import { RECIPES } from './recipes';

const SPEC_NAMES = [
  'Spaghetti pomodoro',
  'Spaghetti carbonara',
  'Pesto pasta with cherry tomatoes',
  'Lasagne',
  'Käsespätzle',
  'Chili con carne',
  'Goulash with bread',
  'Beef burgers with oven fries',
  'Stuffed peppers',
  'Schnitzel with potato salad',
  'Chicken curry with rice',
  'Teriyaki chicken with rice',
  'Chicken fajitas',
  'Chicken Caesar salad',
  'Oven-baked salmon with potatoes and green beans',
  'Fish tacos',
  'Chickpea and spinach curry',
  'Vegetable stir-fry with noodles',
  'Fried rice with egg and vegetables',
  'Ratatouille with rice',
  'Mushroom risotto',
  'Shakshuka with bread',
  'Spinach and feta quiche',
  'Baked potatoes with herb quark',
  'Couscous salad with halloumi',
  'Greek salad with feta and bread',
  'Lentil soup',
  'Minestrone',
  'Pumpkin soup',
  'Tomato soup with grilled cheese',
  'Spaghetti bolognese',
  'Penne arrabbiata',
  'Spaghetti aglio e olio',
  'Mac and cheese',
  'Gnocchi with tomato sauce and mozzarella',
  'Spinach and ricotta cannelloni',
  'Pizza margherita',
  "Shepherd's pie",
  'Meatballs in tomato sauce with rice',
  'Beef stroganoff with rice',
  'Bratwurst with sauerkraut and mashed potatoes',
  'Sweet and sour pork with rice',
  'Chicken drumsticks with roasted vegetables',
  'Butter chicken with naan',
  'Chicken noodle soup',
  'Chicken quesadillas',
  'Pad thai with chicken',
  'Fish and chips',
  'Tuna pasta bake',
  'Seafood paella',
  'Thai green curry with prawns',
  'Falafel wraps with hummus',
  'Bean burritos',
  'Eggplant parmigiana',
  'Spanish tortilla with salad',
  'Potato and leek soup',
  'French onion soup',
  'Potato goulash',
  'Sweet potato and black bean chili',
  'Niçoise salad',
];

const SPEC_MINUTES: Record<string, number> = {
  'Spaghetti pomodoro': 25,
  'Spaghetti carbonara': 20,
  'Pesto pasta with cherry tomatoes': 20,
  Lasagne: 105,
  Käsespätzle: 45,
  'Chili con carne': 75,
  'Goulash with bread': 150,
  'Beef burgers with oven fries': 45,
  'Stuffed peppers': 60,
  'Schnitzel with potato salad': 50,
  'Chicken curry with rice': 40,
  'Teriyaki chicken with rice': 30,
  'Chicken fajitas': 30,
  'Chicken Caesar salad': 25,
  'Oven-baked salmon with potatoes and green beans': 45,
  'Fish tacos': 30,
  'Chickpea and spinach curry': 30,
  'Vegetable stir-fry with noodles': 25,
  'Fried rice with egg and vegetables': 35,
  'Ratatouille with rice': 60,
  'Mushroom risotto': 40,
  'Shakshuka with bread': 30,
  'Spinach and feta quiche': 60,
  'Baked potatoes with herb quark': 70,
  'Couscous salad with halloumi': 25,
  'Greek salad with feta and bread': 15,
  'Lentil soup': 35,
  Minestrone: 50,
  'Pumpkin soup': 45,
  'Tomato soup with grilled cheese': 35,
  'Spaghetti bolognese': 60,
  'Penne arrabbiata': 25,
  'Spaghetti aglio e olio': 15,
  'Mac and cheese': 35,
  'Gnocchi with tomato sauce and mozzarella': 30,
  'Spinach and ricotta cannelloni': 75,
  'Pizza margherita': 120,
  "Shepherd's pie": 90,
  'Meatballs in tomato sauce with rice': 50,
  'Beef stroganoff with rice': 35,
  'Bratwurst with sauerkraut and mashed potatoes': 40,
  'Sweet and sour pork with rice': 40,
  'Chicken drumsticks with roasted vegetables': 60,
  'Butter chicken with naan': 80,
  'Chicken noodle soup': 50,
  'Chicken quesadillas': 25,
  'Pad thai with chicken': 30,
  'Fish and chips': 60,
  'Tuna pasta bake': 45,
  'Seafood paella': 60,
  'Thai green curry with prawns': 30,
  'Falafel wraps with hummus': 50,
  'Bean burritos': 35,
  'Eggplant parmigiana': 75,
  'Spanish tortilla with salad': 45,
  'Potato and leek soup': 40,
  'French onion soup': 90,
  'Potato goulash': 45,
  'Sweet potato and black bean chili': 45,
  'Niçoise salad': 30,
};

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

  it('contains exactly the 60 recipes named in the spec, in the spec order', () => {
    expect(RECIPES.map((recipe) => recipe.name)).toEqual(SPEC_NAMES);
  });

  it('has whole-number servings', () => {
    expectRecipesLoaded();
    const problems = RECIPES.filter((recipe) => !Number.isInteger(recipe.servings)).map(
      (recipe) => `"${recipe.name}": servings ${recipe.servings}`,
    );
    expect(problems).toEqual([]);
  });

  it('has the minutes of the spec table for every recipe', () => {
    expectRecipesLoaded();
    expect(Object.keys(SPEC_MINUTES), 'recipes in the minutes table').toEqual(SPEC_NAMES);
    const problems = RECIPES.filter((recipe) => recipe.minutes !== SPEC_MINUTES[recipe.name]).map(
      (recipe) => `"${recipe.name}": minutes ${recipe.minutes}, not ${SPEC_MINUTES[recipe.name]}`,
    );
    expect(problems).toEqual([]);
  });

  it('has minutes that are a whole multiple of 5 from 10 to 240 for every recipe', () => {
    expectRecipesLoaded();
    const problems = RECIPES.filter(
      (recipe) =>
        !Number.isInteger(recipe.minutes) ||
        recipe.minutes % 5 !== 0 ||
        recipe.minutes < 10 ||
        recipe.minutes > 240,
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
