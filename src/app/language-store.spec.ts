import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { SECTIONS } from './groceries/sections';
import { Language, LanguageStore } from './language-store';
import { DEFAULT_SETTINGS } from './plan/plan';
import { PlanStore, RANDOM, TODAY } from './plan/plan-store';
import { seededRandom } from './plan/testing';
import { UNITS } from './recipes/recipe';
import { LANGUAGE_KEY } from './testing';

describe('LanguageStore', () => {
  beforeEach(() => {
    localStorage.clear();
    // Cleared, so each test sees the store set it
    document.documentElement.lang = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.lang = 'en';
  });

  it('starts the app in en with lang="en" and "DE" not pressed with nothing saved and the browser in en-US, in de with lang="de" and "DE" pressed for de-AT, in de for a saved de with en-US, and by the browser for "de" saved with its quotes or fr', async () => {
    browserLanguage('en-US');
    let app = await startApp();
    expectStarted(app, 'en', 'nothing saved, en-US');

    browserLanguage('de-AT');
    app = await startApp();
    expectStarted(app, 'de', 'nothing saved, de-AT');

    browserLanguage('en-US');
    localStorage.setItem(LANGUAGE_KEY, 'de');
    app = await startApp();
    expectStarted(app, 'de', 'de saved, en-US');

    for (const saved of ['"de"', 'fr']) {
      for (const [browser, language] of [
        ['en-US', 'en'],
        ['de-AT', 'de'],
      ] as const) {
        localStorage.setItem(LANGUAGE_KEY, saved);
        browserLanguage(browser);
        app = await startApp();
        expectStarted(app, language, `${saved} saved, ${browser}`);
      }
    }
  });

  describe('edge cases', () => {
    it('goes by the browser for fr, "en", EN, DE, " de", "de ", "", en-US and de-AT saved in fooplan.language, and takes a saved en over a German browser', () => {
      for (const saved of ['fr', '"en"', 'EN', ' de', 'de ', '', 'en-US']) {
        localStorage.setItem(LANGUAGE_KEY, saved);
        browserLanguage('de-AT');
        expectLoaded('de', `${JSON.stringify(saved)} saved, de-AT`);
      }
      for (const saved of ['"de"', 'DE', ' de', 'de-AT']) {
        localStorage.setItem(LANGUAGE_KEY, saved);
        browserLanguage('en-US');
        expectLoaded('en', `${JSON.stringify(saved)} saved, en-US`);
      }
      localStorage.setItem(LANGUAGE_KEY, 'en');
      browserLanguage('de-AT');
      expectLoaded('en', 'en saved, de-AT');
    });

    it('starts in de for the browser languages de, de-AT, de-CH, de-DE, DE and DE-CH, and in en for en-US, en-DE, fr-CH, nl and ""', () => {
      for (const browser of ['de', 'de-AT', 'de-CH', 'de-DE', 'DE', 'DE-CH']) {
        browserLanguage(browser);
        expectLoaded('de', browser);
      }
      for (const browser of ['en-US', 'en-DE', 'fr-CH', 'nl', '']) {
        browserLanguage(browser);
        expectLoaded('en', JSON.stringify(browser));
      }
    });

    it('goes by the browser, de for de-AT and en for en-US, when reading fooplan.language throws, whatever is saved', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('storage blocked', 'SecurityError');
      });
      for (const [saved, browser, language] of [
        ['en', 'de-AT', 'de'],
        ['de', 'en-US', 'en'],
      ] as const) {
        localStorage.setItem(LANGUAGE_KEY, saved);
        browserLanguage(browser);
        expectLoaded(language, `${saved} saved, ${browser}, failed read`);
      }
    });

    it('changes to de with lang="de" without throwing when saving fails, and starts in en again after a reload', () => {
      browserLanguage('en-US');
      const store = createStore();
      const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('quota exceeded', 'QuotaExceededError');
      });
      expect(() => store.set('de'), 'failed write').not.toThrow();
      expect(setItem, 'no write tried').toHaveBeenCalledWith(LANGUAGE_KEY, 'de');
      TestBed.tick();
      expect(store.language(), 'after the failed write').toBe('de');
      expect(document.documentElement.lang, 'lang after the failed write').toBe('de');
      setItem.mockRestore();
      expect(localStorage.getItem(LANGUAGE_KEY)).toBeNull();
      expectLoaded('en', 'after a reload');
    });

    it('saves set("de") as the plain text de and set("en") as en in fooplan.language, setting lang each time, and keeps the language after a reload and after "New plan"', () => {
      TestBed.configureTestingModule({
        providers: [
          { provide: RANDOM, useValue: seededRandom(1) },
          { provide: TODAY, useValue: () => '2026-10-24' },
        ],
      });
      browserLanguage('en-US');
      const store = createStore();
      store.set('de');
      TestBed.tick();
      expect(store.language()).toBe('de');
      expect(localStorage.getItem(LANGUAGE_KEY)).toBe('de');
      expect(document.documentElement.lang).toBe('de');

      TestBed.inject(PlanStore).newPlan(DEFAULT_SETTINGS);
      expect(store.language(), 'after "New plan"').toBe('de');
      expect(localStorage.getItem(LANGUAGE_KEY), 'saved after "New plan"').toBe('de');
      expectLoaded('de', 'de after a reload');

      browserLanguage('de-AT');
      const reloaded = TestBed.inject(LanguageStore);
      reloaded.set('en');
      TestBed.tick();
      expect(localStorage.getItem(LANGUAGE_KEY)).toBe('en');
      expect(document.documentElement.lang).toBe('en');
      expectLoaded('en', 'en after a reload, de-AT');
    });
  });

  describe('amount, unit and section', () => {
    it('writes an amount with its unit as displayAmount shows it, the units pc, tbsp and tsp as Stk., EL and TL and a decimal comma in German, and plain digits without a thousands separator in both', () => {
      browserLanguage('en-US');
      const store = createStore();
      const amounts = [
        { amount: 2, unit: 'pc' },
        { amount: 0.5, unit: 'pc' },
        { amount: 0.25, unit: 'tsp' },
        { amount: 15, unit: 'ml' },
        { amount: 10, unit: 'ml' },
        { amount: 50, unit: 'ml' },
        { amount: 2000, unit: 'g' },
        { amount: 1000.5, unit: 'g' },
      ] as const;
      expect(
        amounts.map((item) => store.amount(item)),
        'English',
      ).toEqual(['2 pc', '0.5 pc', '0.25 tsp', '1 tbsp', '2 tsp', '50 ml', '2000 g', '1000.5 g']);
      store.set('de');
      expect(
        amounts.map((item) => store.amount(item)),
        'German',
      ).toEqual(['2 Stk.', '0,5 Stk.', '0,25 TL', '1 EL', '2 TL', '50 ml', '2000 g', '1000,5 g']);
    });

    it('names the units and the sections in the current language', () => {
      browserLanguage('en-US');
      const store = createStore();
      expect(
        UNITS.map((unit) => store.unit(unit)),
        'English units',
      ).toEqual(['g', 'ml', 'pc', 'tbsp', 'tsp']);
      expect(
        SECTIONS.map((section) => store.section(section)),
        'English sections',
      ).toEqual([...SECTIONS]);
      store.set('de');
      expect(
        UNITS.map((unit) => store.unit(unit)),
        'German units',
      ).toEqual(['g', 'ml', 'Stk.', 'EL', 'TL']);
      expect(store.section('Fruit & vegetables')).toBe('Obst & Gemüse');
      expect(store.section('Other')).toBe('Sonstiges');
    });
  });

  // A fresh app on the same localStorage, as a page reload makes
  async function startApp(): Promise<ComponentFixture<App>> {
    TestBed.resetTestingModule();
    document.documentElement.lang = '';
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const app = TestBed.createComponent(App);
    await app.whenStable();
    return app;
  }

  function expectStarted(app: ComponentFixture<App>, language: Language, when: string) {
    expect(TestBed.inject(LanguageStore).language(), when).toBe(language);
    expect(document.documentElement.lang, `lang, ${when}`).toBe(language);
    const element = app.nativeElement as HTMLElement;
    const deutsch = Array.from(element.querySelectorAll('header button')).find(
      (button) => button.getAttribute('aria-label') === 'Deutsch',
    );
    expect(deutsch, `no "Deutsch" button in the header, ${when}`).toBeDefined();
    expect(deutsch!.getAttribute('aria-pressed'), `"DE" pressed, ${when}`).toBe(
      String(language === 'de'),
    );
  }

  // A fresh store on the same localStorage, with its effect run
  function expectLoaded(language: Language, when: string) {
    TestBed.resetTestingModule();
    document.documentElement.lang = '';
    const store = createStore();
    TestBed.tick();
    expect(store.language(), when).toBe(language);
    expect(document.documentElement.lang, `lang, ${when}`).toBe(language);
  }

  function createStore(): LanguageStore {
    return TestBed.inject(LanguageStore);
  }

  function browserLanguage(language: string) {
    vi.spyOn(Navigator.prototype, 'language', 'get').mockReturnValue(language);
  }
});
