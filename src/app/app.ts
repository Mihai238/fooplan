import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  viewChild,
} from '@angular/core';
import {
  isActive,
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationSkipped,
  NavigationStart,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { AuthStore } from './auth/auth-store';
import { Language, LanguageStore } from './language-store';

@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  protected readonly language = inject(LanguageStore);
  protected readonly auth = inject(AuthStore);
  private readonly signInLink = viewChild<ElementRef<HTMLAnchorElement>>('signInLink');
  // A recipe page and the form to add one belong to Recipes, so the link stays current there, but
  // they aren't that page. RouterLinkActive can't do this: it would take the class and aria-current
  // off again on /add-recipe, which isn't under /recipes
  protected readonly onRecipesPage = isActive('/recipes', this.router, { paths: 'exact' });
  protected readonly inRecipes = computed(() => this.underRecipes() || this.onAddRecipe());
  private readonly underRecipes = isActive('/recipes', this.router);
  private readonly onAddRecipe = isActive('/add-recipe', this.router);

  constructor() {
    if (this.auth.openedFromLink) {
      void this.goToPlanAfterLink();
    }
  }

  protected showLanguage(language: Language): void {
    if (language !== this.language.language()) {
      this.language.set(language);
    }
  }

  // "Sign out" goes with the render, which would drop the focus to <body>; "Sign in" takes its place
  protected async signOut(): Promise<void> {
    if (await this.auth.signOut()) {
      afterNextRender(() => this.signInLink()?.nativeElement.focus(), { injector: this.injector });
    }
  }

  // The link lands on the base URL, where the client signs in from it; the user goes on planning.
  // The client then clears the link from the URL, which fires a popstate the router follows from a
  // timer with a navigation of its own, to the base URL: going to /plan only once that one has ended
  // keeps it from cancelling or undoing the move, whichever of the two comes first. Clearing the URL
  // adds a history entry, so Back from /plan still returns to the link's URL
  private async goToPlanAfterLink(): Promise<void> {
    const urlFollowed = routerFollowedPopstate(this.router);
    await this.auth.whenLoaded();
    if (this.auth.signedInFromLink()) {
      await urlFollowed;
      await this.router.navigateByUrl('/plan', { replaceUrl: true });
    }
  }
}

// A navigation the router skips as being for its current URL has no NavigationStart, so its trigger
// only shows in currentNavigation()
function routerFollowedPopstate(router: Router): Promise<unknown> {
  const popstateIds = new Set<number>();
  return firstValueFrom(
    router.events.pipe(
      filter((event) => {
        if (event instanceof NavigationStart && event.navigationTrigger === 'popstate') {
          popstateIds.add(event.id);
        }
        if (event instanceof NavigationSkipped) {
          const navigation = router.currentNavigation();
          return navigation?.id === event.id && navigation.trigger === 'popstate';
        }
        return (
          (event instanceof NavigationEnd ||
            event instanceof NavigationCancel ||
            event instanceof NavigationError) &&
          popstateIds.has(event.id)
        );
      }),
    ),
  );
}
