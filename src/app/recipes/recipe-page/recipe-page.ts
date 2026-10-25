import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink, UrlTree } from '@angular/router';
import { map } from 'rxjs';
import { displayAmount } from '../amount';
import { recipeBySlug } from '../recipe-slug';

@Component({
  imports: [RouterLink],
  selector: 'app-recipe-page',
  styleUrl: './recipe-page.css',
  templateUrl: './recipe-page.html',
})
export class RecipePage {
  private readonly router = inject(Router);
  // The router reuses this page for another slug, and the route's guard lets only a known one in
  protected readonly page = toSignal(
    inject(ActivatedRoute).paramMap.pipe(
      map((params) => ({ recipe: recipeBySlug(params.get('slug')!)!, back: this.previousUrl() })),
    ),
    { requireSync: true },
  );
  protected readonly displayAmount = displayAmount;

  // The params change while the navigation here runs, so the one before it is where the user came
  // from; there is none when the app started on this page
  private previousUrl(): UrlTree {
    return (
      this.router.currentNavigation()?.previousNavigation?.finalUrl ??
      this.router.parseUrl('/recipes')
    );
  }
}
