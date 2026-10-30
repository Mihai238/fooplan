import { computed, effect, Injectable, signal } from '@angular/core';
import { Section } from './groceries/sections';
import { LOCALES, MESSAGES, MessageId } from './i18n';
import type { Plan, PlanSettings } from './plan/plan';
import { Amount, formatAmount } from './recipes/amount';
import { Unit } from './recipes/recipe';
import { readStoredText, writeStoredText } from './storage';

export type Language = 'en' | 'de';

const STORAGE_KEY = 'fooplan.language';

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
    return formatAmount(item, this.language());
  }

  unit(unit: Unit): string {
    return this.t(`unit.${unit}`);
  }

  section(section: Section): string {
    return this.t(SECTION_IDS[section]);
  }

  planSummary({ days, people, kidFriendly }: Plan): string {
    return this.describePlan(
      { days: days.length, people, kidFriendly },
      'plan.summary',
      'plan.summaryKidFriendly',
    );
  }

  describePlan(
    { days, people, kidFriendly }: PlanSettings,
    id: MessageId,
    kidFriendlyId: MessageId,
  ): string {
    return this.t(kidFriendly ? kidFriendlyId : id, {
      days,
      dayWord: this.t(days === 1 ? 'day.one' : 'day.other'),
      people,
      personWord: this.t(people === 1 ? 'person.one' : 'person.other'),
    });
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
