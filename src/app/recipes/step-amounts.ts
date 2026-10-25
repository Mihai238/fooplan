import { Amount, displayAmount } from './amount';
import { Ingredient } from './recipe';

export type StepPart = { text: string } | { amount: string };

interface Mention {
  start: number;
  end: number;
  amount: string;
}

// Longest names first, so "red onions" goes to red onion before onion could claim its "onions".
// showAmount writes an amount in the page's language; without it, it reads as stored ("2 pc")
export function stepParts(
  text: string,
  ingredients: readonly Ingredient[],
  showAmount: (item: Amount) => string = storedAmount,
): StepPart[] {
  const mentions: Mention[] = [];
  const longestFirst = [...ingredients].sort((a, b) => b.name.length - a.name.length);
  for (const ingredient of longestFirst) {
    const mention = firstFreeMention(text, ingredient.name, mentions);
    if (mention) {
      mentions.push({ ...mention, amount: `(${showAmount(ingredient)})` });
    }
  }
  mentions.sort((a, b) => a.start - b.start);
  const parts: StepPart[] = [];
  let from = 0;
  for (const mention of mentions) {
    parts.push({ text: text.slice(from, mention.end) }, { amount: mention.amount });
    from = mention.end;
  }
  if (from < text.length || parts.length === 0) {
    parts.push({ text: text.slice(from) });
  }
  return parts;
}

function storedAmount(item: Amount): string {
  const shown = displayAmount(item);
  return `${shown.amount} ${shown.unit}`;
}

function firstFreeMention(
  text: string,
  name: string,
  claimed: readonly Mention[],
): Pick<Mention, 'start' | 'end'> | undefined {
  for (const match of text.matchAll(wordPattern(name, 'giu'))) {
    const start = match.index;
    const end = start + match[0].length;
    if (claimed.every((other) => end <= other.start || start >= other.end)) {
      return { start, end };
    }
  }
  return undefined;
}

export function containsWord(text: string, name: string): boolean {
  return wordPattern(name, 'u').test(text);
}

// \b only knows ASCII letters, and names like "gruyère" have others. The plural endings let
// "onions", "tomatoes", "anchovies" and "leaves" name their ingredient. f→ves only after a, l or r,
// since "beef" has no "beeves"
export function wordPattern(name: string, flags: string): RegExp {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const irregular = escaped.replace(/(?<=[^aeiou])y$/, 'ies').replace(/(?<=[alr])f$/, 'ves');
  const plurals = irregular === escaped ? '(?:e?s)?' : `(?:e?s)?|${irregular}`;
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${escaped}${plurals})(?![\\p{L}\\p{N}])`, flags);
}
