import type { Language } from '../language-store';
import { Amount, formatAmount } from './amount';
import { ingredientNameIn } from './german-names';
import { Ingredient } from './recipe';

export type StepPart = { text: string } | { amount: string };

interface Mention {
  start: number;
  end: number;
  amount: string;
}

const GERMAN_ENDING = '(?:n|en|e|er|ern|s)?';

export function stepParts(
  text: string,
  ingredients: readonly Ingredient[],
  language?: Language,
): StepPart[];
// Longest names first, so "red onions" goes to red onion before onion could claim its "onions".
// showAmount writes an amount in the page's language; without it, it reads in the given language
// ("2 pc", "2 Stk.")
export function stepParts(
  text: string,
  ingredients: readonly Ingredient[],
  showAmount: (item: Amount) => string,
  language?: Language,
): StepPart[];
export function stepParts(
  text: string,
  ingredients: readonly Ingredient[],
  languageOrShowAmount?: Language | ((item: Amount) => string),
  pageLanguage?: Language,
): StepPart[] {
  const language =
    (typeof languageOrShowAmount === 'function' ? pageLanguage : languageOrShowAmount) ?? 'en';
  const showAmount =
    typeof languageOrShowAmount === 'function'
      ? languageOrShowAmount
      : (item: Amount) => formatAmount(item, language);
  const mentions: Mention[] = [];
  const longestFirst = ingredients
    .map((ingredient) => ({ ingredient, name: ingredientNameIn(ingredient.name, language) }))
    .sort((a, b) => b.name.length - a.name.length);
  for (const { ingredient, name } of longestFirst) {
    const mention = firstFreeMention(text, name, language, mentions);
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

function firstFreeMention(
  text: string,
  name: string,
  language: Language,
  claimed: readonly Mention[],
): Pick<Mention, 'start' | 'end'> | undefined {
  for (const match of text.matchAll(wordPattern(name, 'giu', language))) {
    const start = match.index;
    const end = start + match[0].length;
    if (claimed.every((other) => end <= other.start || start >= other.end)) {
      return { start, end };
    }
  }
  return undefined;
}

export function containsWord(text: string, name: string, language: Language = 'en'): boolean {
  return wordPattern(name, 'u', language).test(text);
}

// \b only knows ASCII letters, and names like "gruyère" have others. German ignores case whatever
// the flags, since a step capitalises the adjective of a name it starts with ("Rote Zwiebeln")
export function wordPattern(name: string, flags: string, language: Language = 'en'): RegExp {
  const forms = language === 'de' ? germanForms(name) : englishForms(name);
  const caseFlags = language === 'de' && !flags.includes('i') ? `${flags}i` : flags;
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${forms})(?![\\p{L}\\p{N}])`, caseFlags);
}

// The plural endings let "onions", "tomatoes", "anchovies" and "leaves" name their ingredient.
// f→ves only after a, l or r, since "beef" has no "beeves"
function englishForms(name: string): string {
  const escaped = escapeRegExp(name);
  const irregular = escaped.replace(/(?<=[^aeiou])y$/, 'ies').replace(/(?<=[alr])f$/, 'ves');
  const plurals = irregular === escaped ? '(?:e?s)?' : `(?:e?s)?|${irregular}`;
  return `${escaped}${plurals}`;
}

// Each word declines on its own: "die roten Zwiebeln" for "rote Zwiebel". "Ei" plus the ending "n"
// is the article "ein", which never names an egg and can start a step as "Ein"
function germanForms(name: string): string {
  return `(?!ein(?![\\p{L}\\p{N}]))${escapeRegExp(name).replace(/(?=[ -])|$/g, GERMAN_ENDING)}`;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
