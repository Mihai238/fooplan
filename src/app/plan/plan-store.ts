import { computed, inject, Injectable, InjectionToken, signal } from '@angular/core';
import { isKidFriendly } from '../recipes/kid-friendly';
import { RecipeStore } from '../recipes/recipe-store';
import { SaveStatus } from '../save-status';
import { isStringList, StorageBackend } from '../storage';
import {
  acceptPlan,
  addItem,
  Cooked,
  clearMeal,
  createPlan,
  DEFAULT_SETTINGS,
  dropSuggestion,
  dropSuggestionsOutside,
  eatOut,
  forgetCooked,
  forgetRecipe,
  isPicked,
  MAX_DAYS,
  MealRef,
  MIN_DAYS,
  MIN_PEOPLE,
  MIN_SUGGESTED,
  otherSuggestions,
  parseCooked,
  parsePlan,
  pickRecipe,
  Plan,
  PlanSettings,
  Random,
  recordCooked,
  removeItem,
  renameCooked,
  renameRecipe,
  Score,
  setCookExtra,
  setKidFriendly,
  toggleTicked,
} from './plan';
import { scoreWith } from './ranking';

export const RANDOM = new InjectionToken<Random>('RANDOM', {
  providedIn: 'root',
  factory: () => Math.random,
});

export const TODAY = new InjectionToken<() => string>('TODAY', {
  providedIn: 'root',
  factory: () => () => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  },
});

const STORAGE_KEY = 'fooplan.plan';
const REMOVED_KEY = 'fooplan.removed';
const COOKED_KEY = 'fooplan.cooked';
// Held until the first load; no page shows meanwhile
const NO_PLAN: Plan = {
  days: [],
  people: DEFAULT_SETTINGS.people,
  accepted: false,
  ticked: [],
  added: [],
  shown: [],
  kidFriendly: false,
};

@Injectable({ providedIn: 'root' })
export class PlanStore {
  private readonly random = inject(RANDOM);
  private readonly today = inject(TODAY);
  private readonly recipes = inject(RecipeStore);
  private readonly backend = inject(StorageBackend);
  private readonly saves = inject(SaveStatus);
  private readonly removedState = signal<string[]>([]);
  readonly removed = this.removedState.asReadonly();
  private readonly cookedState = signal<Cooked>({});
  readonly cooked = this.cookedState.asReadonly();
  private readonly suggested = computed(() => {
    const removed = this.removed();
    return this.recipeNames().filter((name) => !removed.includes(name));
  });
  private readonly kidFriendlySuggested = computed(() => {
    const suggested = this.suggested();
    return this.recipes
      .all()
      .filter((recipe) => suggested.includes(recipe.name) && isKidFriendly(recipe))
      .map((recipe) => recipe.name);
  });
  readonly canBeKidFriendly = computed(() => this.kidFriendlySuggested().length >= MIN_SUGGESTED);
  private readonly state = signal<Plan>(NO_PLAN);
  readonly plan = this.state.asReadonly();
  // Counts the plans started with newPlan, not those loaded: by its content, a new plan can look
  // like a plan only changed
  private readonly startedState = signal(0);
  readonly started = this.startedState.asReadonly();
  private readonly readyState = signal(false);
  readonly ready = this.readyState.asReadonly();
  private loading: Promise<void> | undefined;
  private latest: Promise<void> = Promise.resolve();
  private loads = 0;
  readonly kidFriendly = computed(() => this.plan().kidFriendly && this.canBeKidFriendly());
  private readonly candidates = computed(() => this.candidatesOf(this.kidFriendly()));
  readonly canRemove = computed(() => this.candidates().length > MIN_SUGGESTED);

  load(): Promise<void> {
    return this.loading ?? this.start(false);
  }

  // Reads again, the recipes too, even while a load runs, for data that may differ from what that
  // load reads, e.g. after the session changed: only the new read is applied, and the load running
  // then settles with the new one
  reload(): Promise<void> {
    return this.start(true);
  }

  pick(meal: MealRef, recipe: string): void {
    this.update((plan) =>
      pickRecipe(plan, meal, recipe, this.candidates(), this.random, this.score()),
    );
  }

