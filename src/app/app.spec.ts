import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';

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
});
