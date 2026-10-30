import {
  afterNextRender,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  InjectionToken,
  Injector,
  PendingTasks,
  signal,
  Type,
  untracked,
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
import type { PlanStore } from './plan/plan-store';
import { SaveStatus } from './save-status';

// Imported on demand, as the guards in app.routes.ts do, to keep the recipes out of the initial
// bundle
export const IMPORT_PLAN_STORE = new InjectionToken<() => Promise<Type<PlanStore>>>(
  'IMPORT_PLAN_STORE',
  {
    providedIn: 'root',
    factory: () => () => import('./plan/plan-store').then((m) => m.PlanStore),
  },
);

@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly pendingTasks = inject(PendingTasks);
  private readonly importPlanStore = inject(IMPORT_PLAN_STORE);
  protected readonly language = inject(LanguageStore);
  protected readonly auth = inject(AuthStore);
  protected readonly saves = inject(SaveStatus);
  private readonly signInLink = viewChild<ElementRef<HTMLAnchorElement>>('signInLink');
  // A recipe page and the form to add one belong to Recipes, so the link stays current there, but
  // they aren't that page. RouterLinkActive can't do this: it would take the class and aria-current
  // off again on /add-recipe, which isn't under /recipes
  protected readonly onRecipesPage = isActive('/recipes', this.router, { paths: 'exact' });
  protected readonly inRecipes = computed(() => this.underRecipes() || this.onAddRecipe());
  private readonly underRecipes = isActive('/recipes', this.router);
  private readonly onAddRecipe = isActive('/add-recipe', this.router);
  private readonly planStore = signal<PlanStore | undefined>(undefined);
  protected readonly loaded = computed(() => this.planStore()?.ready() ?? false);
  protected readonly loadFailed = signal(false);
  private loads = 0;
  // The user whose data the stores hold: undefined until the client has returned the saved session
  private loadedFor: string | null | undefined;

  constructor() {
    this.loadStores(false);
    // The first load reads for the session the client returns first, in the same task as this
    void this.auth.whenLoaded().then(() => (this.loadedFor = this.auth.userId()));
    if (this.auth.openedFromLink) {
      void this.goToPlanAfterLink();
    }
    this.reloadOnSessionChange();
  }

  // Signing in or out here or in another tab changes the user; a refreshed session of the same user
  // doesn't. The data of the other place has nothing to do with the page left, so the user goes on
  // planning, and a change of the data left that couldn't be saved no longer matters
  private reloadOnSessionChange(): void {
    effect(() => {
      const user = this.auth.userId();
      if (!this.auth.loaded() || this.loadedFor === undefined || user === this.loadedFor) {
        return;
      }
      untracked(() => {
        this.loadedFor = user;
        this.saves.reset();
        this.loadStores(true);
        void this.router.navigateByUrl('/plan', { replaceUrl: true });
      });
    });
  }

  // Pending until the pages can show, so the app only counts as stable from then on
  private loadStores(again: boolean): void {
    const done = this.pendingTasks.add();
    void this.load(again).finally(done);
  }

  // Loading the plan loads the recipes too. Only the last load started tells whether loading failed
  private async load(again: boolean): Promise<void> {
    const load = ++this.loads;
    this.loadFailed.set(false);
    try {
      const store = this.injector.get(await this.importPlanStore());
      this.planStore.set(store);
      await (again ? store.reload() : store.load());
    } catch {
      if (load === this.loads) {
        this.loadFailed.set(true);
      }
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
