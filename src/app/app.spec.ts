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
        expect(compiled.querySelector('header button.account-button')).not.toBeNull();
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

  describe('account (#43)', () => {
    let fixture: ComponentFixture<App>;
    let compiled: HTMLElement;

    afterEach(() => {
      vi.restoreAllMocks();
      history.replaceState(null, '', '/');
      document.documentElement.lang = 'en';
    });

    it('shows only the language in the account menu until the client has returned the saved session, and then "Sign in" (#43 2)', async () => {
      await open('/plan');
      expect(linesOf(await openMenu()), 'before the session is read').toEqual([
        'English',
        'Deutsch',
      ]);
      await click(accountButton());

      fake.load(null);
      await stable();
      expect(linesOf(await openMenu())).toEqual(['English', 'Deutsch', 'Sign in']);
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
      expect(linesOf(await openMenu())).toEqual([
        'ana@example.com',
        'English',
        'Deutsch',
        'Sign out',
      ]);
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
      it('shows neither "Sign in" nor the email in the account menu until a saved session is returned, and then the email and "Sign out" (#43 2a)', async () => {
        await open('/plan');
        const menu = await openMenu();
        expect(textOf(menu)).not.toContain('Sign in');
        expect(textOf(menu)).not.toContain('ana@example.com');
        await click(accountButton());

        fake.load(sessionFor('ana@example.com'));
        await stable();
        expect(linesOf(await openMenu())).toEqual([
          'ana@example.com',
          'English',
          'Deutsch',
          'Sign out',
        ]);
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
    });

    describe('account menu (#51)', () => {
      it('ends the header with the button "Account", collapsed, controlling #account-menu and holding only a hidden icon, shows neither the language nor the account in the header, tabs through "Fooplan", "Plan", "Grocery list", "Recipes", the account button and then the page, and names the button "Konto" in German (#51 1)', async () => {
        fake.load(null);
        await open('/plan');
        const header = compiled.querySelector('header')!;
        const button = accountButton();
        expect(header.lastElementChild, 'last in the header').toBe(button);
        expect([
          button.type,
          nameOf(button),
          button.getAttribute('aria-haspopup'),
          button.getAttribute('aria-expanded'),
          button.getAttribute('aria-controls'),
        ]).toEqual(['button', 'Account', 'menu', 'false', 'account-menu']);
        expect(button.querySelector('svg')?.getAttribute('aria-hidden'), 'icon').toBe('true');
        expect(textOf(button), 'text in the button').toBe('');
        expect(header.querySelector('[role="group"]'), 'a group in the header').toBeNull();
        expect(textOf(header)).toBe('Fooplan Plan Grocery list Recipes');

        const tabbable = Array.from(compiled.querySelectorAll<HTMLElement>(TABBABLE)).filter(
          (candidate) => !candidate.closest('dialog'),
        );
        expect(tabbable.slice(0, 5).map(nameOf)).toEqual([
          'Fooplan',
          'Plan',
          'Grocery list',
          'Recipes',
          'Account',
        ]);
        expect(tabbable[4], 'the account button').toBe(button);
        expect(tabbable[5]?.closest('main'), 'the page after the account button').not.toBeNull();

        TestBed.inject(LanguageStore).set('de');
        await stable();
        expect(nameOf(accountButton()), 'German').toBe('Konto');
      });

      it('opens #account-menu right after the button, named by it, with only the group "Language" of "English", checked and marked ✓, and "Deutsch" before the session is read, expanding the button and focusing "English" (#51 2)', async () => {
        await open('/plan');
        const button = accountButton();
        await click(button);
        const menu = shownMenu();
        expect(menu.getAttribute('role')).toBe('menu');
        expect(button.nextElementSibling, 'after the button').toBe(menu);
        expect(
          document.getElementById(menu.getAttribute('aria-labelledby') ?? ''),
          'named by',
        ).toBe(button);
        expect(contentOf(menu)).toEqual([['DIV', 'group', 'Language']]);
        expect(
          itemsOf(menu).map((item) => [
            item.tagName,
            item.getAttribute('type'),
            item.getAttribute('role'),
            nameOf(item),
            item.getAttribute('aria-checked'),
          ]),
        ).toEqual([
          ['BUTTON', 'button', 'menuitemradio', 'English', 'true'],
          ['BUTTON', 'button', 'menuitemradio', 'Deutsch', 'false'],
        ]);
        const [english, deutsch] = itemsOf(menu);
        expect(
          english.querySelector('[aria-hidden="true"]')?.textContent?.trim(),
          '"English"',
        ).toBe('✓');
        expect(textOf(deutsch), '"Deutsch"').not.toContain('✓');
        expect(button.getAttribute('aria-expanded')).toBe('true');
        expect(document.activeElement, 'focus').toBe(english);
      });

      it('holds the language group, a separator and the link "Sign in" to /sign-in without a session, and the email line, a separator, the language group, a separator and the button "Sign out" with the session of "ana@example.com", with "Sprache", "Anmelden" and "Abmelden" in German (#51 3)', async () => {
        fake.load(null);
        await open('/plan');
        let menu = await openMenu();
        expect(contentOf(menu), 'no session').toEqual([
          ['DIV', 'group', 'Language'],
          ['DIV', 'separator', ''],
          ['A', 'menuitem', 'Sign in'],
        ]);
        expect(itemIn(menu, 'Sign in').getAttribute('href')).toBe('/sign-in');
        await click(accountButton());
        TestBed.inject(LanguageStore).set('de');
        await stable();
        expect(contentOf(await openMenu()), 'no session, German').toEqual([
          ['DIV', 'group', 'Sprache'],
          ['DIV', 'separator', ''],
          ['A', 'menuitem', 'Anmelden'],
        ]);
        await click(accountButton());

        fake.emit('SIGNED_IN', sessionFor('ana@example.com'));
        await stable();
        expect(contentOf(await openMenu()), 'session, German').toEqual([
          ['P', 'none', 'ana@example.com'],
          ['DIV', 'separator', ''],
          ['DIV', 'group', 'Sprache'],
          ['DIV', 'separator', ''],
          ['BUTTON', 'menuitem', 'Abmelden'],
        ]);
        await click(accountButton());
        TestBed.inject(LanguageStore).set('en');
        await stable();
        menu = await openMenu();
        expect(contentOf(menu), 'session').toEqual([
          ['P', 'none', 'ana@example.com'],
          ['DIV', 'separator', ''],
          ['DIV', 'group', 'Language'],
          ['DIV', 'separator', ''],
          ['BUTTON', 'menuitem', 'Sign out'],
        ]);
        expect(menu.firstElementChild?.classList, 'email line').toContain('account-email');
        expect(itemIn(menu, 'Sign out').getAttribute('type')).toBe('button');
      });

      it('moves the focus with ArrowDown from "English" to "Deutsch", "Sign in" and back to "English", with ArrowUp from "English" to "Sign in", and with Home and End to the first and last item, and opens the closed menu with ArrowUp on the button with the focus on "Sign in" (#51 4)', async () => {
        fake.load(null);
        await open('/plan');
        await click(accountButton());
        expect(focusedName(), 'opened').toBe('English');
        expect(
          await focusAfter(['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowUp', 'Home', 'End']),
        ).toEqual(['Deutsch', 'Sign in', 'English', 'Sign in', 'English', 'Sign in']);

        await press('Escape');
        expect(accountMenu(), 'closed').toBeNull();
        await press('ArrowUp');
        expect(accountMenu(), 'ArrowUp on the button').not.toBeNull();
        expect(focusedName(), 'ArrowUp on the button').toBe('Sign in');
      });

      it('closes on Escape with the focus on the button, on a pointerdown on <main> and on the focus moving to the brand without moving the focus to the button, and on a click on the button with the focus staying on it (#51 5)', async () => {
        fake.load(null);
        await open('/plan');
        const button = accountButton();

        await click(button);
        await press('Escape');
        expect(accountMenu(), 'Escape').toBeNull();
        expect(button.getAttribute('aria-expanded'), 'Escape').toBe('false');
        expect(document.activeElement, 'Escape').toBe(button);

        await click(button);
        await pointerDown(compiled.querySelector('main')!);
        expect(accountMenu(), 'pointerdown on <main>').toBeNull();
        expect(button.getAttribute('aria-expanded'), 'pointerdown on <main>').toBe('false');
        expect(document.activeElement, 'pointerdown on <main>').not.toBe(button);

        await click(button);
        const brand = compiled.querySelector<HTMLElement>('header a.brand')!;
        brand.focus();
        await stable();
        expect(accountMenu(), 'focus on the brand').toBeNull();
        expect(document.activeElement, 'focus on the brand').toBe(brand);

        await click(button);
        await click(button);
        expect(accountMenu(), 'second click').toBeNull();
        expect(button.getAttribute('aria-expanded'), 'second click').toBe('false');
        expect(document.activeElement, 'second click').toBe(button);
      });

      it('switches to German when "Deutsch" is clicked, saving de, closing the menu and focusing the button, and writes nothing to localStorage but closes the menu on Enter on the checked "Deutsch" (#51 6)', async () => {
        fake.load(null);
        await open('/plan');
        await click(accountButton());
        await click(itemIn(shownMenu(), 'Deutsch'));
        expect(navTexts()).toEqual(['Plan', 'Einkaufsliste', 'Rezepte']);
        expect(localStorage.getItem(LANGUAGE_KEY)).toBe('de');
        expect(accountMenu(), 'after "Deutsch"').toBeNull();
        expect(document.activeElement, 'after "Deutsch"').toBe(accountButton());

        await click(accountButton());
        const setItem = vi.spyOn(Storage.prototype, 'setItem');
        itemIn(shownMenu(), 'Deutsch').focus();
        await press('Enter');
        expect(setItem.mock.calls.filter(([key]) => key === LANGUAGE_KEY)).toEqual([]);
        expect(accountMenu(), 'after Enter on the checked "Deutsch"').toBeNull();
        expect(document.activeElement, 'after Enter on the checked "Deutsch"').toBe(
          accountButton(),
        );
        expect(navTexts(), 'still German').toEqual(['Plan', 'Einkaufsliste', 'Rezepte']);
      });

      it('keeps the session when signing out with "Sign out" fails, and signs out to the Plan page from the Recipes page once it succeeds, closing the menu and focusing the account button each time (#51 7)', async () => {
        fake.load(sessionFor('ana@example.com'));
        fake.signOutResult = () => Promise.resolve(SIGN_OUT_FAILED);
        await open('/recipes');
        await click(await signOutItem());
        expect(fake.signOuts.length, 'failed').toBe(1);
        expect(accountMenu(), 'failed').toBeNull();
        expect(document.activeElement, 'failed').toBe(accountButton());
        expect(TestBed.inject(Router).url, 'failed').toBe('/recipes');
        expect(linesOf(await openMenu()), 'failed').toEqual([
          'ana@example.com',
          'English',
          'Deutsch',
          'Sign out',
        ]);
        await press('Escape');

        fake.signOutResult = () => Promise.resolve({ error: null });
        await click(await signOutItem());
        expect(fake.signOuts.length, 'signed out').toBe(2);
        expect(TestBed.inject(Router).url).toBe('/plan');
        expect(compiled.querySelector('main h1')?.textContent?.trim()).toBe('Plan');
        expect(accountMenu(), 'signed out').toBeNull();
        expect(document.activeElement, 'signed out').toBe(accountButton());
      });

      it('goes to /sign-in and closes the menu on Enter on "Sign in" (#51 8)', async () => {
        fake.load(null);
        await open('/plan');
        await click(accountButton());
        itemIn(shownMenu(), 'Sign in').focus();
        await press('Enter');
        expect(TestBed.inject(Router).url).toBe('/sign-in');
        expect(accountMenu()).toBeNull();
      });

      it('closes the menu with the focus on the button on Tab and on Shift+Tab, without preventing the keydown, and keeps the items out of the tab order (#51 9)', async () => {
        fake.load(null);
        await open('/plan');
        for (const shiftKey of [false, true]) {
          const key = shiftKey ? 'Shift+Tab' : 'Tab';
          await click(accountButton());
          // jsdom doesn't move the focus on Tab: a browser moves it on from the button only past
          // items it can't tab to
          expect(tabbableIn(shownMenu()), key).toEqual([]);
          const keydown = await press('Tab', { shiftKey });
          expect(keydown.defaultPrevented, key).toBe(false);
          expect(accountMenu(), key).toBeNull();
          expect(document.activeElement, key).toBe(accountButton());
        }
      });

      describe('edge cases', () => {
        it('shows neither the email nor "Sign out" in the header with a session (#51 1a)', async () => {
          fake.load(sessionFor('ana@example.com'));
          await open('/plan');
          expect(nameOf(accountButton())).toBe('Account');
          expect(textOf(compiled.querySelector('header')!)).toBe(
            'Fooplan Plan Grocery list Recipes',
          );
        });

        it('renders the account button, collapsed and last in the header, before the client has returned the saved session (#51 1b)', async () => {
          await open('/plan');
          const button = accountButton();
          expect(nameOf(button)).toBe('Account');
          expect(button.getAttribute('aria-expanded')).toBe('false');
          expect(compiled.querySelector('header')!.lastElementChild).toBe(button);
        });

        it('opens the menu once, with the focus on "English", on Enter and on Space on the closed button (#51 2a)', async () => {
          fake.load(null);
          await open('/plan');
          for (const key of ['Enter', ' ']) {
            const name = key === ' ' ? 'Space' : key;
            accountButton().focus();
            await press(key);
            expect(accountMenu(), name).not.toBeNull();
            expect(accountButton().getAttribute('aria-expanded'), name).toBe('true');
            expect(focusedName(), name).toBe('English');
            await press('Escape');
          }
        });

        it('skips the email line and the separators: ArrowUp from "English" goes to "Sign out", ArrowDown from "Sign out" and Home to "English" (#51 4a)', async () => {
          fake.load(sessionFor('ana@example.com'));
          await open('/plan');
          await click(accountButton());
          expect(focusedName(), 'opened').toBe('English');
          expect(
            await focusAfter(['ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'Home', 'End']),
          ).toEqual(['Sign out', 'English', 'Deutsch', 'Sign out', 'English', 'Sign out']);
        });

        it('opens the closed menu with ArrowDown on the button, with the focus on "English" and not on the email line (#51 4b)', async () => {
          fake.load(sessionFor('ana@example.com'));
          await open('/plan');
          accountButton().focus();
          await press('ArrowDown');
          expect(accountMenu(), 'not opened').not.toBeNull();
          expect(accountButton().getAttribute('aria-expanded')).toBe('true');
          expect(focusedName()).toBe('English');
        });

        it('moves between "English" and "Deutsch" only before the session is read: ArrowUp on the button opens on "Deutsch", the arrows wrap, Home and End go to them, and Escape closes with the focus on the button (#51 4c)', async () => {
          await open('/plan');
          accountButton().focus();
          await press('ArrowUp');
          expect(focusedName(), 'ArrowUp on the button').toBe('Deutsch');
          expect(await focusAfter(['ArrowDown', 'ArrowDown', 'End', 'Home', 'ArrowUp'])).toEqual([
            'English',
            'Deutsch',
            'Deutsch',
            'English',
            'Deutsch',
          ]);
          await press('Escape');
          expect(accountMenu(), 'Escape').toBeNull();
          expect(document.activeElement, 'Escape').toBe(accountButton());
        });

        it('prevents the default of ArrowDown, ArrowUp, Home and End in the menu, and not of Tab (#51 4d)', async () => {
          fake.load(null);
          await open('/plan');
          await click(accountButton());
          const prevented: [string, boolean][] = [];
          for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Tab']) {
            prevented.push([key, (await press(key)).defaultPrevented]);
          }
          expect(prevented).toEqual([
            ['ArrowDown', true],
            ['ArrowUp', true],
            ['Home', true],
            ['End', true],
            ['Tab', false],
          ]);
        });

        // The focus goes to nothing when Safari presses the account button, which it doesn't focus,
        // or when the window loses the focus
        it('stays open when the focus leaves an item for nothing, so a click on "Deutsch" after it still switches to German (#51 5a)', async () => {
          fake.load(null);
          await open('/plan');
          await click(accountButton());
          (document.activeElement as HTMLElement).blur();
          await stable();
          expect(accountMenu(), 'focus left for nothing').not.toBeNull();

          itemIn(shownMenu(), 'Deutsch').click();
          await stable();
          expect(TestBed.inject(LanguageStore).language()).toBe('de');
          expect(accountMenu(), 'after "Deutsch"').toBeNull();
        });

        it('stays open on a pointerdown on an item, and closes, not to open again, on a press on the button: pointerdown, focus, click (#51 5b)', async () => {
          fake.load(null);
          await open('/plan');
          const button = accountButton();
          await click(button);
          await pointerDown(itemIn(shownMenu(), 'Deutsch'));
          expect(accountMenu(), 'pointerdown on an item').not.toBeNull();

          await pointerDown(button);
          button.focus();
          await stable();
          expect(accountMenu(), 'pointerdown on the button, focus on it').not.toBeNull();
          button.click();
          await stable();
          expect(accountMenu(), 'click on the button').toBeNull();
          expect(button.getAttribute('aria-expanded')).toBe('false');
          expect(document.activeElement).toBe(button);
        });

        // A browser focuses the closest focusable ancestor of what is pressed
        it('keeps the keys working after a press on the email line or the menu outside an item: Escape closes with the focus on the button, ArrowUp from the menu goes to the last item and ArrowDown to the first (#51 5d)', async () => {
          fake.load(sessionFor('ana@example.com'));
          await open('/plan');
          await click(accountButton());
          await pressOnMenu(shownMenu().querySelector<HTMLElement>('.account-email')!);
          expect(document.activeElement, 'press on the email line').toBe(shownMenu());
          await press('Escape');
          expect(accountMenu(), 'Escape').toBeNull();
          expect(document.activeElement, 'Escape').toBe(accountButton());

          await click(accountButton());
          await pressOnMenu(shownMenu());
          await press('ArrowUp');
          expect(focusedName(), 'ArrowUp from the menu').toBe('Sign out');
          await pressOnMenu(shownMenu().querySelector<HTMLElement>('[role="separator"]')!);
          await press('ArrowDown');
          expect(focusedName(), 'ArrowDown from the menu').toBe('English');

          async function pressOnMenu(target: HTMLElement) {
            await pointerDown(target);
            shownMenu().focus();
            await stable();
            expect(accountMenu(), 'pressed').not.toBeNull();
          }
        });

        it('writes nothing to localStorage, signs nothing out and stays on the page when the menu is opened and closed by Escape, a click on the button and a pointerdown outside (#51 5c)', async () => {
          fake.load(sessionFor('ana@example.com'));
          await open('/recipes');
          const setItem = vi.spyOn(Storage.prototype, 'setItem');
          const removeItem = vi.spyOn(Storage.prototype, 'removeItem');

          await click(accountButton());
          await press('Escape');
          await click(accountButton());
          await click(accountButton());
          await click(accountButton());
          await pointerDown(compiled.querySelector('main')!);
          expect(setItem).not.toHaveBeenCalled();
          expect(removeItem).not.toHaveBeenCalled();
          expect(fake.signOuts).toEqual([]);
          expect(TestBed.inject(LanguageStore).language()).toBe('en');
          expect(TestBed.inject(Router).url).toBe('/recipes');
          expect(linesOf(await openMenu())).toEqual([
            'ana@example.com',
            'English',
            'Deutsch',
            'Sign out',
          ]);
        });

        it('closes the menu and focuses the account button as soon as "Sign out" is clicked, while the client is still signing out (#51 7a)', async () => {
          const signingOut = deferred<{ error: null }>();
          fake.signOutResult = () => signingOut.promise;
          fake.load(sessionFor('ana@example.com'));
          await open('/recipes');
          await click(await signOutItem());
          expect(fake.signOuts.length, 'signing out').toBe(1);
          expect(accountMenu(), 'while signing out').toBeNull();
          expect(document.activeElement, 'while signing out').toBe(accountButton());

          signingOut.resolve({ error: null });
          await stable();
          expect(TestBed.inject(Router).url).toBe('/plan');
          expect(document.activeElement, 'signed out').toBe(accountButton());
        });
      });

      // The name of the item focused after each key
      async function focusAfter(keys: string[]): Promise<string[]> {
        const focused: string[] = [];
        for (const key of keys) {
          await press(key);
          focused.push(focusedName());
        }
        return focused;
      }

      function focusedName(): string {
        const focused = document.activeElement;
        return !focused || focused === document.body ? '<body>' : nameOf(focused);
      }

      async function pointerDown(target: HTMLElement) {
        target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
        await stable();
      }

      // TABBABLE matches a button or a link whatever its tabindex; -1 takes it out of the tab order
      function tabbableIn(menu: HTMLElement): string[] {
        return [menu, ...Array.from(menu.querySelectorAll<HTMLElement>(TABBABLE))]
          .filter((candidate) => candidate.matches(TABBABLE) && candidate.tabIndex >= 0)
          .map(nameOf);
      }

      function contentOf(menu: HTMLElement): (string | null)[][] {
        return Array.from(menu.children).map((child) => [
          child.tagName,
          child.getAttribute('role'),
          nameOf(child),
        ]);
      }

      function navTexts(): string[] {
        return Array.from(compiled.querySelectorAll('nav a')).map((a) => textOf(a));
      }
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

      it('shows "Loading…", then the Plan page with the browser\'s plan at /plan, replacing the URL, when "Sign out" is clicked on the Grocery list page of an accepted plan; and the same with the account\'s plan when another tab signs in (#45 5, changed by #52)', async () => {
        localStorage.setItem('fooplan.plan', JSON.stringify(browserPlan));
        fake.saveRow('fooplan.plan', accountPlan);
        fake.load(sessionFor('ana@example.com'));
        await open('/groceries');
        expect(compiled.querySelector('main h1')?.textContent?.trim()).toBe('Grocery list');
        expect(compiled.querySelector('main p.note')).toBeNull();
        const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');

        const signOut = await signOutItem();
        let release = holdReads();
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

        await click(await signOutItem());
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

          const signOut = await signOutItem();
          const release = holdReads();
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

          await click(await signOutItem());
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

            await click(await signOutItem());
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

    // The key on the focused element, then the click a browser sends for Enter on a button or a link
    // and for Space on a button, unless the keydown is prevented
    async function press(key: string, init: KeyboardEventInit = {}): Promise<KeyboardEvent> {
      const target = document.activeElement as HTMLElement;
      const keydown = new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
        ...init,
      });
      const clicks =
        (key === 'Enter' && target.matches('button, a[href]')) ||
        (key === ' ' && target.matches('button'));
      if (target.dispatchEvent(keydown) && clicks) {
        target.click();
      }
      target.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, ...init }));
      await stable();
      return keydown;
    }

    async function signOutItem(): Promise<HTMLElement> {
      return itemIn(await openMenu(), 'Sign out');
    }

    async function openMenu(): Promise<HTMLElement> {
      await click(accountButton());
      return shownMenu();
    }

    function accountButton(): HTMLButtonElement {
      const button = compiled.querySelector<HTMLButtonElement>('header button.account-button');
      expect(button, 'no account button in the header').not.toBeNull();
      return button!;
    }

    function shownMenu(): HTMLElement {
      const menu = accountMenu();
      expect(menu, 'no account menu').not.toBeNull();
      return menu!;
    }

    function accountMenu(): HTMLElement | null {
      return compiled.querySelector<HTMLElement>('#account-menu');
    }

    function itemIn(menu: HTMLElement, name: string): HTMLElement {
      const item = itemsOf(menu).find((candidate) => nameOf(candidate) === name);
      expect(item, `no item "${name}" in the menu`).toBeDefined();
      return item!;
    }

    function itemsOf(menu: HTMLElement): HTMLElement[] {
      return Array.from(
        menu.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemradio"]'),
      );
    }

    function linesOf(menu: HTMLElement): string[] {
      return Array.from(
        menu.querySelectorAll('.account-email, [role="menuitem"], [role="menuitemradio"]'),
      ).map(nameOf);
    }

    // As a screen reader reads it: without the ✓ of the checked language, which is hidden from it
    function nameOf(target: Element): string {
      const copy = target.cloneNode(true) as Element;
      copy.querySelectorAll('[aria-hidden="true"]').forEach((hidden) => hidden.remove());
      return target.getAttribute('aria-label') ?? textOf(copy);
    }

    function textOf(target: Element): string {
      return target.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    }
  });
});
