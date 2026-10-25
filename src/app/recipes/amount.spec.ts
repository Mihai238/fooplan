import { displayAmount } from './amount';
import { Unit } from './recipe';

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
