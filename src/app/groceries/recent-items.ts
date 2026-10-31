import { sameItem } from '../plan/plan';
import { normalize } from '../recipes/recipe-search';
import { isStringList } from '../storage';

export const MAX_RECENT = 30;
export const MAX_SUGGESTED = 5;

export function remember(items: readonly string[], text: string): readonly string[] {
  const item = text.trim();
  if (item === '' || (items[0] === item && items.length <= MAX_RECENT)) {
    return items;
  }
  return [item, ...items.filter((other) => !sameItem(other, item))].slice(0, MAX_RECENT);
}

export function forget(items: readonly string[], text: string): readonly string[] {
  const kept = items.filter((other) => !sameItem(other, text));
  return kept.length === items.length ? items : kept;
}

export function parseRecentItems(value: unknown): readonly string[] {
  if (!isStringList(value)) {
    return [];
  }
  // Stops at the limit, so a huge saved list isn't compared item by item with all the others
  const items: string[] = [];
  for (const text of value) {
    if (items.length === MAX_RECENT) {
      break;
    }
    const item = text.trim();
    if (item !== '' && !items.some((other) => sameItem(other, item))) {
      items.push(item);
    }
  }
  return items;
}

export function suggestions(
  items: readonly string[],
  added: readonly string[],
  text: string,
): readonly string[] {
  const typed = normalize(text.trim());
  if (typed === '') {
    return [];
  }
  return notOnList(items, added)
    .filter((item) => normalize(item).includes(typed))
    .slice(0, MAX_SUGGESTED);
}

export function notOnList(items: readonly string[], added: readonly string[]): readonly string[] {
  return items.filter((item) => !added.some((other) => sameItem(other, item)));
}
