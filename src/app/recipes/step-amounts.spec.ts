import { displayAmount } from './amount';
import { Ingredient, Unit } from './recipe';
import { RECIPES } from './recipes';
import { StepPart, stepParts, wordPattern } from './step-amounts';

describe('stepParts', () => {
  it('puts the amount right after the first mention of an ingredient, as "(2 pc)" and "(400 g)", in parts that join back to the step text', () => {
    expect(
      stepParts('Peel and thinly slice the garlic cloves.', [
        I('garlic clove', 2, 'pc'),
        I('spaghetti', 200, 'g'),
      ]),
    ).toEqual([
      { text: 'Peel and thinly slice the garlic cloves' },
      { amount: '(2 pc)' },
      { text: '.' },
    ]);
    expect(
      stepParts('Add the canned tomatoes, crush them and simmer.', [
        I('canned tomatoes', 400, 'g'),
      ]),
    ).toEqual([
      { text: 'Add the canned tomatoes' },
      { amount: '(400 g)' },
      { text: ', crush them and simmer.' },
    ]);
  });

  it('gives "red onions" the red onion\'s amount and lets "onion" go on to a mention of its own, and gives "spring onions" the onion\'s amount when only onion is listed', () => {
    expect(
      stepParts('Slice the red onions and the onion.', [
        I('onion', 1, 'pc'),
        I('red onion', 0.5, 'pc'),
      ]),
    ).toEqual([
      { text: 'Slice the red onions' },
      { amount: '(0.5 pc)' },
      { text: ' and the onion' },
      { amount: '(1 pc)' },
      { text: '.' },
    ]);
    expect(stepParts('Slice the spring onions.', [I('onion', 1, 'pc')])).toEqual([
      { text: 'Slice the spring onions' },
      { amount: '(1 pc)' },
      { text: '.' },
    ]);
  });

  it('gives a name mentioned twice its amount once, after its first mention, matches "Onions" at the start of a step, and gives nothing to a name inside another word or to salt, pepper, water and sauce', () => {
    const onion = I('onion', 1, 'pc');
    expect(stepParts('Stir the onion, then add the onion again.', [onion])).toEqual([
      { text: 'Stir the onion' },
      { amount: '(1 pc)' },
      { text: ', then add the onion again.' },
    ]);
    expect(stepParts('Onions go in first.', [onion])).toEqual([
      { text: 'Onions' },
      { amount: '(1 pc)' },
      { text: ' go in first.' },
    ]);
    expect(stepParts('Bring to the boil.', [I('oil', 15, 'ml')])).toEqual([
      { text: 'Bring to the boil.' },
    ]);
    const ingredients = [onion, I('spaghetti', 200, 'g'), I('olive oil', 15, 'ml')];
    for (const text of ['Season with salt and pepper.', 'Pour the water into the sauce.']) {
      expect(stepParts(text, ingredients), text).toEqual([{ text }]);
    }
  });

  it('shows the amount as displayAmount does: 15 ml olive oil as "(1 tbsp)", 100 ml cream, 0.5 pc red onion, and 2 pc bay leaf and 4 pc anchovy after their plurals', () => {
    for (const [text, ingredient, mention, amount] of [
      ['Drizzle the olive oil.', I('olive oil', 15, 'ml'), 'Drizzle the olive oil', '(1 tbsp)'],
      ['Stir in the cream.', I('cream', 100, 'ml'), 'Stir in the cream', '(100 ml)'],
      ['Slice the red onion.', I('red onion', 0.5, 'pc'), 'Slice the red onion', '(0.5 pc)'],
      ['Add the bay leaves.', I('bay leaf', 2, 'pc'), 'Add the bay leaves', '(2 pc)'],
      ['Chop the anchovies.', I('anchovy', 4, 'pc'), 'Chop the anchovies', '(4 pc)'],
    ] as const) {
      expect(stepParts(text, [ingredient]), text).toEqual([
        { text: mention },
        { amount },
        { text: '.' },
      ]);
    }
  });

  it('joins the text parts of every step of the 44 built-in recipes back to the step text, and gives every ingredient of a recipe its amount after a mention in at least one of its steps', () => {
    expect(RECIPES.length, 'no recipes loaded').toBeGreaterThan(0);
    const changed: string[] = [];
    const withoutAmount: string[] = [];
    for (const recipe of RECIPES) {
      const steps = recipe.steps ?? [];
      expect(steps.length, `"${recipe.name}": steps`).toBeGreaterThan(0);
      const parts = steps.map((step) => stepParts(step, recipe.ingredients));
      parts.forEach((stepPartsOfStep, index) => {
        if (textOf(stepPartsOfStep) !== steps[index]) {
          changed.push(`"${recipe.name}" step ${index + 1}: "${textOf(stepPartsOfStep)}"`);
        }
      });
      for (const ingredient of recipe.ingredients) {
        if (!parts.some((step) => hasAmountAfterMention(step, ingredient, recipe.ingredients))) {
          withoutAmount.push(`"${recipe.name}": "${ingredient.name}"`);
        }
      }
    }
    expect(changed, 'text parts differing from the step').toEqual([]);
    expect(withoutAmount, 'ingredients without an amount in any step').toEqual([]);
  });

  describe('edge cases', () => {
    it('puts the amount before a semicolon, colon, exclamation mark, question mark or closing parenthesis right after the mention', () => {
      const onion = I('onion', 1, 'pc');
      for (const mark of [';', ':', '!', '?', ')']) {
        const text = `Fry the onion${mark} stir.`;
        expect(stepParts(text, [onion]), text).toEqual([
          { text: 'Fry the onion' },
          { amount: '(1 pc)' },
          { text: `${mark} stir.` },
        ]);
      }
    });

    it('gives "onion" nothing when its only mention is inside a claimed "red onion", whichever of the two is listed first', () => {
      const onion = I('onion', 1, 'pc');
      const redOnion = I('red onion', 0.5, 'pc');
      for (const ingredients of [
        [onion, redOnion],
        [redOnion, onion],
      ]) {
        expect(stepParts('Slice the red onion.', ingredients)).toEqual([
          { text: 'Slice the red onion' },
          { amount: '(0.5 pc)' },
          { text: '.' },
        ]);
      }
    });

    it('lets the first listed of two names of the same length claim the words they share, leaving the other without an amount', () => {
      const chiliOil = I('chili oil', 2, 'tbsp');
      const hotChili = I('hot chili', 1, 'pc');
      expect(stepParts('Drizzle the hot chili oil.', [chiliOil, hotChili])).toEqual([
        { text: 'Drizzle the hot chili oil' },
        { amount: '(2 tbsp)' },
        { text: '.' },
      ]);
      expect(stepParts('Drizzle the hot chili oil.', [hotChili, chiliOil])).toEqual([
        { text: 'Drizzle the hot chili' },
        { amount: '(1 pc)' },
        { text: ' oil.' },
      ]);
    });

    it('skips a name inside another word, as in "boil", "peanuts" and "eggplant", and puts the amount after a later mention of its own', () => {
      expect(stepParts('Bring to the boil, then add the oil.', [I('oil', 15, 'ml')])).toEqual([
        { text: 'Bring to the boil, then add the oil' },
        { amount: '(1 tbsp)' },
        { text: '.' },
      ]);
      expect(stepParts('Add the peanuts and the peas.', [I('pea', 100, 'g')])).toEqual([
        { text: 'Add the peanuts and the peas' },
        { amount: '(100 g)' },
        { text: '.' },
      ]);
      expect(stepParts('Fry the eggplant with the egg.', [I('egg', 2, 'pc')])).toEqual([
        { text: 'Fry the eggplant with the egg' },
        { amount: '(2 pc)' },
        { text: '.' },
      ]);
    });

    it('matches a capitalised "Red onions" at the start of a step, keeping its capital in the text, and lets "onion" go on to its own mention', () => {
      expect(
        stepParts('Red onions go in first, then the onion.', [
          I('onion', 1, 'pc'),
          I('red onion', 0.5, 'pc'),
        ]),
      ).toEqual([
        { text: 'Red onions' },
        { amount: '(0.5 pc)' },
        { text: ' go in first, then the onion' },
        { amount: '(1 pc)' },
        { text: '.' },
      ]);
    });

    it('shows 5 and 10 ml as "(1 tsp)" and "(2 tsp)", 30 and 45 ml as "(2 tbsp)" and "(3 tbsp)", amounts in tsp and tbsp as they are, and 60 and 7.5 ml in ml', () => {
      for (const [ingredient, amount] of [
        [I('vegetable oil', 5, 'ml'), '(1 tsp)'],
        [I('vegetable oil', 10, 'ml'), '(2 tsp)'],
        [I('vegetable oil', 30, 'ml'), '(2 tbsp)'],
        [I('vegetable oil', 45, 'ml'), '(3 tbsp)'],
        [I('vegetable oil', 60, 'ml'), '(60 ml)'],
        [I('vegetable oil', 7.5, 'ml'), '(7.5 ml)'],
        [I('vegetable oil', 1, 'tsp'), '(1 tsp)'],
        [I('vegetable oil', 2, 'tbsp'), '(2 tbsp)'],
      ] as const) {
        expect(
          stepParts('Heat the vegetable oil.', [ingredient]),
          `${ingredient.amount} ${ingredient.unit}`,
        ).toEqual([{ text: 'Heat the vegetable oil' }, { amount }, { text: '.' }]);
      }
    });
  });

  function I(name: string, amount: number, unit: Unit): Ingredient {
    return { name, amount, unit };
  }

  function textOf(parts: StepPart[]): string {
    return parts.map((part) => ('text' in part ? part.text : '')).join('');
  }

  // An amount after a mention that a longer name also ends at ("red onion" for onion) may be the
  // longer name's, even when the two amounts are equal, so it doesn't count: the check can fail on
  // a step naming the longer one twice, never pass for an ingredient that got no amount
  function hasAmountAfterMention(
    parts: StepPart[],
    ingredient: Ingredient,
    ingredients: readonly Ingredient[],
  ): boolean {
    const shown = displayAmount(ingredient);
    const longer = ingredients.filter((other) => other.name.length > ingredient.name.length);
    return parts.some((part, index) => {
      const before = parts[index - 1];
      return (
        'amount' in part &&
        part.amount === `(${shown.amount} ${shown.unit})` &&
        before !== undefined &&
        'text' in before &&
        endsWithMention(before.text, ingredient.name) &&
        !longer.some((other) => endsWithMention(before.text, other.name))
      );
    });
  }

  function endsWithMention(text: string, name: string): boolean {
    return new RegExp(`(?:${wordPattern(name, 'u').source})$`, 'iu').test(text);
  }
});