  eatOut(meal: MealRef): void {
    this.update((plan) => eatOut(plan, meal));
  }

  clear(meal: MealRef): void {
    this.update((plan) => clearMeal(plan, meal, this.candidates(), this.random, this.score()));
  }

  otherSuggestions(meal: MealRef): void {
    this.update((plan) =>
      otherSuggestions(plan, meal, this.candidates(), this.random, this.score()),
    );
  }

  setCookExtra(day: number, on: boolean): void {
    this.update((plan) =>
      setCookExtra(plan, day, on, this.candidates(), this.random, this.score()),
    );
  }

  accept(): void {
    const wasAccepted = this.plan().accepted;
    this.update(acceptPlan);
    if (!wasAccepted && this.plan().accepted) {
      this.setCooked(recordCooked(this.cooked(), this.plan()));
    }
  }

  toggleTicked(key: string): void {
    this.update((plan) => toggleTicked(plan, key));
  }

  addItem(text: string): void {
    this.update((plan) => addItem(plan, text));
  }

  removeItem(text: string): void {
    this.update((plan) => removeItem(plan, text));
  }

  removeRecipe(name: string): void {
    if (!this.recipeNames().includes(name) || this.removed().includes(name) || !this.canRemove()) {
      return;
    }
    this.setRemoved([...this.removed(), name]);
    this.update((plan) => dropSuggestion(plan, name, this.candidates(), this.random, this.score()));
  }

  // Called after every edit, once RecipeStore holds the edited recipe under its new name
  recipeEdited(from: string, to: string): void {
    if (from !== to && this.removed().includes(from)) {
      this.setRemoved(this.removed().map((name) => (name === from ? to : name)));
    }
    this.setCooked(renameCooked(this.cooked(), from, to));
    // An edited own recipe can stop being kid-friendly
    this.update((plan) => this.withinCandidates(renameRecipe(plan, from, to)));
  }

  deleteRecipe(name: string): void {
    if (
      !this.ready() ||
      !this.recipes.own().some((recipe) => recipe.name === name) ||
      this.deleteBlock(name) !== null
    ) {
      return;
    }
    // The plan goes first: a write failing after it leaves a plan without the recipe, which loads
    // whether the recipe and its removal are still saved or not
    const candidates = this.candidates().filter((other) => other !== name);
    this.update((plan) => forgetRecipe(plan, name, candidates, this.random, this.score()));
    this.recipes.remove(name);
    this.restoreRecipe(name);
    this.setCooked(forgetCooked(this.cooked(), name));
  }

  deleteBlock(name: string): 'picked' | 'accepted' | 'limit' | null {
    const plan = this.plan();
    if (isPicked(plan, name)) {
      return plan.accepted ? 'accepted' : 'picked';
    }
    return this.suggested().includes(name) && !this.canRemove() ? 'limit' : null;
  }

  restoreRecipe(name: string): void {
    if (!this.removed().includes(name)) {
      return;
    }
    this.setRemoved(this.removed().filter((other) => other !== name));
  }

  newPlan(settings: PlanSettings): boolean {
    if (!this.ready() || !this.isValid(settings)) {
      return false;
    }
    const candidates = this.candidatesOf(settings.kidFriendly);
    this.update(() => createPlan(this.today(), settings, candidates, this.random, this.score()));
    this.startedState.update((count) => count + 1);
    return true;
  }

  private start(again: boolean): Promise<void> {
    this.readyState.set(false);
    const load = ++this.loads;
    // Read from a promise, so that a read failing at once ends the load after it is stored here
    this.loading = Promise.resolve().then(() => this.read(load, again));
    this.latest = this.loading;
    return this.loading;
  }

