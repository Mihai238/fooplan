import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';

describe('routes', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter(routes)],
    });
  });

  it('opens the plan page at the root URL', async () => {
    const harness = await RouterTestingHarness.create('/');
    expect(TestBed.inject(Router).url).toBe('/plan');
    expect(harness.routeNativeElement!.querySelector('h1')?.textContent?.trim()).toBe('Plan');
  });

  it('redirects an unknown URL to /plan', async () => {
    const harness = await RouterTestingHarness.create('/nope');
    expect(TestBed.inject(Router).url).toBe('/plan');
    expect(harness.routeNativeElement!.querySelector('h1')?.textContent?.trim()).toBe('Plan');
  });

  it('shows the recipes at /recipes', async () => {
    const harness = await RouterTestingHarness.create('/recipes');
    expect(TestBed.inject(Router).url).toBe('/recipes');
    expect(harness.routeNativeElement!.querySelectorAll('article').length).toBeGreaterThan(0);
  });

  it('shows the grocery list at /groceries', async () => {
    const harness = await RouterTestingHarness.create('/groceries');
    expect(TestBed.inject(Router).url).toBe('/groceries');
    expect(harness.routeNativeElement!.querySelector('h1')?.textContent?.trim()).toBe(
      'Grocery list',
    );
  });
});
