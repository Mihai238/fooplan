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
  host: { '(document:pointerdown)': 'closeOnPressOutside($event)' },
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
  private readonly accountButton =
    viewChild.required<ElementRef<HTMLButtonElement>>('accountButton');
  private readonly accountMenu = viewChild<ElementRef<HTMLElement>>('accountMenu');
  protected readonly menuOpen = signal(false);
  protected readonly languages = [
    { language: 'en', label: 'language.en' },
    { language: 'de', label: 'language.de' },
  ] as const;
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

  protected toggleMenu(): void {
    if (this.menuOpen()) {
      this.closeMenu();
    } else {
      this.openMenu('first');
    }
  }

  protected openMenu(item: 'first' | 'last'): void {
    this.menuOpen.set(true);
    const at = item === 'first' ? 0 : -1;
    afterNextRender(() => this.menuItems().at(at)?.focus(), { injector: this.injector });
  }

  protected keyInMenu(event: KeyboardEvent): void {
    const items = this.menuItems();
    const index = items.indexOf(document.activeElement as HTMLElement);
    let to: number;
    switch (event.key) {
      case 'ArrowDown':
        to = index + 1;
        break;
      // From the menu itself, as a click on the email line focuses it, this goes to the last item
      case 'ArrowUp':
        to = index === -1 ? -1 : index - 1;
        break;
      case 'Home':
        to = 0;
        break;
      case 'End':
        to = -1;
        break;
      // Tab isn't prevented: the browser moves on from the button, to the page or with Shift back to
      // the nav, as the items are out of the tab order
      case 'Escape':
      case 'Tab':
        this.closeMenu();
        return;
      default:
        return;
    }
    event.preventDefault();
    items.at(to % items.length)?.focus();
  }

  // Focus lost to nothing keeps the menu open: Safari doesn't focus a pressed button, so a press on
  // the account button blurs the item first and its click would open the menu again, and a window
  // losing the focus needn't close it. A press outside closes it instead
  protected closeOnFocusOut(event: FocusEvent): void {
    const to = event.relatedTarget as Node | null;
    if (to && !this.inAccountMenu(to)) {
      this.menuOpen.set(false);
    }
  }

  // A press on the button is left to its click, which toggles the menu
  protected closeOnPressOutside(event: PointerEvent): void {
    if (!this.inAccountMenu(event.target as Node)) {
      this.menuOpen.set(false);
    }
  }

  protected showLanguage(language: Language): void {
    if (language !== this.language.language()) {
      this.language.set(language);
    }
    this.closeMenu();
  }

  // The change of user takes the app to the Plan page; a failed sign-out leaves it as it was
  protected signOut(): void {
    this.closeMenu();
    void this.auth.signOut();
  }

  // The focused item goes with the render, which would drop the focus to <body>
  protected closeMenu(): void {
    this.accountButton().nativeElement.focus();
    this.menuOpen.set(false);
  }

  private inAccountMenu(target: Node): boolean {
    return (
      this.accountButton().nativeElement.contains(target) ||
      (this.accountMenu()?.nativeElement.contains(target) ?? false)
    );
  }

  private menuItems(): HTMLElement[] {
    return Array.from(
      this.accountMenu()?.nativeElement.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [],
    );
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