  // The plan is validated against the recipe names, so it is parsed once the recipes are loaded,
  // and draws from the recipes not removed, ranked by the cooked history, so the removed ones and
  // the history are set before it. The load ends in the step that makes the store ready, so a
  // load() from then on reads again
  private async read(load: number, again: boolean): Promise<void> {
    try {
      const [, removed, cooked, plan] = await Promise.all([
        again ? this.recipes.reload() : this.recipes.load(),
        this.backend.read(REMOVED_KEY),
        this.backend.read(COOKED_KEY),
        this.backend.read(STORAGE_KEY),
      ]);
      if (load === this.loads) {
        this.removedState.set(parseRemoved(removed, this.recipeNames()));
        this.cookedState.set(parseCooked(cooked, this.recipeNames()));
        this.state.set(this.planFrom(plan));
        this.readyState.set(true);
      }
    } catch (error) {
      if (load === this.loads) {
        throw error;
      }
    } finally {
      if (load === this.loads) {
        this.loading = undefined;
      }
    }
    // A load replaced by a newer one settles with it
    if (load !== this.loads) {
      return this.latest;
    }
  }

  private planFrom(value: unknown): Plan {
    // A plan can hold recipes picked or suggested before they were removed
    const stored = parsePlan(value, this.recipeNames());
    if (stored) {
      // A saved plan can still suggest a removed recipe, e.g. one another tab saved, or when saving
      // the plan failed after the removal was saved, and a kid-friendly one a recipe that isn't
      // kid-friendly, e.g. an own recipe edited since, or be left with too few to stay kid-friendly
      const plan = this.withinCandidates(stored);
      if (plan !== stored) {
        this.save(STORAGE_KEY, plan);
      }
      return plan;
    }
    const plan = createPlan(
      this.today(),
      DEFAULT_SETTINGS,
      this.suggested(),
      this.random,
      this.score(),
    );
    this.save(STORAGE_KEY, plan);
    return plan;
  }

  // Every draw comes from at least MIN_SUGGESTED candidates, so that each meal gets its three
  // suggestions: with fewer kid-friendly recipes suggested, an unaccepted plan stops being
  // kid-friendly
  private withinCandidates(plan: Plan): Plan {
    const kept = this.canBeKidFriendly()
      ? plan
      : setKidFriendly(plan, false, this.suggested(), this.random, this.score());
    return dropSuggestionsOutside(
      kept,
      this.candidatesOf(kept.kidFriendly && this.canBeKidFriendly()),
      this.random,
      this.score(),
    );
  }

  private isValid({ days, people, kidFriendly }: PlanSettings): boolean {
    return (
      Number.isInteger(days) &&
      days >= MIN_DAYS &&
      days <= MAX_DAYS &&
      Number.isInteger(people) &&
      people >= MIN_PEOPLE &&
      (!kidFriendly || this.canBeKidFriendly())
    );
  }

  private candidatesOf(kidFriendly: boolean): string[] {
    return kidFriendly ? this.kidFriendlySuggested() : this.suggested();
  }

  // Not a computed: TODAY is no signal, and a tab left open past midnight ranks by the new day
  private score(): Score {
    return scoreWith(this.recipes.all(), this.cooked(), this.today());
  }

  // Until a load is done, a change would be made to a state the load then replaces, or before the
  // first load saved over the saved data: it is ignored
  private update(change: (plan: Plan) => Plan): void {
    if (!this.ready()) {
      return;
    }
    const plan = change(this.state());
    if (plan !== this.state()) {
      this.state.set(plan);
      this.save(STORAGE_KEY, plan);
    }
  }

  private setRemoved(removed: string[]): void {
    if (!this.ready()) {
      return;
    }
    this.removedState.set(removed);
    this.save(REMOVED_KEY, removed);
  }

  private setCooked(cooked: Cooked): void {
    if (!this.ready() || cooked === this.cooked()) {
      return;
    }
    this.cookedState.set(cooked);
    this.save(COOKED_KEY, cooked);
  }

  // A change that couldn't be saved stays in memory, until the page is reloaded or a later write
  // saves it
  private save(key: string, value: unknown): void {
    this.saves.track(key, this.backend.write(key, value));
  }

  private recipeNames(): string[] {
    return this.recipes.all().map((recipe) => recipe.name);
  }
}

function parseRemoved(value: unknown, names: readonly string[]): string[] {
  if (!isStringList(value)) {
    return [];
  }
  const removed = [...new Set(value.filter((name) => names.includes(name)))];
  return names.length - removed.length >= MIN_SUGGESTED ? removed : [];
}
