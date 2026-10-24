import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';

describe('routes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes)],
    });
  });

  it('redirects an unknown URL to /recipes', async () => {
    const harness = await RouterTestingHarness.create('/nope');
    expect(TestBed.inject(Router).url).toBe('/recipes');
    expect(harness.routeNativeElement!.querySelectorAll('article').length).toBeGreaterThan(0);
  });
});
