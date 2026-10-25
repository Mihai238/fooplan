import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { QUICK_DAL, storeOwnRecipes } from './recipes/testing';
import { LANGUAGE_KEY, TABBABLE } from './testing';

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('renders a "Recipes" link to /recipes', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const link = Array.from(compiled.querySelectorAll('a')).find(
      (a) => a.textContent?.trim() === 'Recipes',
    );
    expect(link, 'no "Recipes" link').toBeDefined();
    expect(link!.getAttribute('href')).toBe('/recipes');
  });

  it('renders the nav links in the order of the workflow: Plan, Grocery list, Recipes', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const links = Array.from(compiled.querySelectorAll('nav a'));
    expect(links.map((a) => a.textContent?.trim())).toEqual(['Plan', 'Grocery list', 'Recipes']);
    expect(links[0].getAttribute('href')).toBe('/plan');
  });

  it('renders a "Grocery list" link to /groceries', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const link = Array.from(compiled.querySelectorAll('nav a')).find(
      (a) => a.textContent?.trim() === 'Grocery list',
    );
    expect(link, 'no "Grocery list" link').toBeDefined();
    expect(link!.getAttribute('href')).toBe('/groceries');
  });

  it('marks the "Recipes" link as the current page on /recipes, and only as current on a recipe page', async () => {
    const fixture = TestBed.createComponent(App);
    const compiled = fixture.nativeElement as HTMLElement;
    const recipes = () =>
      Array.from(compiled.querySelectorAll('nav a')).find(
        (a) => a.textContent?.trim() === 'Recipes',
      )!;

    await navigate('/recipes');
    expect(recipes().getAttribute('aria-current'), 'on /recipes').toBe('page');
    expect(recipes().classList, 'on /recipes').toContain('active');

    await navigate('/recipes/nicoise-salad');
    expect(recipes().getAttribute('aria-current'), 'on a recipe page').toBe('true');
    expect(recipes().classList, 'on a recipe page').toContain('active');

    await navigate('/plan');
    expect(recipes().hasAttribute('aria-current'), 'on /plan').toBe(false);
    expect(compiled.querySelector('nav a[aria-current]')?.textContent?.trim()).toBe('Plan');

    async function navigate(url: string) {
      await TestBed.inject(Router).navigateByUrl(url);
      await fixture.whenStable();
      // RouterLinkActive applies its class and aria-current in a microtask after the navigation
      await Promise.resolve();
    }
  });

  it('marks the "Recipes" link as current, and active, on the edit form /recipes/quick-dal/edit, and no other nav link', async () => {
    storeOwnRecipes(QUICK_DAL);
    const fixture = TestBed.createComponent(App);
    const compiled = fixture.nativeElement as HTMLElement;
    await TestBed.inject(Router).navigateByUrl('/recipes/quick-dal/edit');
    await fixture.whenStable();
    // RouterLinkActive applies its class and aria-current in a microtask after the navigation
    await Promise.resolve();

    expect(TestBed.inject(Router).url, 'form not opened').toBe('/recipes/quick-dal/edit');
    expect(
      Array.from(compiled.querySelectorAll('nav a[aria-current]')).map((a) => [
        a.textContent?.trim(),
        a.getAttribute('aria-current'),
        a.classList.contains('active'),
      ]),
    ).toEqual([['Recipes', 'true', true]]);
  });

  it('marks the "Recipes" link as current, and active, on /add-recipe, and no other nav link', async () => {
    const fixture = TestBed.createComponent(App);
    const compiled = fixture.nativeElement as HTMLElement;
    await TestBed.inject(Router).navigateByUrl('/add-recipe');
    await fixture.whenStable();
    // RouterLinkActive applies its class and aria-current in a microtask after the navigation
    await Promise.resolve();

    expect(TestBed.inject(Router).url, 'form not opened').toBe('/add-recipe');
    const recipes = Array.from(compiled.querySelectorAll('nav a')).find(
      (a) => a.textContent?.trim() === 'Recipes',
    );
    expect(recipes?.getAttribute('aria-current')).toBe('true');
    expect(recipes?.classList).toContain('active');
    expect(
      Array.from(compiled.querySelectorAll('nav a[aria-current]')).map((a) =>
        a.textContent?.trim(),
      ),
    ).toEqual(['Recipes']);
  });

  describe('language switch (#35)', () => {
    afterEach(() => {
      vi.restoreAllMocks();
      document.documentElement.lang = 'en';
    });

    it('puts a group named "Language" right after the nav, last in the header, with the buttons "English" (text "EN") and "Deutsch" (text "DE"), in this order; tabs through "Plan", "Grocery list", "Recipes", "EN", "DE" and then the page, never the brand; and writes nothing to localStorage when the user clicks the pressed "EN"', async () => {
      const fixture = TestBed.createComponent(App);
      await TestBed.inject(Router).navigateByUrl('/plan');
      await fixture.whenStable();
      const compiled = fixture.nativeElement as HTMLElement;
      const group = languageGroup(compiled);
      const header = compiled.querySelector('header')!;
      expect(group.getAttribute('aria-label')).toBe('Language');
      expect(group.previousElementSibling, 'before the group').toBe(header.querySelector('nav'));
      expect(header.lastElementChild, 'last in the header').toBe(group);
      expect(
        Array.from(group.children).map((button) => [
          button.tagName,
          button.getAttribute('type'),
          button.getAttribute('aria-label'),
          button.textContent?.trim(),
          button.getAttribute('aria-pressed'),
        ]),
      ).toEqual([
        ['BUTTON', 'button', 'English', 'EN', 'true'],
        ['BUTTON', 'button', 'Deutsch', 'DE', 'false'],
      ]);

      const tabbable = Array.from(compiled.querySelectorAll<HTMLElement>(TABBABLE)).filter(
        (candidate) => !candidate.closest('dialog'),
      );
      expect(tabbable.slice(0, 5).map((candidate) => candidate.textContent?.trim())).toEqual([
        'Plan',
        'Grocery list',
        'Recipes',
        'EN',
        'DE',
      ]);
      expect(tabbable[5]?.closest('main'), 'the page after "DE"').not.toBeNull();
      expect(compiled.querySelector('.brand')?.matches(TABBABLE), 'brand focusable').toBe(false);

      const setItem = vi.spyOn(Storage.prototype, 'setItem');
      (group.children[0] as HTMLButtonElement).click();
      await fixture.whenStable();
      expect(setItem.mock.calls.filter(([key]) => key === LANGUAGE_KEY)).toEqual([]);
      expect(localStorage.getItem(LANGUAGE_KEY)).toBeNull();
      expect(group.children[0].getAttribute('aria-pressed'), '"EN" pressed').toBe('true');
    });

    describe('edge cases', () => {
      it('names the group "Sprache" and the links "Plan", "Einkaufsliste" and "Rezepte" in German, keeping the buttons "English" ("EN") and "Deutsch" ("DE"), with "DE" pressed', async () => {
        localStorage.setItem(LANGUAGE_KEY, 'de');
        const fixture = TestBed.createComponent(App);
        await fixture.whenStable();
        const compiled = fixture.nativeElement as HTMLElement;
        const group = languageGroup(compiled);
        expect(group.getAttribute('aria-label')).toBe('Sprache');
        expect(
          Array.from(compiled.querySelectorAll('nav a')).map((a) => a.textContent?.trim()),
        ).toEqual(['Plan', 'Einkaufsliste', 'Rezepte']);
        expect(
          Array.from(group.children).map((button) => [
            button.getAttribute('aria-label'),
            button.textContent?.trim(),
            button.getAttribute('aria-pressed'),
          ]),
        ).toEqual([
          ['English', 'EN', 'false'],
          ['Deutsch', 'DE', 'true'],
        ]);
      });

      it('writes nothing to localStorage when the user clicks the pressed "DE" in German, and saves en with "EN" pressed and the links in English when the user clicks "EN"', async () => {
        localStorage.setItem(LANGUAGE_KEY, 'de');
        const fixture = TestBed.createComponent(App);
        await fixture.whenStable();
        const compiled = fixture.nativeElement as HTMLElement;
        const group = languageGroup(compiled);
        const [english, deutsch] = Array.from(group.querySelectorAll('button'));
        const setItem = vi.spyOn(Storage.prototype, 'setItem');

        deutsch.click();
        await fixture.whenStable();
        expect(setItem.mock.calls.filter(([key]) => key === LANGUAGE_KEY)).toEqual([]);
        expect(deutsch.getAttribute('aria-pressed'), '"DE" pressed').toBe('true');

        english.click();
        await fixture.whenStable();
        expect(setItem.mock.calls.filter(([key]) => key === LANGUAGE_KEY)).toEqual([
          [LANGUAGE_KEY, 'en'],
        ]);
        expect(english.getAttribute('aria-pressed'), '"EN" pressed').toBe('true');
        expect(deutsch.getAttribute('aria-pressed'), '"DE" pressed').toBe('false');
        expect(
          Array.from(compiled.querySelectorAll('nav a')).map((a) => a.textContent?.trim()),
        ).toEqual(['Plan', 'Grocery list', 'Recipes']);
      });
    });

    function languageGroup(compiled: HTMLElement): HTMLElement {
      const found = compiled.querySelector<HTMLElement>('header div.language[role="group"]');
      expect(found, 'no div.language group in the header').not.toBeNull();
      return found!;
    }
  });
});
