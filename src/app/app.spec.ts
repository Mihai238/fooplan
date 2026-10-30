import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { FakeSupabase, provideSupabase, sessionFor, SIGN_OUT_FAILED } from './auth/testing';
import { LanguageStore } from './language-store';
import { PlanStore } from './plan/plan-store';
import { day, open, picked, planOf } from './plan/testing';
import { RecipeStore } from './recipes/recipe-store';
import { QUICK_DAL, RECIPES_KEY, storeOwnRecipes } from './recipes/testing';
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

    it('stays on the Recipes page as it was when "Sign out" is clicked, and shows "Sign in" with the focus (#43 8)', async () => {
      fake.load(sessionFor('ana@example.com'));
      await open('/recipes');
      const search = compiled.querySelector<HTMLInputElement>('main input[type="search"]')!;
      search.value = 'pasta';
      search.dispatchEvent(new Event('input', { bubbles: true }));
      await stable();
      const shown = compiled.querySelectorAll('main article').length;

      await click(buttonIn(accountGroup(), 'Sign out'));
      expect(fake.signOuts.length, 'signed out').toBe(1);
      expect(TestBed.inject(Router).url).toBe('/recipes');
      expect(compiled.querySelector('main input[type="search"]'), 'search field kept').toBe(search);
      expect(search.value).toBe('pasta');
      expect(compiled.querySelectorAll('main article').length, 'recipes shown').toBe(shown);
      const link = accountGroup().querySelector('a');
      expect(textOf(accountGroup())).toBe('Sign in');
      expect(document.activeElement, 'focus after "Sign out"').toBe(link);
    });

    it('keeps a picked plan and an own recipe, in the stores and in localStorage, when the user signs in and out (#43 10)', async () => {
      storeOwnRecipes(QUICK_DAL);
      const saved = planOf([day('2026-10-24', picked('Spaghetti carbonara'), picked('Quick Dal'))]);
      localStorage.setItem('fooplan.plan', JSON.stringify(saved));
      fake.load(null);
      await open('/plan');
      const plan = TestBed.inject(PlanStore).plan();
      expect(plan.days[0].dinner.recipe, 'saved plan not loaded').toBe('Quick Dal');
      const stored = [localStorage.getItem('fooplan.plan'), localStorage.getItem(RECIPES_KEY)];

      fake.emit('SIGNED_IN', sessionFor('ana@example.com'));
      await stable();
      expect(childTexts(accountGroup()), 'signed in').toEqual(['ana@example.com', 'Sign out']);
      expect(TestBed.inject(PlanStore).plan(), 'plan after signing in').toEqual(plan);

      await click(buttonIn(accountGroup(), 'Sign out'));
      expect(textOf(accountGroup()), 'signed out').toBe('Sign in');
      expect(TestBed.inject(PlanStore).plan(), 'plan after signing out').toEqual(plan);
      expect(TestBed.inject(RecipeStore).bySlug('quick-dal')?.name).toBe('Quick Dal');
      expect([localStorage.getItem('fooplan.plan'), localStorage.getItem(RECIPES_KEY)]).toEqual(
        stored,
      );
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
