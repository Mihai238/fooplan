import { displayAmount, scaleIngredients } from './amount';
import { Ingredient, Unit } from './recipe';

describe('displayAmount', () => {
  it('shows 15, 30 and 45 ml as 1, 2 and 3 tbsp', () => {
    expect(displayAmount({ amount: 15, unit: 'ml' })).toEqual({ amount: 1, unit: 'tbsp' });
    expect(displayAmount({ amount: 30, unit: 'ml' })).toEqual({ amount: 2, unit: 'tbsp' });
    expect(displayAmount({ amount: 45, unit: 'ml' })).toEqual({ amount: 3, unit: 'tbsp' });
  });

  it('keeps a multiple of 15 ml from 60 ml up in ml instead of showing 4 tbsp or more', () => {
    for (const ml of [60, 75, 90, 120, 900]) {
      expect(displayAmount({ amount: ml, unit: 'ml' }), `${ml} ml`).toEqual({ amount: ml, unit: 'ml' });
    }
  });

  it('keeps a fractional ml amount near the tablespoon amounts in ml instead of showing fractional tbsp', () => {
    for (const ml of [7.5, 22.5, 37.5, 15.5, 14.5]) {
      expect(displayAmount({ amount: ml, unit: 'ml' }), `${ml} ml`).toEqual({ amount: ml, unit: 'ml' });
    }
  });

  it('shows 5 and 10 ml as 1 and 2 tsp', () => {
    expect(displayAmount({ amount: 5, unit: 'ml' })).toEqual({ amount: 1, unit: 'tsp' });
    expect(displayAmount({ amount: 10, unit: 'ml' })).toEqual({ amount: 2, unit: 'tsp' });
  });

  it('keeps a fractional ml amount near the teaspoon amounts in ml instead of showing fractional tsp', () => {
    for (const ml of [2.5, 4.5, 5.5, 9.9]) {
      expect(displayAmount({ amount: ml, unit: 'ml' }), `${ml} ml`).toEqual({ amount: ml, unit: 'ml' });
    }
  });

  it('keeps 60 ml and more, and ml amounts that are not spoon amounts like 50 and 20 ml, in ml', () => {
    for (const ml of [60, 61, 100, 900, 1500, 50, 20]) {
      expect(displayAmount({ amount: ml, unit: 'ml' }), `${ml} ml`).toEqual({ amount: ml, unit: 'ml' });
    }
  });

  it('keeps the other multiples of 5 ml below 60 ml (20, 25, 35, 40, 50, 55 ml) in ml', () => {
    for (const ml of [20, 25, 35, 40, 50, 55]) {
      expect(displayAmount({ amount: ml, unit: 'ml' }), `${ml} ml`).toEqual({ amount: ml, unit: 'ml' });
    }
  });

  it('keeps whole ml amounts next to the spoon amounts and just below 60 ml in ml', () => {
    for (const ml of [1, 4, 6, 9, 11, 14, 16, 29, 31, 44, 46, 59]) {
      expect(displayAmount({ amount: ml, unit: 'ml' }), `${ml} ml`).toEqual({ amount: ml, unit: 'ml' });
    }
  });

  it('keeps 0 ml in ml', () => {
    expect(displayAmount({ amount: 0, unit: 'ml' })).toEqual({ amount: 0, unit: 'ml' });
  });

  it('shows amounts stored in tsp, tbsp, g and pc unchanged', () => {
    const stored: [number, Unit][] = [
      [1, 'tsp'],
      [0.25, 'tsp'],
      [2, 'tbsp'],
      [0.5, 'tbsp'],
      [400, 'g'],
      [2, 'pc'],
    ];
    for (const [amount, unit] of stored) {
      expect(displayAmount({ amount, unit }), `${amount} ${unit}`).toEqual({ amount, unit });
    }
  });

  it('does not convert spoon-sized amounts in g or pc, nor 3 tsp to 1 tbsp or 4 tbsp and more to ml', () => {
    const stored: [number, Unit][] = [
      [5, 'g'],
      [10, 'g'],
      [15, 'g'],
      [30, 'g'],
      [45, 'g'],
      [15, 'pc'],
      [3, 'tsp'],
      [6, 'tsp'],
      [4, 'tbsp'],
      [10, 'tbsp'],
    ];
    for (const [amount, unit] of stored) {
      expect(displayAmount({ amount, unit }), `${amount} ${unit}`).toEqual({ amount, unit });
    }
  });
});

describe('scaleIngredients', () => {
  const INGREDIENTS: Ingredient[] = [
    { name: 'onion', amount: 1, unit: 'pc' },
    { name: 'rice', amount: 150, unit: 'g' },
    { name: 'oil', amount: 10, unit: 'ml' },
  ];

  it('multiplies 1 pc onion, 150 g rice and 10 ml oil by 1.5 into 1.5 pc, 225 g and 15 ml with the names and units unchanged, rounds 1 pc by 2/3 to 0.67 pc, keeps the amounts at the factor 1 and returns [] for [] (#55 1)', () => {
    expect(scaleIngredients(INGREDIENTS, 1.5)).toEqual([
      { name: 'onion', amount: 1.5, unit: 'pc' },
      { name: 'rice', amount: 225, unit: 'g' },
      { name: 'oil', amount: 15, unit: 'ml' },
    ]);
    expect(scaleIngredients([{ name: 'onion', amount: 1, unit: 'pc' }], 2 / 3)).toEqual([
      { name: 'onion', amount: 0.67, unit: 'pc' },
    ]);
    expect(scaleIngredients(INGREDIENTS, 1)).toEqual(INGREDIENTS);
    expect(scaleIngredients([], 1.5)).toEqual([]);
  });

  describe('edge cases', () => {
    it('leaves the given list and its ingredients unchanged, returning new ones (#55 1a)', () => {
      const given = INGREDIENTS.map((ingredient) => ({ ...ingredient }));
      const scaled = scaleIngredients(given, 0.75);
      expect(given).toEqual(INGREDIENTS);
      expect(scaled).not.toBe(given);
      expect(scaled.map((ingredient) => ingredient.amount)).toEqual([0.75, 112.5, 7.5]);
    });
  });
});
