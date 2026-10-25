import { MESSAGES } from '../i18n';
import type { Language } from '../language-store';
import { displayAmount } from './amount';
import { Ingredient, Recipe, Unit } from './recipe';
import { RECIPES } from './recipes';
import german from './recipes.de.json';
import { containsWord, StepPart, stepParts, wordPattern } from './step-amounts';

const GERMAN_STEPS = new Map<string, string[]>(
  Object.entries(german.recipes).map(([name, recipe]) => [name, recipe.steps]),
);
const GERMAN_INGREDIENTS = new Map<string, string>(Object.entries(german.ingredients));

describe('containsWord', () => {
  it('finds in German "Zwiebeln" for Zwiebel, "Eiern" for Ei, "roten Zwiebeln" for rote Zwiebel, "grünen Bohnen" for grüne Bohnen, "Avocados" for Avocado and "Thai-Basilikum", but not Zwiebel in "Zwiebelringe", Ei in "Eiernudeln" or Tomate in "Tomatenmark" and "Dosentomaten"; and in English "onions" for onion but not "Zwiebeln" for Zwiebel', () => {
    for (const [text, name] of [
      ['die Zwiebeln', 'Zwiebel'],
      ['mit den Eiern', 'Ei'],
      ['die roten Zwiebeln', 'rote Zwiebel'],
      ['die grünen Bohnen', 'grüne Bohnen'],
      ['Avocados halbieren', 'Avocado'],
      ['das Thai-Basilikum', 'Thai-Basilikum'],
    ]) {
      expect(containsWord(text, name, 'de'), `"${name}" in "${text}"`).toBe(true);
    }
    for (const [text, name] of [
      ['Zwiebelringe', 'Zwiebel'],
      ['Eiernudeln', 'Ei'],
      ['Tomatenmark', 'Tomate'],
      ['Dosentomaten', 'Tomate'],
    ]) {
      expect(containsWord(text, name, 'de'), `"${name}" in "${text}"`).toBe(false);
    }
    expect(containsWord('the onions', 'onion', 'en'), '"onion" in English').toBe(true);
    expect(containsWord('Zwiebeln', 'Zwiebel', 'en'), '"Zwiebel" in English').toBe(false);
  });

  describe('edge cases', () => {
    it('separates the words of a German name as the name does, finding "Thai-Basilikums" and "roten Zwiebeln" but not "Thai Basilikum" for Thai-Basilikum or "rote-Zwiebel" for rote Zwiebel', () => {
      expect(containsWord('des Thai-Basilikums', 'Thai-Basilikum', 'de')).toBe(true);
      expect(containsWord('die roten Zwiebeln', 'rote Zwiebel', 'de')).toBe(true);
      expect(containsWord('das Thai Basilikum', 'Thai-Basilikum', 'de')).toBe(false);
      expect(containsWord('die rote-Zwiebel', 'rote Zwiebel', 'de')).toBe(false);
    });

    it('allows at most one ending per word of a German name: "Eier" and "Zwiebeln" but not "Eiers", "Zwiebelns" or "rotenen Zwiebeln"', () => {
      expect(containsWord('die Eier', 'Ei', 'de')).toBe(true);
      expect(containsWord('die Zwiebeln', 'Zwiebel', 'de')).toBe(true);
      expect(containsWord('des Eiers', 'Ei', 'de')).toBe(false);
      expect(containsWord('der Zwiebelns', 'Zwiebel', 'de')).toBe(false);
      expect(containsWord('die rotenen Zwiebeln', 'rote Zwiebel', 'de')).toBe(false);
    });

    it('ignores case in German: "ZWIEBELN" and "die zwiebeln" for Zwiebel, "Rote Zwiebeln" for rote Zwiebel', () => {
      expect(containsWord('ZWIEBELN schneiden', 'Zwiebel', 'de')).toBe(true);
      expect(containsWord('die zwiebeln', 'Zwiebel', 'de')).toBe(true);
      expect(containsWord('Rote Zwiebeln schneiden', 'rote Zwiebel', 'de')).toBe(true);
    });

    it('never takes the article "ein" for Ei, in any case, but still finds "Ei" next to it', () => {
      expect(containsWord('in jede ein Ei schlagen', 'Ei', 'de')).toBe(true);
      expect(containsWord('Ein Drittel des Öls', 'Ei', 'de')).toBe(false);
      expect(containsWord('in jede ein Stück', 'Ei', 'de')).toBe(false);
      expect(containsWord('EIN Drittel', 'Ei', 'de')).toBe(false);
    });
  });
});

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

  it('writes each amount with the given showAmount, in parentheses, passing it the ingredient as stored', () => {
    const shown: unknown[] = [];
    const showAmount = (item: { amount: number; unit: Unit }) => {
      shown.push(item);
      return `${item.amount} ${item.unit}!`;
    };
    expect(
      stepParts('Fry the onion in the oil.', [I('onion', 2, 'pc'), I('oil', 15, 'ml')], showAmount),
    ).toEqual([
      { text: 'Fry the onion' },
      { amount: '(2 pc!)' },
      { text: ' in the oil' },
      { amount: '(15 ml!)' },
      { text: '.' },
    ]);
    expect(shown).toEqual([I('onion', 2, 'pc'), I('oil', 15, 'ml')]);
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

  it('puts the German amounts "(2 Stk.)", "(0,5 Stk.)" and "(3 EL)" after "Die Knoblauchzehen", "rote Zwiebel" and "Olivenöl" in German steps, finding the German names of garlic clove, red onion and olive oil', () => {
    expect(
      stepParts(
        'Die Knoblauchzehen schälen und in dünne Scheiben schneiden.',
        [I('garlic clove', 2, 'pc')],
        'de',
      ),
    ).toEqual([
      { text: 'Die Knoblauchzehen' },
      { amount: '(2 Stk.)' },
      { text: ' schälen und in dünne Scheiben schneiden.' },
    ]);
    expect(
      stepParts(
        'Die rote Zwiebel in dünne Halbringe schneiden.',
        [I('red onion', 0.5, 'pc')],
        'de',
      ),
    ).toEqual([
      { text: 'Die rote Zwiebel' },
      { amount: '(0,5 Stk.)' },
      { text: ' in dünne Halbringe schneiden.' },
    ]);
    expect(
      stepParts('Das Olivenöl über den Salat träufeln.', [I('olive oil', 45, 'ml')], 'de'),
    ).toEqual([
      { text: 'Das Olivenöl' },
      { amount: '(3 EL)' },
      { text: ' über den Salat träufeln.' },
    ]);
  });

  it('joins the text parts of every German step of the built-in recipes back to the step text, and gives every ingredient of a recipe its German amount after a mention of its German name in at least one of its German steps', () => {
    expect(RECIPES.length, 'no recipes loaded').toBeGreaterThan(0);
    const changed: string[] = [];
    const withoutAmount: string[] = [];
    for (const recipe of RECIPES) {
      const steps = GERMAN_STEPS.get(recipe.name) ?? [];
      expect(steps.length, `"${recipe.name}": German steps`).toBeGreaterThan(0);
      const parts = steps.map((step) => stepParts(step, recipe.ingredients, 'de'));
      parts.forEach((stepPartsOfStep, index) => {
        if (textOf(stepPartsOfStep) !== steps[index]) {
          changed.push(`"${recipe.name}" step ${index + 1}: "${textOf(stepPartsOfStep)}"`);
        }
      });
      for (const ingredient of recipe.ingredients) {
        if (
          !parts.some((step) => hasAmountAfterMention(step, ingredient, recipe.ingredients, 'de'))
        ) {
          withoutAmount.push(`"${recipe.name}": "${nameIn(ingredient, 'de')}"`);
        }
      }
    }
    expect(changed, 'text parts differing from the German step').toEqual([]);
    expect(withoutAmount, 'ingredients without an amount in any German step').toEqual([]);
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

  describe('edge cases in German (#37)', () => {
    it('gives "Thai-Basilikum" the Thai basil\'s amount before "Basilikum" could claim its second word, and lets basil go on to a mention of its own, whichever of the two is listed first', () => {
      const basil = I('basil', 10, 'g');
      const thaiBasil = I('thai basil', 5, 'g');
      for (const ingredients of [
        [basil, thaiBasil],
        [thaiBasil, basil],
      ]) {
        expect(
          stepParts('Das Thai-Basilikum und das Basilikum zupfen.', ingredients, 'de'),
        ).toEqual([
          { text: 'Das Thai-Basilikum' },
          { amount: '(5 g)' },
          { text: ' und das Basilikum' },
          { amount: '(10 g)' },
          { text: ' zupfen.' },
        ]);
      }
    });

    it('never gives "Dosentomaten" the tomato\'s amount: alone it gets none, and next to canned tomatoes it gets theirs while tomato goes on to "Tomaten"', () => {
      const tomato = I('tomato', 3, 'pc');
      expect(stepParts('Die Dosentomaten zerdrücken.', [tomato], 'de')).toEqual([
        { text: 'Die Dosentomaten zerdrücken.' },
      ]);
      expect(
        stepParts(
          'Die Dosentomaten und die Tomaten verrühren.',
          [tomato, I('canned tomatoes', 400, 'g')],
          'de',
        ),
      ).toEqual([
        { text: 'Die Dosentomaten' },
        { amount: '(400 g)' },
        { text: ' und die Tomaten' },
        { amount: '(3 Stk.)' },
        { text: ' verrühren.' },
      ]);
    });

    it('matches a capitalised "Rote Zwiebeln" at the start of a German step, keeping its capital in the text, and lets onion go on to "Zwiebel"', () => {
      expect(
        stepParts(
          'Rote Zwiebeln in Ringe schneiden, dann die Zwiebel hacken.',
          [I('onion', 1, 'pc'), I('red onion', 0.5, 'pc')],
          'de',
        ),
      ).toEqual([
        { text: 'Rote Zwiebeln' },
        { amount: '(0,5 Stk.)' },
        { text: ' in Ringe schneiden, dann die Zwiebel' },
        { amount: '(1 Stk.)' },
        { text: ' hacken.' },
      ]);
    });

    it('puts the egg\'s amount after "Ei", not after the article "ein", in Shakshuka step 5, and gives "Ein Drittel" in potato pancakes step 3 none', () => {
      const shakshuka = builtInRecipe('Shakshuka with bread');
      expect(stepParts(germanStep(shakshuka, 5), shakshuka.ingredients, 'de')).toEqual([
        { text: 'Mit einem Löffel 4 Mulden in die Sauce drücken und in jede ein Ei' },
        { amount: '(4 Stk.)' },
        { text: ' schlagen.' },
      ]);
      const pancakes = builtInRecipe('Potato pancakes with sour cream');
      const step = germanStep(pancakes, 3);
      expect(stepParts(step, pancakes.ingredients, 'de')).toEqual([
        { text: 'Ein Drittel des Pflanzenöls' },
        { amount: '(90 ml)' },
        { text: step.slice('Ein Drittel des Pflanzenöls'.length) },
      ]);
    });
  });

  function I(name: string, amount: number, unit: Unit): Ingredient {
    return { name, amount, unit };
  }

  function builtInRecipe(name: string): Recipe {
    const recipe = RECIPES.find((candidate) => candidate.name === name);
    expect(recipe, `built-in recipe "${name}"`).toBeDefined();
    return recipe!;
  }

  function germanStep(recipe: Recipe, step: number): string {
    const text = GERMAN_STEPS.get(recipe.name)?.[step - 1];
    expect(text, `German step ${step} of "${recipe.name}"`).toBeDefined();
    return text!;
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
    language: Language = 'en',
  ): boolean {
    const name = nameIn(ingredient, language);
    const longer = ingredients
      .map((other) => nameIn(other, language))
      .filter((other) => other.length > name.length);
    return parts.some((part, index) => {
      const before = parts[index - 1];
      return (
        'amount' in part &&
        part.amount === `(${amountIn(ingredient, language)})` &&
        before !== undefined &&
        'text' in before &&
        endsWithMention(before.text, name, language) &&
        !longer.some((other) => endsWithMention(before.text, other, language))
      );
    });
  }

  function nameIn(ingredient: Ingredient, language: Language): string {
    return (language === 'de' && GERMAN_INGREDIENTS.get(ingredient.name)) || ingredient.name;
  }

  function amountIn(ingredient: Ingredient, language: Language): string {
    const shown = displayAmount(ingredient);
    if (language === 'en') {
      return `${shown.amount} ${shown.unit}`;
    }
    return `${String(shown.amount).replace('.', ',')} ${MESSAGES.de[`unit.${shown.unit}`]}`;
  }

  function endsWithMention(text: string, name: string, language: Language = 'en'): boolean {
    return new RegExp(`(?:${wordPattern(name, 'u', language).source})$`, 'iu').test(text);
  }
});
