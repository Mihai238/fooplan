import { checkRecipe, IngredientDraft, RecipeDraft, RecipeProblems } from './own-recipe';
import { Recipe, Unit } from './recipe';
import { RECIPES } from './recipes';
import { QUICK_DAL } from './testing';

const NAME_EMPTY = 'Enter a name.';
const NAME_LONG = 'Use at most 60 characters.';
const NAME_NO_LETTER = 'Use at least one letter or digit.';
const NAME_TAKEN = 'A recipe with this name already exists.';
const SERVINGS = 'Enter a whole number from 1 to 12.';
const AMOUNT = 'Enter an amount above 0.';
const INGREDIENT_EMPTY = 'Enter an ingredient.';
const INGREDIENT_LONG = 'Use at most 40 characters.';
const INGREDIENT_TWICE = 'This ingredient is already in the list.';
const NO_INGREDIENT = 'Add at least one ingredient.';

describe('checkRecipe', () => {
  it('saves "  Grandma\'s   Soup " for " 4 " servings as "Grandma\'s Soup" for 4, with the rows (1,5 pc " Onion ") and (200 g "canned chickpeas") as onion 1.5 pc and canned chickpeas 200 g in that order, ignoring an empty row', () => {
    const recipe = recipeOf(
      draft({
        name: "  Grandma's   Soup ",
        servings: ' 4 ',
        ingredients: [
          row('1,5', 'pc', ' Onion '),
          row('200', 'g', 'canned chickpeas'),
          row('', 'g', ''),
        ],
      }),
    );
    const { name, servings, ingredients } = recipe;
    expect({ name, servings, ingredients }).toEqual({
      name: "Grandma's Soup",
      servings: 4,
      ingredients: [
        { name: 'onion', amount: 1.5, unit: 'pc' },
        { name: 'canned chickpeas', amount: 200, unit: 'g' },
      ],
    });
  });

  it('asks for a name when it is empty, for at most 60 characters for 61 "a" or 61 "!", for a letter or digit for "!!!", and for another name for "spaghetti CARBONARA" or "Spaghetti carbonara!"', () => {
    for (const [name, problem] of [
      ['', NAME_EMPTY],
      ['a'.repeat(61), NAME_LONG],
      ['!!!', NAME_NO_LETTER],
      ['!'.repeat(61), NAME_LONG],
      ['spaghetti CARBONARA', NAME_TAKEN],
      ['Spaghetti carbonara!', NAME_TAKEN],
    ]) {
      expect(problemsOf(draft({ name })), JSON.stringify(name)).toEqual({
        name: problem,
        rows: [{}],
      });
    }
  });

  it('asks for a whole number from 1 to 12 for the servings 0, 13, 2.5, +2 and two, and takes 1 and 12', () => {
    for (const servings of ['0', '13', '2.5', '+2', 'two']) {
      expect(problemsOf(draft({ servings })), servings).toEqual({ servings: SERVINGS, rows: [{}] });
    }
    expect(recipeOf(draft({ servings: '1' })).servings).toBe(1);
    expect(recipeOf(draft({ servings: '12' })).servings).toBe(12);
  });

  it('asks for an amount above 0 for 0, -1, 10001, 1.234, .5, 1e3 and abc, and takes 0,25 as 0.25 and 10000', () => {
    for (const amount of ['0', '-1', '10001', '1.234', '.5', '1e3', 'abc']) {
      expect(problemsOf(draft({ ingredients: [row(amount, 'g', 'rice')] })), amount).toEqual({
        rows: [{ amount: AMOUNT }],
      });
    }
    expect(amountOf('0,25')).toBe(0.25);
    expect(amountOf('10000')).toBe(10000);
  });

  it('asks for an ingredient for a row with an amount and no name, for at most 40 characters for 41 "a", for another ingredient for "onion " after "Onion", and for both for the amount abc without a name', () => {
    expect(problemsOf(draft({ ingredients: [row('1', 'pc', '')] })), 'no name').toEqual({
      rows: [{ name: INGREDIENT_EMPTY }],
    });
    expect(problemsOf(draft({ ingredients: [row('1', 'g', 'a'.repeat(41))] })), '41 "a"').toEqual({
      rows: [{ name: INGREDIENT_LONG }],
    });
    expect(
      problemsOf(draft({ ingredients: [row('1', 'pc', 'Onion'), row('100', 'g', 'onion ')] })),
      'Onion and onion',
    ).toEqual({ rows: [{}, { name: INGREDIENT_TWICE }] });
    expect(problemsOf(draft({ ingredients: [row('abc', 'g', '')] })), 'abc, no name').toEqual({
      rows: [{ amount: AMOUNT, name: INGREDIENT_EMPTY }],
    });
  });

  it('asks for at least one ingredient when every row is empty after trimming, with no problem on the rows', () => {
    expect(problemsOf(draft({ ingredients: [row('', 'g', ''), row('  ', 'ml', ' ')] }))).toEqual({
      ingredients: NO_INGREDIENT,
      rows: [{}, {}],
    });
  });

  describe('edge cases', () => {
    it('takes a name of 60 characters once its spaces are normalized, and asks for at most 60 characters for 61', () => {
      const sixty = `  ${'a'.repeat(30)}   ${'b'.repeat(29)} `;
      expect(recipeOf(draft({ name: sixty })).name).toBe(`${'a'.repeat(30)} ${'b'.repeat(29)}`);
      const sixtyOne = `  ${'a'.repeat(30)}   ${'b'.repeat(30)} `;
      expect(problemsOf(draft({ name: sixtyOne }))).toEqual({ name: NAME_LONG, rows: [{}] });
    });

    it('asks for another name when its slug is that of an own recipe among the recipes so far', () => {
      const recipes = [...RECIPES, QUICK_DAL];
      for (const name of ['quick dal', 'Quick-Dal!', '  QUICK   DAL ']) {
        expect(problemsOf(draft({ name }), recipes), name).toEqual({
          name: NAME_TAKEN,
          rows: [{}],
        });
      }
    });

    it('asks for a name, not a letter or digit, for a name of only spaces', () => {
      expect(problemsOf(draft({ name: '   ' }))).toEqual({ name: NAME_EMPTY, rows: [{}] });
    });

    it('asks for servings when they are empty or only spaces, and takes " 12 " and "012" as 12', () => {
      for (const servings of ['', '   ']) {
        expect(problemsOf(draft({ servings })), JSON.stringify(servings)).toEqual({
          servings: SERVINGS,
          rows: [{}],
        });
      }
      expect(recipeOf(draft({ servings: ' 12 ' })).servings).toBe(12);
      expect(recipeOf(draft({ servings: '012' })).servings).toBe(12);
    });

    it('asks for an amount above 0 for 10000.01, 0.00, 0,0, "1." and "1,", and takes 10000.00, 0.01 and " 1,5 "', () => {
      for (const amount of ['10000.01', '0.00', '0,0', '1.', '1,']) {
        expect(problemsOf(draft({ ingredients: [row(amount, 'g', 'rice')] })), amount).toEqual({
          rows: [{ amount: AMOUNT }],
        });
      }
      expect(amountOf('10000.00')).toBe(10000);
      expect(amountOf('0.01')).toBe(0.01);
      expect(amountOf(' 1,5 ')).toBe(1.5);
    });

    it('asks for an amount for a row with an ingredient name and an empty or blank amount, rather than ignoring it', () => {
      for (const amount of ['', '   ']) {
        expect(
          problemsOf(draft({ ingredients: [row(amount, 'g', 'rice')] })),
          JSON.stringify(amount),
        ).toEqual({ rows: [{ amount: AMOUNT }] });
      }
    });

    it('takes an ingredient of 40 characters once its spaces are normalized, and asks for at most 40 characters for 41', () => {
      const forty = ` ${'a'.repeat(20)}   ${'b'.repeat(19)}  `;
      expect(recipeOf(draft({ ingredients: [row('1', 'g', forty)] })).ingredients).toEqual([
        { name: `${'a'.repeat(20)} ${'b'.repeat(19)}`, amount: 1, unit: 'g' },
      ]);
      const fortyOne = ` ${'a'.repeat(20)}   ${'b'.repeat(20)}  `;
      expect(problemsOf(draft({ ingredients: [row('1', 'g', fortyOne)] }))).toEqual({
        rows: [{ name: INGREDIENT_LONG }],
      });
    });

    it('finds an ingredient already in the list after normalizing its case and spaces, though the earlier row has another unit and an amount problem', () => {
      expect(
        problemsOf(
          draft({
            ingredients: [row('abc', 'g', 'Canned  Chickpeas'), row('1', 'pc', 'canned chickpeas')],
          }),
        ),
      ).toEqual({ rows: [{ amount: AMOUNT }, { name: INGREDIENT_TWICE }] });
    });

    it('keeps the problems of a row after an ignored empty row at that row, and leaves the ignored row out of the recipe', () => {
      expect(
        problemsOf(
          draft({ ingredients: [row('1', 'g', 'rice'), row('', 'g', ' '), row('0', 'g', 'peas')] }),
        ),
      ).toEqual({ rows: [{}, {}, { amount: AMOUNT }] });
      expect(
        recipeOf(
          draft({ ingredients: [row('1', 'g', 'rice'), row(' ', 'g', ''), row('2', 'pc', 'egg')] }),
        ).ingredients,
      ).toEqual([
        { name: 'rice', amount: 1, unit: 'g' },
        { name: 'egg', amount: 2, unit: 'pc' },
      ]);
    });
  });

  function amountOf(amount: string): number {
    return recipeOf(draft({ ingredients: [row(amount, 'g', 'rice')] })).ingredients[0].amount;
  }

  function recipeOf(recipeDraft: RecipeDraft, recipes: readonly Recipe[] = RECIPES): Recipe {
    const result = checkRecipe(recipeDraft, recipes);
    expect(
      'recipe' in result ? [] : result.problems,
      `problems of ${JSON.stringify(recipeDraft)}`,
    ).toEqual([]);
    return (result as { recipe: Recipe }).recipe;
  }

  function problemsOf(
    recipeDraft: RecipeDraft,
    recipes: readonly Recipe[] = RECIPES,
  ): RecipeProblems {
    const result = checkRecipe(recipeDraft, recipes);
    expect('problems' in result, `no problems found in ${JSON.stringify(recipeDraft)}`).toBe(true);
    return (result as { problems: RecipeProblems }).problems;
  }

  function draft(patch: Partial<RecipeDraft> = {}): RecipeDraft {
    return {
      name: 'Quick Dal',
      servings: '4',
      ingredients: [row('200', 'g', 'canned chickpeas')],
      ...patch,
    };
  }

  function row(amount: string, unit: Unit, name: string): IngredientDraft {
    return { amount, unit, name };
  }
});
