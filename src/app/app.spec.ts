import { Location } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App, IMPORT_PLAN_STORE } from './app';
import { routes } from './app.routes';
import {
  DATA_FAILED,
  deferred,
  FakeSupabase,
  provideSupabase,
  sessionFor,
  SIGN_OUT_FAILED,
} from './auth/testing';
import { LanguageStore } from './language-store';
import { PlanStore, TODAY } from './plan/plan-store';
import { day, open, picked, planOf } from './plan/testing';
import { RecipeStore } from './recipes/recipe-store';
import { QUICK_DAL, RECIPES_KEY, storeOwnRecipes } from './recipes/testing';
import { SessionBackend } from './session-backend';
import { StorageBackend } from './storage';
import { HeldBackend, LANGUAGE_KEY, TABBABLE } from './testing';

describe('App', () => {
  let fake: FakeSupabase;

  beforeEach(async () => {
    localStorage.clear();
    fake = new FakeSupabase();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), provideSupabase(fake)],
    }).compileComponents();
  });

  it('should create the app', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
    // Lets the first load end before the test tears the app down
    await fixture.whenStable();
  });

  it('renders the brand "Fooplan" as a link to the home page, marked as the current page there only', async () => {
    const fixture = TestBed.createComponent(App);
    const compiled = fixture.nativeElement as HTMLElement;
    const brand = compiled.querySelector('header a.brand');
    expect(brand, 'no brand link').not.toBeNull();
    await navigate('/');
    expect(brand!.textContent?.trim()).toBe('Fooplan');
    expect(brand!.getAttribute('href')).toBe('/');
    expect(brand!.getAttribute('aria-current'), 'on /').toBe('page');
    await navigate('/plan');
    expect(brand!.hasAttribute('aria-current'), 'on /plan').toBe(false);

    async function navigate(url: string) {
      await TestBed.inject(Router).navigateByUrl(url);
      await fixture.whenStable();
      // RouterLinkActive applies its class and aria-current in a microtask after the navigation
      await Promise.resolve();
    }
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

  describe('loading (#44)', () => {
    it('shows the 2 picks of the saved plan on the Plan page once loaded, and on the Recipes page "Niçoise salad" as "Not suggested" and the own recipe "Quick Dal" as "Your recipe" (#44 1)', async () => {
      localStorage.setItem(
        'fooplan.plan',
        JSON.stringify(
          planOf([
            day('2026-10-26', picked('Spaghetti carbonara'), picked('Fish tacos')),
            day(
              '2026-10-27',
              open('Bean burritos', 'Potato goulash', 'Shakshuka with bread'),
              open('Pizza toast', 'Pad thai with chicken', 'Chicken fajitas'),
            ),
          ]),
        ),
      );
      localStorage.setItem('fooplan.removed', JSON.stringify(['Niçoise salad']));
      storeOwnRecipes(QUICK_DAL);
      const fixture = TestBed.createComponent(App);
      const compiled = fixture.nativeElement as HTMLElement;

      await TestBed.inject(Router).navigateByUrl('/plan');
      await fixture.whenStable();
      expect(
        Array.from(compiled.querySelectorAll('main .meal .recipe a.name')).map((name) =>
          name.textContent?.trim(),
        ),
      ).toEqual(['Spaghetti carbonara', 'Fish tacos']);

      await TestBed.inject(Router).navigateByUrl('/recipes');
      await fixture.whenStable();
      expect(cardText(compiled, 'Niçoise salad')).toContain('Not suggested');
      expect(cardText(compiled, 'Quick Dal')).toContain('Your recipe');
      expect(cardText(compiled, 'Spaghetti carbonara')).not.toContain('Not suggested');
    });

    it('holds only "Loading…" with the role status in <main>, and no page, until the first load is done, then the page of the URL (#44 2)', async () => {
      const backend = new HeldBackend();
      TestBed.overrideProvider(StorageBackend, { useValue: backend });
      const fixture = TestBed.createComponent(App);
      const main = (fixture.nativeElement as HTMLElement).querySelector('main')!;

      await TestBed.inject(Router).navigateByUrl('/plan');
      await rendered();
      expect(
        Array.from(main.children).map((child) => [
          child.tagName,
          child.getAttribute('role'),
          child.textContent?.trim(),
        ]),
      ).toEqual([['P', 'status', 'Loading…']]);

      backend.release();
      await fixture.whenStable();
      expect(main.querySelector('h1')?.textContent?.trim()).toBe('Plan');
      expect(main.textContent).not.toContain('Loading…');
    });

    describe('edge cases', () => {
      it('shows the header as always while loading (#44 2a)', async () => {
        fake.load(null);
        const backend = new HeldBackend();
        TestBed.overrideProvider(StorageBackend, { useValue: backend });
        const fixture = TestBed.createComponent(App);
        const compiled = fixture.nativeElement as HTMLElement;

        await TestBed.inject(Router).navigateByUrl('/plan');
        await rendered();
        expect(compiled.querySelector('main')?.textContent?.trim(), 'not loading').toBe('Loading…');
        expect(compiled.querySelector('header a.brand')?.textContent?.trim()).toBe('Fooplan');
        expect(
          Array.from(compiled.querySelectorAll('header nav a')).map((a) => a.textContent?.trim()),
        ).toEqual(['Plan', 'Grocery list', 'Recipes']);
        expect(compiled.querySelector('header [aria-label="Language"]')).not.toBeNull();
        expect(compiled.querySelector('header [aria-label="Account"]')).not.toBeNull();
        backend.release();
        await fixture.whenStable();
      });

      it('says "Wird geladen…" while loading in German (#44 2b)', async () => {
        localStorage.setItem(LANGUAGE_KEY, 'de');
        const backend = new HeldBackend();
        TestBed.overrideProvider(StorageBackend, { useValue: backend });
        const fixture = TestBed.createComponent(App);

        await TestBed.inject(Router).navigateByUrl('/plan');
        await rendered();
        const status = (fixture.nativeElement as HTMLElement).querySelector('main > p');
        expect(status?.getAttribute('role')).toBe('status');
        expect(status?.textContent?.trim()).toBe('Wird geladen…');
        backend.release();
        await fixture.whenStable();
      });
    });

    // The load is held, so the fixture never becomes stable: the render scheduled by the
    // navigation is run here instead
    async function rendered() {
      await new Promise((resolve) => setTimeout(resolve));
      TestBed.tick();
    }

    function cardText(compiled: HTMLElement, name: string): string {
      const card = Array.from(compiled.querySelectorAll('main article')).find(
        (article) => article.querySelector('h2')?.textContent?.trim() === name,
      );
      expect(card, `no card "${name}"`).toBeDefined();
      return card!.textContent ?? '';
    }
  });

  describe('language switch (#35)', () => {
    afterEach(() => {
      vi.restoreAllMocks();
      document.documentElement.lang = 'en';
    });

    it('puts a group named "Language" right after the nav, last in the header, with the buttons "English" (text "EN") and "Deutsch" (text "DE"), in this order; tabs through "Fooplan", "Plan", "Grocery list", "Recipes", "EN", "DE" and then the page; and writes nothing to localStorage when the user clicks the pressed "EN"', async () => {
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
      expect(tabbable.slice(0, 6).map((candidate) => candidate.textContent?.trim())).toEqual([
        'Fooplan',
        'Plan',
        'Grocery list',
        'Recipes',
        'EN',
        'DE',
      ]);
      expect(tabbable[6]?.closest('main'), 'the page after "DE"').not.toBeNull();

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

  describe('account (#43)', () => {
    let fixture: ComponentFixture<App>;
    let compiled: HTMLElement;

    afterEach(() => {
      vi.restoreAllMocks();
      history.replaceState(null, '', '/');
      document.documentElement.lang = 'en';
    });

    it('ends the header with the group "Account", right after "Language", holding only the link "Sign in" to /sign-in without a session, "Konto" and "Anmelden" in German (#43 1)', async () => {
      fake.load(null);
      await open('/plan');
      const group = accountGroup();
      const header = compiled.querySelector('header')!;
      expect(header.lastElementChild, 'last in the header').toBe(group);
      expect(group.previousElementSibling?.getAttribute('aria-label'), 'before the group').toBe(
        'Language',
      );
      expect(
        Array.from(group.children).map((child) => [
          child.tagName,
          textOf(child),
          child.getAttribute('href'),
        ]),
      ).toEqual([['A', 'Sign in', '/sign-in']]);

      TestBed.inject(LanguageStore).set('de');
      await stable();
      expect(group.getAttribute('aria-label'), 'German group').toBe('Konto');
      expect(textOf(group), 'German link').toBe('Anmelden');
    });

    it('renders no "Account" group until the client has returned the saved session, and then the group with "Sign in" (#43 2)', async () => {
      await open('/plan');
      expect(findAccountGroup(), 'before the session is read').toBeNull();
      expect(textOf(compiled.querySelector('header')!), 'before').not.toContain('Sign in');

      fake.load(null);
      await stable();
      expect(textOf(accountGroup())).toBe('Sign in');
    });

    it('shows the email "ana@example.com" and the button "Sign out", and no "Sign in", with a session (#43 7)', async () => {
      fake.load(sessionFor('ana@example.com'));
      await open('/recipes');
      const group = accountGroup();
      expect(childTexts(group)).toEqual(['ana@example.com', 'Sign out']);
      expect(group.querySelector('a'), 'a link in the group').toBeNull();
      const button = group.querySelector('button');
      expect(button?.type).toBe('button');
      expect(textOf(button!)).toBe('Sign out');
      expect(textOf(button!.previousElementSibling!), 'before "Sign out"').toBe('ana@example.com');
    });

    it('goes to the Plan page when "Sign out" is clicked on the Recipes page, and shows "Sign in" with the focus (#43 8, changed by #45 5)', async () => {
      fake.load(sessionFor('ana@example.com'));
      await open('/recipes');

      await click(buttonIn(accountGroup(), 'Sign out'));
      expect(fake.signOuts.length, 'signed out').toBe(1);
      expect(TestBed.inject(Router).url).toBe('/plan');
      expect(compiled.querySelector('main h1')?.textContent?.trim()).toBe('Plan');
      const link = accountGroup().querySelector('a');
      expect(textOf(accountGroup())).toBe('Sign in');
      expect(document.activeElement, 'focus after "Sign out"').toBe(link);
    });

    it('goes to the Plan page, replacing the URL, once the client has signed in from the link the app opened with and the router has followed the cleared URL, when the session comes first (#43 9)', async () => {
      await openOnLink();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
      fake.load(sessionFor('ana@example.com', 'token'));
      await stable();
      expect(TestBed.inject(Router).url, 'before the URL is cleared').toBe('/');
      expect(navigate, 'before the URL is cleared').not.toHaveBeenCalled();

      await clearLink();
      expect(navigate).toHaveBeenCalledExactlyOnceWith('/plan', { replaceUrl: true });
      expect(TestBed.inject(Router).url).toBe('/plan');
      expect(childTexts(accountGroup())).toEqual(['ana@example.com', 'Sign out']);
    });

    it('goes to the Plan page when the router has followed the cleared URL with a navigation of its own before the session comes (#43 9b)', async () => {
      await openOnLink();
      await clearLink();
      expect(TestBed.inject(Router).url, 'before the session').toBe('/');

      fake.load(sessionFor('ana@example.com', 'token'));
      await stable();
      expect(TestBed.inject(Router).url).toBe('/plan');
    });

    describe('edge cases', () => {
      it('tabs through "Fooplan", "Plan", "Grocery list", "Recipes", "EN", "DE", "Sign in" and then the page (#43 1a)', async () => {
        fake.load(null);
        await open('/plan');
        const tabbable = Array.from(compiled.querySelectorAll<HTMLElement>(TABBABLE)).filter(
          (candidate) => !candidate.closest('dialog'),
        );
        expect(tabbable.slice(0, 7).map((candidate) => textOf(candidate))).toEqual([
          'Fooplan',
          'Plan',
          'Grocery list',
          'Recipes',
          'EN',
          'DE',
          'Sign in',
        ]);
        expect(tabbable[7]?.closest('main'), 'the page after "Sign in"').not.toBeNull();
      });

      it('shows neither "Sign in" nor the email until a saved session is returned, and then the email and "Sign out" (#43 2a)', async () => {
        await open('/plan');
        const header = compiled.querySelector('header')!;
        expect(findAccountGroup(), 'before the session is read').toBeNull();
        expect(textOf(header)).not.toContain('Sign in');
        expect(textOf(header)).not.toContain('ana@example.com');

        fake.load(sessionFor('ana@example.com'));
        await stable();
        expect(childTexts(accountGroup())).toEqual(['ana@example.com', 'Sign out']);
      });

      it('stays on the page of a reload while signed in, and on the home page when the link brings no session (#43 9a)', async () => {
        fake.load(sessionFor('ana@example.com'));
        await open('/');
        await stable();
        expect(TestBed.inject(Router).url, 'reload').toBe('/');

        TestBed.resetTestingModule();
        fake = new FakeSupabase();
        TestBed.configureTestingModule({
          providers: [provideRouter(routes), provideSupabase(fake)],
        });
        await openOnLink();
        fake.load(null);
        await clearLink();
        expect(TestBed.inject(Router).url, 'no session').toBe('/');
      });

      it('leaves a signed-in user where the link opened when signing in from it fails and the client keeps the earlier session (#43 9c)', async () => {
        await openOnLink();
        const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
        fake.load(sessionFor('ana@example.com', 'earlier-token'));
        await clearLink();
        expect(navigate).not.toHaveBeenCalled();
        expect(TestBed.inject(Router).url).toBe('/');
      });

      it('names the group "Konto" and the button "Abmelden" in German with a session (#43 7a)', async () => {
        localStorage.setItem(LANGUAGE_KEY, 'de');
        fake.load(sessionFor('ana@example.com'));
        await open('/plan');
        const group = accountGroup('Konto');
        expect(childTexts(group)).toEqual(['ana@example.com', 'Abmelden']);
      });

      it('keeps the email and "Sign out" when signing out fails (#43 8a)', async () => {
        fake.load(sessionFor('ana@example.com'));
        fake.signOutResult = () => Promise.resolve(SIGN_OUT_FAILED);
        await open('/recipes');
        await click(buttonIn(accountGroup(), 'Sign out'));
        expect(fake.signOuts.length, 'not signed out').toBe(1);
        expect(childTexts(accountGroup())).toEqual(['ana@example.com', 'Sign out']);
      });
    });

    describe('data in the account (#45)', () => {
      const TODAY_DATE = '2026-10-30';
      const LOAD_FAILED = "Couldn't load your data. Check your connection and reload the page.";
      const SAVE_FAILED =
        "Your last change couldn't be saved. Check your connection and try again.";
      const browserPlan = planOf([
        day(TODAY_DATE, picked('Pizza toast'), picked('Potato goulash')),
      ]);
      const accountPlan = planOf(
        [day(TODAY_DATE, picked('Spaghetti carbonara'), picked('Fish tacos'))],
        { accepted: true },
      );

      beforeEach(() => {
        TestBed.overrideProvider(StorageBackend, {
          useFactory: (backend: SessionBackend) => backend,
          deps: [SessionBackend],
        });
        TestBed.overrideProvider(TODAY, { useValue: () => TODAY_DATE });
      });

      it('shows a new 5-day plan for 2 people starting today, saved in the row fooplan.plan, and the 44 built-in recipes, none "Not suggested" and no "Your recipe", for an account with no rows (#45 4)', async () => {
        fake.load(sessionFor('ana@example.com'));
        await open('/plan');

        expect(compiled.querySelector('main .summary')?.textContent?.trim()).toBe(
          '5 days for 2 people',
        );
        const days = compiled.querySelectorAll('main section.day');
        expect(days.length).toBe(5);
        expect(days[0].querySelector('h2')?.getAttribute('aria-current'), 'today first').toBe(
          'date',
        );
        const plan = TestBed.inject(PlanStore).plan();
        expect(plan.days[0].date).toBe(TODAY_DATE);
        expect(fake.row('fooplan.plan')?.value, 'row fooplan.plan').toEqual(plan);

        await TestBed.inject(Router).navigateByUrl('/recipes');
        await stable();
        const cards = Array.from(compiled.querySelectorAll('main article'));
        expect(cards.length).toBe(44);
        expect(cards.filter((card) => textOf(card).includes('Not suggested'))).toEqual([]);
        expect(cards.filter((card) => textOf(card).includes('Your recipe'))).toEqual([]);
      });

      it('shows "Loading…", then the Plan page with the browser\'s plan at /plan, replacing the URL, when "Sign out" is clicked on the Grocery list page of an accepted plan; and the same with the account\'s plan when another tab signs in (#45 5)', async () => {
        localStorage.setItem('fooplan.plan', JSON.stringify(browserPlan));
        fake.saveRow('fooplan.plan', accountPlan);
        fake.load(sessionFor('ana@example.com'));
        await open('/groceries');
        expect(compiled.querySelector('main h1')?.textContent?.trim()).toBe('Grocery list');
        expect(compiled.querySelector('main')?.textContent).not.toContain('Accept a plan');
        const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');

        let release = holdReads();
        const signOut = buttonIn(accountGroup(), 'Sign out');
        signOut.focus();
        signOut.click();
        await rendered();
        expect(mainContent(), 'signing out').toEqual([['P', 'status', 'Loading…']]);
        release();
        await stable();
        expect(navigate).toHaveBeenCalledWith('/plan', { replaceUrl: true });
        expect(TestBed.inject(Router).url).toBe('/plan');
        expect(pickedNames(), 'browser plan').toEqual(['Pizza toast', 'Potato goulash']);

        navigate.mockClear();
        release = holdReads();
        fake.emit('SIGNED_IN', sessionFor('ana@example.com'));
        await rendered();
        expect(mainContent(), 'signing in').toEqual([['P', 'status', 'Loading…']]);
        release();
        await stable();
        expect(navigate).toHaveBeenCalledWith('/plan', { replaceUrl: true });
        expect(TestBed.inject(Router).url).toBe('/plan');
        expect(pickedNames(), 'account plan').toEqual(['Spaghetti carbonara', 'Fish tacos']);
      });

      it(`holds only the alert "${LOAD_FAILED}" in <main>, no page and no "Loading…", when the load rejects (#45 6)`, async () => {
        fake.readError = DATA_FAILED;
        fake.load(sessionFor('ana@example.com'));
        await open('/plan');

        expect(mainContent()).toEqual([['P', 'alert', LOAD_FAILED]]);
        expect(compiled.querySelector('main h1')).toBeNull();
      });

      it(`shows the pick and the alert "${SAVE_FAILED}" between the header and <main> when the write of a pick rejects, and no alert once a later write resolves (#45 7)`, async () => {
        fake.load(sessionFor('ana@example.com'));
        await open('/plan');
        fake.writeError = DATA_FAILED;

        const lunch = suggestionButtons(0)[0];
        const name = textOf(lunch.querySelector('.name')!);
        await click(lunch);
        expect(pickedNames()).toEqual([name]);
        const alert = saveAlert();
        expect(alert, 'no alert').not.toBeNull();
        expect(alert!.tagName).toBe('P');
        expect(textOf(alert!)).toBe(SAVE_FAILED);
        expect(alert!.previousElementSibling?.tagName, 'before the alert').toBe('HEADER');
        expect(alert!.nextElementSibling?.tagName, 'after the alert').toBe('MAIN');

        fake.writeError = null;
        await click(suggestionButtons(0)[0]);
        expect(pickedNames().length).toBe(2);
        expect(saveAlert(), 'after a saved pick').toBeNull();
      });

      it('shows the browser\'s plan and own recipe "Quick Dal" again, and leaves them unchanged in localStorage, after signing in, picking a meal in the account and signing out (#45 9)', async () => {
        localStorage.setItem('fooplan.plan', JSON.stringify(browserPlan));
        storeOwnRecipes(QUICK_DAL);
        const stored = [localStorage.getItem('fooplan.plan'), localStorage.getItem(RECIPES_KEY)];
        fake.load(null);
        await open('/plan');
        expect(pickedNames(), 'browser plan').toEqual(['Pizza toast', 'Potato goulash']);

        fake.emit('SIGNED_IN', sessionFor('ana@example.com'));
        await stable();
        expect(pickedNames(), 'account plan').toEqual([]);
        expect(
          TestBed.inject(RecipeStore).bySlug('quick-dal'),
          'own recipe signed in',
        ).toBeUndefined();
        await click(suggestionButtons(0)[0]);
        expect(pickedNames().length, 'picked in the account').toBe(1);

        await click(buttonIn(accountGroup(), 'Sign out'));
        expect(pickedNames(), 'browser plan again').toEqual(['Pizza toast', 'Potato goulash']);
        await TestBed.inject(Router).navigateByUrl('/recipes');
        await stable();
        const own = Array.from(compiled.querySelectorAll('main article')).filter((card) =>
          textOf(card).includes('Your recipe'),
        );
        expect(own.map((card) => textOf(card.querySelector('h2')!))).toEqual(['Quick Dal']);
        expect([localStorage.getItem('fooplan.plan'), localStorage.getItem(RECIPES_KEY)]).toEqual(
          stored,
        );
      });

      describe('edge cases', () => {
        it("shows none of the browser's plan, removed recipes or own recipes for a session whose account has no rows, and leaves localStorage as it was (#45 4a)", async () => {
          localStorage.setItem('fooplan.plan', JSON.stringify(browserPlan));
          localStorage.setItem('fooplan.removed', JSON.stringify(['Niçoise salad']));
          storeOwnRecipes(QUICK_DAL);
          const stored = { ...localStorage };
          fake.load(sessionFor('ana@example.com'));
          await open('/plan');

          expect(pickedNames()).toEqual([]);
          await TestBed.inject(Router).navigateByUrl('/recipes');
          await stable();
          expect(textOf(compiled.querySelector('main')!)).not.toContain('Not suggested');
          expect(textOf(compiled.querySelector('main')!)).not.toContain('Quick Dal');
          expect({ ...localStorage }).toEqual(stored);
        });

        it('stays on the page and loads nothing again when the client reports a refreshed session of the same user (#45 5a)', async () => {
          fake.load(sessionFor('ana@example.com'));
          await open('/recipes');
          const queried = fake.tables.length;
          const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');

          fake.emit('TOKEN_REFRESHED', sessionFor('ana@example.com', 'new-token'));
          await stable();
          fake.emit('SIGNED_IN', sessionFor('ana@example.com', 'new-token'));
          await stable();
          expect(navigate).not.toHaveBeenCalled();
          expect(TestBed.inject(Router).url).toBe('/recipes');
          expect(fake.tables.length, 'read again').toBe(queried);
        });

        it('stays on the page of a reload while signed in, reading each key from the account once (#45 5b)', async () => {
          const reads: string[] = [];
          fake.beforeRead = (key) => {
            reads.push(key);
            return Promise.resolve();
          };
          fake.load(sessionFor('ana@example.com'));
          await open('/recipes');

          expect(TestBed.inject(Router).url).toBe('/recipes');
          expect(compiled.querySelector('main h1')?.textContent?.trim()).toBe('Recipes');
          expect(reads.sort()).toEqual(['fooplan.plan', 'fooplan.recipes', 'fooplan.removed']);
        });

        it('says "Deine Daten konnten nicht geladen werden. Prüf deine Verbindung und lade die Seite neu." when the load rejects in German (#45 6a)', async () => {
          localStorage.setItem(LANGUAGE_KEY, 'de');
          fake.readError = DATA_FAILED;
          fake.load(sessionFor('ana@example.com'));
          await open('/plan');

          expect(mainContent()).toEqual([
            [
              'P',
              'alert',
              'Deine Daten konnten nicht geladen werden. Prüf deine Verbindung und lade die Seite neu.',
            ],
          ]);
        });

        it('shows "Loading…" and then the Plan page from localStorage when "Sign out" is clicked after a failed load (#45 6b)', async () => {
          localStorage.setItem('fooplan.plan', JSON.stringify(browserPlan));
          fake.readError = DATA_FAILED;
          fake.load(sessionFor('ana@example.com'));
          await open('/recipes');
          expect(mainContent(), 'failed').toEqual([['P', 'alert', LOAD_FAILED]]);

          const release = holdReads();
          const signOut = buttonIn(accountGroup(), 'Sign out');
          signOut.focus();
          signOut.click();
          await rendered();
          expect(mainContent(), 'signing out').toEqual([['P', 'status', 'Loading…']]);
          release();
          await stable();
          expect(TestBed.inject(Router).url).toBe('/plan');
          expect(pickedNames()).toEqual(['Pizza toast', 'Potato goulash']);
        });

        it('shows the alert and no page for a recipe link opened directly when the load rejects, keeping its URL, and the navigation does not fail (#45 6c)', async () => {
          fake.readError = DATA_FAILED;
          fake.load(sessionFor('ana@example.com'));
          fixture = TestBed.createComponent(App);
          compiled = fixture.nativeElement as HTMLElement;

          await expect(TestBed.inject(Router).navigateByUrl('/recipes/quick-dal')).resolves.toBe(
            true,
          );
          await stable();
          expect(mainContent()).toEqual([['P', 'alert', LOAD_FAILED]]);
          expect(TestBed.inject(Location).path(), 'URL kept for a reload').toBe(
            '/recipes/quick-dal',
          );
        });

        it('shows the load alert when the code of the stores fails to download, and loads once the session changes (#45 6d)', async () => {
          let imports = 0;
          TestBed.overrideProvider(IMPORT_PLAN_STORE, {
            useValue: () =>
              imports++ === 0
                ? Promise.reject(new TypeError('Failed to fetch dynamically imported module'))
                : import('./plan/plan-store').then((m) => m.PlanStore),
          });
          fake.load(null);
          await open('/plan');
          expect(mainContent(), 'failed').toEqual([['P', 'alert', LOAD_FAILED]]);

          fake.emit('SIGNED_IN', sessionFor('ana@example.com'));
          await stable();
          expect(TestBed.inject(Router).url).toBe('/plan');
          expect(compiled.querySelector('main h1')?.textContent?.trim()).toBe('Plan');
        });

        it('loads the account when the client reports a sign-in after the first load read the browser, before the app first rendered (#45 5c)', async () => {
          localStorage.setItem('fooplan.plan', JSON.stringify(browserPlan));
          fake.saveRow('fooplan.plan', accountPlan);
          fixture = TestBed.createComponent(App);
          compiled = fixture.nativeElement as HTMLElement;
          fake.load(null);
          await TestBed.inject(PlanStore).load();
          expect(TestBed.inject(PlanStore).plan(), 'first load').toEqual(browserPlan);

          fake.emit('SIGNED_IN', sessionFor('ana@example.com'));
          await stable();
          expect(TestBed.inject(Router).url).toBe('/plan');
          expect(pickedNames()).toEqual(['Spaghetti carbonara', 'Fish tacos']);
        });

        it('hides the save alert once "Sign out" has loaded the browser\'s data (#45 7j)', async () => {
          // A saved browser plan loads without a write, so only the sign-out hides the alert
          localStorage.setItem('fooplan.plan', JSON.stringify(browserPlan));
          fake.load(sessionFor('ana@example.com'));
          await open('/plan');
          fake.writeError = DATA_FAILED;
          await click(suggestionButtons(0)[0]);
          expect(saveAlert(), 'after the failed save').not.toBeNull();

          await click(buttonIn(accountGroup(), 'Sign out'));
          expect(TestBed.inject(Router).url).toBe('/plan');
          expect(saveAlert(), 'after signing out').toBeNull();
        });

        it.each(['/recipes/nope', '/recipes/nope/edit'])(
          'goes to the Recipes page, replacing the URL, for %s opened when the recipes failed to load and a later load succeeded (#45 6e)',
          async (url) => {
            const importStore = deferred<void>();
            TestBed.overrideProvider(IMPORT_PLAN_STORE, {
              useValue: () =>
                importStore.promise.then(() =>
                  import('./plan/plan-store').then((m) => m.PlanStore),
                ),
            });
            let recipeReads = 0;
            fake.beforeRead = (key) =>
              key === 'fooplan.recipes' && recipeReads++ === 0
                ? Promise.reject(DATA_FAILED)
                : Promise.resolve();
            fake.load(sessionFor('ana@example.com'));
            fixture = TestBed.createComponent(App);
            compiled = fixture.nativeElement as HTMLElement;
            const router = TestBed.inject(Router);
            await router.navigateByUrl(url);
            expect(recipeReads, 'the guard read the recipes').toBe(1);
            const navigate = vi.spyOn(router, 'navigateByUrl');

            importStore.resolve();
            await stable();
            expect(router.url).toBe('/recipes');
            expect(navigate).toHaveBeenLastCalledWith('/recipes', { replaceUrl: true });
            expect(compiled.querySelector('main h1')?.textContent?.trim()).toBe('Recipes');
          },
        );

        it.each(['/recipes/ana-dal', '/recipes/ana-dal/edit'])(
          'goes to the Plan page with the browser\'s plan when "Sign out" is clicked on %s, an own recipe of the account only (#45 5d)',
          async (url) => {
            localStorage.setItem('fooplan.plan', JSON.stringify(browserPlan));
            fake.saveRow('fooplan.recipes', [
              {
                name: 'Ana Dal',
                servings: 4,
                ingredients: [{ name: 'onion', amount: 1, unit: 'pc' }],
              },
            ]);
            fake.load(sessionFor('ana@example.com'));
            await open(url);
            expect(TestBed.inject(Router).url, 'opened').toBe(url);

            await click(buttonIn(accountGroup(), 'Sign out'));
            expect(TestBed.inject(Router).url).toBe('/plan');
            expect(pickedNames()).toEqual(['Pizza toast', 'Potato goulash']);
          },
        );

        it('says "Deine letzte Änderung konnte nicht gespeichert werden. Prüf deine Verbindung und versuch es noch einmal." when a write rejects in German (#45 7a)', async () => {
          localStorage.setItem(LANGUAGE_KEY, 'de');
          fake.load(sessionFor('ana@example.com'));
          await open('/plan');
          fake.writeError = DATA_FAILED;

          await click(suggestionButtons(0)[0]);
          expect(textOf(saveAlert()!)).toBe(
            'Deine letzte Änderung konnte nicht gespeichert werden. Prüf deine Verbindung und versuch es noch einmal.',
          );
        });

        it('shows no save alert signed out, also when localStorage refuses the write (#45 7b)', async () => {
          fake.load(null);
          await open('/plan');
          vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('quota exceeded', 'QuotaExceededError');
          });

          await click(suggestionButtons(0)[0]);
          expect(pickedNames().length).toBe(1);
          expect(saveAlert()).toBeNull();
          expect(compiled.querySelector('[role="alert"]')).toBeNull();
        });
      });

      // Reads wait until the returned function is called, so "Loading…" can be seen
      function holdReads(): () => void {
        const held = deferred<void>();
        const read = SessionBackend.prototype.read;
        const spy = vi.spyOn(SessionBackend.prototype, 'read').mockImplementation(async function (
          this: SessionBackend,
          key: string,
        ) {
          await held.promise;
          return read.call(this, key);
        });
        return () => {
          spy.mockRestore();
          held.resolve();
        };
      }

      // While a load is held the fixture never becomes stable: the render is run here instead
      async function rendered() {
        for (let i = 0; i < 3; i++) {
          await new Promise((resolve) => setTimeout(resolve));
          TestBed.tick();
        }
      }

      function mainContent(): (string | null)[][] {
        return Array.from(compiled.querySelector('main')!.children).map((child) => [
          child.tagName,
          child.getAttribute('role'),
          textOf(child),
        ]);
      }

      function pickedNames(): string[] {
        return Array.from(compiled.querySelectorAll('main .meal .recipe a.name')).map((name) =>
          textOf(name),
        );
      }

      function suggestionButtons(dayIndex: number): HTMLButtonElement[] {
        return Array.from(
          compiled
            .querySelectorAll('main section.day')
            [dayIndex].querySelectorAll<HTMLButtonElement>('button.suggestion'),
        );
      }

      function saveAlert(): HTMLElement | null {
        return compiled.querySelector<HTMLElement>(':scope > [role="alert"]');
      }
    });

    async function open(url: string) {
      fixture = TestBed.createComponent(App);
      compiled = fixture.nativeElement as HTMLElement;
      await TestBed.inject(Router).navigateByUrl(url);
      await stable();
    }

    // As the app starts on the link's URL: bootstrapping runs the router's first navigation, which
    // also makes it follow popstate
    async function openOnLink() {
      history.replaceState(null, '', '/#access_token=token&type=magiclink');
      fixture = TestBed.createComponent(App);
      compiled = fixture.nativeElement as HTMLElement;
      TestBed.inject(Router).initialNavigation();
      await stable();
    }

    // As the client does once it has signed in from the URL; jsdom fires popstate for it, as a
    // browser does, and the router follows it from a timer
    async function clearLink() {
      location.hash = '';
      await stable();
      await stable();
    }

    // jsdom doesn't focus what is clicked, unlike a browser
    async function click(target: HTMLElement) {
      target.focus();
      target.click();
      await stable();
    }

    // The fake client answers in promises, whose renders come after the microtasks they start
    async function stable() {
      await new Promise((resolve) => setTimeout(resolve));
      await fixture.whenStable();
    }

    function accountGroup(name = 'Account'): HTMLElement {
      const group = findAccountGroup(name);
      expect(group, `no "${name}" group in the header`).not.toBeNull();
      return group!;
    }

    function findAccountGroup(name = 'Account'): HTMLElement | null {
      return compiled.querySelector<HTMLElement>(`header [role="group"][aria-label="${name}"]`);
    }

    function buttonIn(group: HTMLElement, text: string): HTMLButtonElement {
      const button = Array.from(group.querySelectorAll('button')).find(
        (candidate) => textOf(candidate) === text,
      );
      expect(button, `no "${text}" button`).toBeDefined();
      return button!;
    }

    function childTexts(target: Element): string[] {
      return Array.from(target.children).map((child) => textOf(child));
    }

    function textOf(target: Element): string {
      return target.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    }
  });
});
