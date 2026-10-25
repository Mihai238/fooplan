import { computed, effect, Injectable, signal } from '@angular/core';
import { Section } from './groceries/sections';
import { MESSAGES, MessageId } from './i18n';
import { Amount, displayAmount } from './recipes/amount';
import { Unit } from './recipes/recipe';
import { readStoredText, writeStoredText } from './storage';

export type Language = 'en' | 'de';

const STORAGE_KEY = 'fooplan.language';

const LOCALES: Record<Language, string> = { en: 'en-US', de: 'de' };

// Not formatNumber or DecimalPipe: they always group thousands, and amounts are plain digits
// ("2000 g") apart from the decimal separator. Intl writes the shortest digits, as String() does
const NUMBERS: Record<Language, Intl.NumberFormat> = {
  en: new Intl.NumberFormat(LOCALES.en, { useGrouping: false, maximumFractionDigits: 20 }),
  de: new Intl.NumberFormat(LOCALES.de, { useGrouping: false, maximumFractionDigits: 20 }),
};

const SECTION_IDS: Record<Section, MessageId> = {
  'Fruit & vegetables': 'section.fruit',
  'Meat & fish': 'section.meat',
  'Dairy & eggs': 'section.dairy',
  'Bread & bakery': 'section.bread',
  'Pasta, rice & grains': 'section.pasta',
  'Cans & jars': 'section.cans',
  'Spices & sauces': 'section.spices',
  'Nuts & seeds': 'section.nuts',
  Drinks: 'section.drinks',
  Other: 'section.other',
};

@Injectable({ providedIn: 'root' })
export class LanguageStore {
  private readonly state = signal<Language>(readLanguage());
  readonly language = this.state.asReadonly();
  readonly locale = computed(() => LOCALES[this.language()]);

  constructor() {
    effect(() => {
      document.documentElement.lang = this.language();
    });
  }

  set(language: Language): void {
    this.state.set(language);
    writeStoredText(STORAGE_KEY, language);
  }

  amount(item: Amount): string {
    const shown = displayAmount(item);
    return `${NUMBERS[this.language()].format(shown.amount)} ${this.unit(shown.unit)}`;
  }

  unit(unit: Unit): string {
    return this.t(`unit.${unit}`);
  }

  section(section: Section): string {
    return this.t(SECTION_IDS[section]);
  }

  t(id: MessageId, params: Record<string, string | number> = {}): string {
    return MESSAGES[this.language()][id].replace(/\{(\w+)\}/g, (placeholder, name: string) =>
      name in params ? String(params[name]) : placeholder,
    );
  }
}

function readLanguage(): Language {
  const stored = readStoredText(STORAGE_KEY);
  if (stored === 'en' || stored === 'de') {
    return stored;
  }
  return /^de/i.test(navigator.language) ? 'de' : 'en';
}
