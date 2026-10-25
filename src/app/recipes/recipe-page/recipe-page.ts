import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  linkedSignal,
  viewChild,
} from '@angular/core';
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
  private readonly injector = inject(Injector);
  // The router reuses this page for another slug, and the route's guard lets only a known one in
  protected readonly page = toSignal(
    inject(ActivatedRoute).paramMap.pipe(
      map((params) => ({ recipe: recipeBySlug(params.get('slug')!)!, back: this.previousUrl() })),
    ),
    { requireSync: true },
  );
  protected readonly step = linkedSignal({ source: this.page, computation: () => 0 });
  protected readonly last = computed(() => this.step() === this.page().recipe.steps.length - 1);
  protected readonly displayAmount = displayAmount;
  private readonly nextButton = viewChild<ElementRef<HTMLButtonElement>>('nextButton');
  private readonly doneLink = viewChild<ElementRef<HTMLAnchorElement>>('doneLink');

  // A button disabled while it has the focus drops the focus to the page, so on the first step the
  // focus moves on to "Next". In a recipe of two steps "Next" replaces "Done" there, so it exists
  // only once the page is rendered
  protected showPrevious(previous: HTMLButtonElement): void {
    this.step.update((step) => step - 1);
    if (this.step() === 0 && document.activeElement === previous) {
      afterNextRender(() => this.nextButton()?.nativeElement.focus(), { injector: this.injector });
    }
  }

  // On the last step "Done" replaces "Next", whose focus would drop to the page along with it; the
  // link exists only once the page is rendered
  protected showNext(next: HTMLButtonElement): void {
    this.step.update((step) => step + 1);
    if (this.last() && document.activeElement === next) {
      afterNextRender(() => this.doneLink()?.nativeElement.focus(), { injector: this.injector });
    }
  }

  // The params change while the navigation here runs, so the one before it is where the user came
  // from; there is none when the app started on this page
  private previousUrl(): UrlTree {
    return (
      this.router.currentNavigation()?.previousNavigation?.finalUrl ??
      this.router.parseUrl('/recipes')
    );
  }
}
