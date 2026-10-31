import { TestBed } from '@angular/core/testing';
import { MESSAGES } from './i18n';
import { LanguageStore } from './language-store';

describe('MESSAGES', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    document.documentElement.lang = 'en';
  });

  it('has the ids of MESSAGES.en in MESSAGES.de, in the same order, no empty text and German quotes „…“ only, and t("groceries.added", { item: "Klopapier", section: "Sonstiges" }) reads „Klopapier“ zu Sonstiges hinzugefügt. in German', () => {
    expect(Object.keys(MESSAGES.de)).toEqual(Object.keys(MESSAGES.en));
    for (const language of ['en', 'de'] as const) {
      for (const [id, text] of Object.entries(MESSAGES[language])) {
        expect(text.trim(), `${language} ${id}`).not.toBe('');
      }
    }
    for (const [id, text] of Object.entries(MESSAGES.de)) {
      expect(text, `de ${id}`).not.toContain('"');
      expect(text.split('„').length, `de ${id}: „ and “`).toBe(text.split('“').length);
    }

    const store = TestBed.inject(LanguageStore);
    store.set('de');
    expect(store.t('groceries.added', { item: 'Klopapier', section: 'Sonstiges' })).toBe(
      '„Klopapier“ zu Sonstiges hinzugefügt.',
    );
  });

  it('has no id "groceries.add" in English or German, as Enter adds the item', () => {
    expect(Object.keys(MESSAGES.en)).not.toContain('groceries.add');
    expect(Object.keys(MESSAGES.de)).not.toContain('groceries.add');
  });

  describe('edge cases', () => {
    it("follows the current language in t(), filling in every placeholder, numbers too: English, German after set('de') and English again after set('en')", () => {
      const store = TestBed.inject(LanguageStore);
      const params = { dates: 'Sat 24 Oct', filled: 1, total: 2 };
      expect(store.t('newPlan.lost', params), 'English').toBe(
        'The plan for Sat 24 Oct, with 1 of 2 meals picked, will be discarded.',
      );
      store.set('de');
      expect(store.t('newPlan.lost', { ...params, dates: 'Sa., 24. Okt.' }), 'German').toBe(
        'Der Plan für Sa., 24. Okt. mit 1 von 2 gewählten Mahlzeiten wird verworfen.',
      );
      expect(store.t('recipes.matches', { count: 44, search: 's' })).toBe(
        '44 Rezepte passen zu „s“.',
      );
      store.set('en');
      expect(store.t('recipes.matches', { count: 44, search: 's' }), 'English again').toBe(
        '44 recipes match "s".',
      );
    });
  });
});
