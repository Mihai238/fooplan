import {
  forget,
  MAX_RECENT,
  MAX_SUGGESTED,
  parseRecentItems,
  remember,
  suggestions,
} from './recent-items';

const THIRTY = Array.from({ length: MAX_RECENT }, (_, i) => `item ${i + 1}`);

describe('remember', () => {
  it('puts the trimmed text first, drops an earlier entry equal to it ignoring case so the latest spelling wins, keeps 30 with the oldest gone, and returns the same array for a blank text', () => {
    expect(remember(['milk', 'coffee'], 'toilet paper')).toEqual([
      'toilet paper',
      'milk',
      'coffee',
    ]);
    expect(remember(['milk', 'coffee'], 'Coffee')).toEqual(['Coffee', 'milk']);
    expect(remember(['milk', 'coffee'], '  tea ')).toEqual(['tea', 'milk', 'coffee']);

    const kept = remember(THIRTY, 'new item');
    expect(kept).toHaveLength(MAX_RECENT);
    expect(kept).toEqual(['new item', ...THIRTY.slice(0, MAX_RECENT - 1)]);

    const items = ['milk', 'coffee'];
    expect(remember(items, ''), 'empty text').toBe(items);
    expect(remember(items, '   '), 'only spaces').toBe(items);
  });

  describe('edge cases', () => {
    it('leaves the given array as it is', () => {
      const items = ['milk', 'coffee'];
      remember(items, 'tea');
      remember(items, 'COFFEE');
      expect(items).toEqual(['milk', 'coffee']);
    });

    it('moves the oldest of 30 to the front without dropping another one', () => {
      const oldest = THIRTY.at(-1)!;
      expect(remember(THIRTY, oldest.toUpperCase())).toEqual([
        oldest.toUpperCase(),
        ...THIRTY.slice(0, MAX_RECENT - 1),
      ]);
    });

    it('returns the same array when the text is already first as typed, and a new one when only its case differs', () => {
      const items = ['milk', 'coffee'];
      expect(remember(items, ' milk ')).toBe(items);
      expect(remember(items, 'Milk')).toEqual(['Milk', 'coffee']);
    });

    it('cuts a list of 31 to 30 also when the text is already first', () => {
      const thirtyOne = [...THIRTY, 'item 31'];
      expect(remember(thirtyOne, 'item 1')).toEqual(THIRTY);
    });

    it('keeps the inner spaces and the case of the text', () => {
      expect(remember([], ' Toilet  Paper ')).toEqual(['Toilet  Paper']);
    });
  });
});

describe('forget', () => {
  it('drops the entry equal to the text ignoring case, and returns the same array when none is', () => {
    expect(forget(['Milk', 'coffee'], 'milk')).toEqual(['coffee']);
    const items = ['milk'];
    expect(forget(items, 'tea')).toBe(items);
  });

  describe('edge cases', () => {
    it('drops every entry equal to the text ignoring case and leaves the given array as it is', () => {
      const items = ['Milk', 'coffee', 'MILK'];
      expect(forget(items, 'milk')).toEqual(['coffee']);
      expect(items).toEqual(['Milk', 'coffee', 'MILK']);
    });

    it('returns the same empty array for an empty list', () => {
      const items: string[] = [];
      expect(forget(items, 'milk')).toBe(items);
    });
  });
});

describe('parseRecentItems', () => {
  it('reads a list of strings in order, trimmed, without blanks and later duplicates ignoring case, cut to 30, and anything else as []', () => {
    expect(parseRecentItems(['toilet paper', ' Milk ', 'milk', '', 'coffee'])).toEqual([
      'toilet paper',
      'Milk',
      'coffee',
    ]);
    for (const value of [null, 'milk', {}, ['milk', 3]]) {
      expect(parseRecentItems(value), JSON.stringify(value)).toEqual([]);
    }
    const thirtyOne = [...THIRTY, 'item 31'];
    expect(parseRecentItems(thirtyOne)).toEqual(THIRTY);
  });

  describe('edge cases', () => {
    it('reads undefined, a number, an array holding null and an array holding a list as []', () => {
      for (const value of [undefined, 3, ['milk', null], ['milk', ['coffee']]]) {
        expect(parseRecentItems(value), String(JSON.stringify(value))).toEqual([]);
      }
    });

    it('drops an entry of only spaces', () => {
      expect(parseRecentItems(['milk', '   ', 'coffee'])).toEqual(['milk', 'coffee']);
    });

    it('drops the duplicates before cutting to 30, so 31 strings with one duplicate give 30', () => {
      const withDuplicate = [THIRTY[0], THIRTY[0].toUpperCase(), ...THIRTY.slice(1)];
      expect(withDuplicate).toHaveLength(MAX_RECENT + 1);
      expect(parseRecentItems(withDuplicate)).toEqual(THIRTY);
    });

    it('reads the first 30 distinct items of a list of 10000 with duplicates up front, and a list of 10000 ending in a number as []', () => {
      const long = [
        ...Array.from({ length: 40 }, (_, i) => (i % 2 === 0 ? 'milk' : ' MILK ')),
        ...Array.from({ length: 9960 }, (_, i) => `item ${i + 1}`),
      ];
      expect(parseRecentItems(long)).toEqual(['milk', ...THIRTY.slice(0, MAX_RECENT - 1)]);
      expect(parseRecentItems([...long.slice(1), 3])).toEqual([]);
    });

    it('reads an empty list as []', () => {
      expect(parseRecentItems([])).toEqual([]);
    });
  });
});

describe('suggestions', () => {
  const REMEMBERED = ['Toilet paper', 'milk', 'coffee', 'Crème fraîche'];

  it('suggests the remembered items not on the list that contain the trimmed text, ignoring case and accents, the first 5 in remembered order, and nothing for a blank text', () => {
    expect(suggestions(REMEMBERED, ['milk'], 'paper')).toEqual(['Toilet paper']);
    expect(suggestions(REMEMBERED, ['milk'], ' paper ')).toEqual(['Toilet paper']);
    expect(suggestions(REMEMBERED, ['milk'], 'creme')).toEqual(['Crème fraîche']);
    expect(suggestions(REMEMBERED, ['milk'], ' MI '), 'on the list').toEqual([]);
    expect(suggestions(REMEMBERED, ['milk'], ''), 'empty text').toEqual([]);
    expect(suggestions(REMEMBERED, ['milk'], '  '), 'only spaces').toEqual([]);

    const seven = ['tea', 'bananas', 'oats', 'pasta', 'carrots', 'salami', 'apples'];
    expect(MAX_SUGGESTED).toBe(5);
    expect(suggestions(seven, [], 'a')).toEqual(seven.slice(0, MAX_SUGGESTED));
  });

  describe('edge cases', () => {
    it('ignores accents and case in the typed text, and case in the items on the list: "CRÈME" suggests "Crème fraîche", and "MILK" on the list keeps "milk" out', () => {
      expect(suggestions(REMEMBERED, [], 'CRÈME')).toEqual(['Crème fraîche']);
      expect(suggestions(REMEMBERED, ['MILK'], 'mi')).toEqual([]);
    });

    it('suggests all of exactly 5 matches, a match in the middle of an item, and nothing without remembered items', () => {
      const five = ['tea', 'bananas', 'oats', 'pasta', 'salami'];
      expect(suggestions([...five, 'flour'], [], 'a')).toEqual(five);
      expect(suggestions(REMEMBERED, [], 'let')).toEqual(['Toilet paper']);
      expect(suggestions([], [], 'milk')).toEqual([]);
    });
  });
});
