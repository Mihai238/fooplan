import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
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

  it('renders a "Plan" link to /plan before the "Recipes" link', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const links = Array.from(compiled.querySelectorAll('nav a'));
    expect(links.map((a) => a.textContent?.trim())).toEqual(['Plan', 'Recipes']);
    expect(links[0].getAttribute('href')).toBe('/plan');
  });
});
