import { computed, inject, Injectable, InjectionToken, signal } from '@angular/core';
import { isKidFriendly } from '../recipes/kid-friendly';
import { RecipeStore } from '../recipes/recipe-store';
import { readStored, writeStored } from '../storage';
import {
  acceptPlan,
  addItem,
  clearMeal,
  createPlan,
  dropSuggestion,
  dropSuggestionsOutside,
  eatOut,
  forgetRecipe,
  isPicked,
  MealRef,
  MIN_SUGGESTED,
  otherSuggestions,
  parsePlan,
  pickRecipe,
  Plan,
  Random,
  removeItem,
  renameRecipe,
  setCookExtra,
  setDays,
  setKidFriendly,
  setPeople,
  toggleTicked,
} from './plan';

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

@Injectable({ providedIn: 'root' })
export class PlanStore {
  private readonly random = inject(RANDOM);
  private readonly today = inject(TODAY);
  private readonly recipes = inject(RecipeStore);
  // Declared before the plan down to canBeKidFriendly, since loading it reads them all: it draws
  // from the recipes not removed, and from the kid-friendly ones among them for a kid-friendly
  // plan while enough of them are suggested
  private readonly removedState = signal<string[]>(
    parseRemoved(readStored(REMOVED_KEY), this.recipeNames()),
  );
  readonly removed = this.removedState.asReadonly();
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
  private readonly state = signal<Plan>(this.load());
  readonly plan = this.state.asReadonly();
  readonly kidFriendly = computed(() => this.plan().kidFriendly && this.canBeKidFriendly());
  private readonly candidates = computed(() => this.candidatesOf(this.kidFriendly()));
  readonly canRemove = computed(() => this.candidates().length > MIN_SUGGESTED);

  setDays(days: number): void {
    this.update((plan) => setDays(plan, days, this.candidates(), this.random));
  }

  setPeople(people: number): void {
    this.update((plan) => setPeople(plan, people));
  }

  setKidFriendly(on: boolean): void {
    if (on && !this.canBeKidFriendly()) {
      return;
    }
    this.update((plan) => setKidFriendly(plan, on, this.candidatesOf(on), this.random));
  }

  pick(meal: MealRef, recipe: string): void {
    this.update((plan) => pickRecipe(plan, meal, recipe, this.candidates(), this.random));
  }

  eatOut(meal: MealRef): void {
    this.update((plan) => eatOut(plan, meal));
  }

  clear(meal: MealRef): void {
    this.update((plan) => clearMeal(plan, meal, this.candidates(), this.random));
  }

  otherSuggestions(meal: MealRef): void {
    this.update((plan) => otherSuggestions(plan, meal, this.candidates(), this.random));
  }

  setCookExtra(day: number, on: boolean): void {
    this.update((plan) => setCookExtra(plan, day, on, this.candidates(), this.random));
  }

  accept(): void {
    this.update(acceptPlan);
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
    this.update((plan) => dropSuggestion(plan, name, this.candidates(), this.random));
  }

  // Called after every edit, once RecipeStore holds the edited recipe under its new name
  recipeEdited(from: string, to: string): void {
    if (from !== to && this.removed().includes(from)) {
      this.setRemoved(this.removed().map((name) => (name === from ? to : name)));
    }
    // An edited own recipe can stop being kid-friendly
    this.update((plan) => this.withinCandidates(renameRecipe(plan, from, to)));
  }

  deleteRecipe(name: string): void {
    if (
      !this.recipes.own().some((recipe) => recipe.name === name) ||
      this.deleteBlock(name) !== null
    ) {
      return;
    }
    // The plan goes first: a write failing after it leaves a plan without the recipe, which loads
    // whether the recipe and its removal are still saved or not
    const candidates = this.candidates().filter((other) => other !== name);
    this.update((plan) => forgetRecipe(plan, name, candidates, this.random));
    this.recipes.remove(name);
    this.restoreRecipe(name);
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

  newPlan(): void {
    // Drawn from the current plan's candidates, which already match the kid-friendly value the new
    // plan keeps, so setKidFriendly has nothing left to replace
    const candidates = this.candidates();
    this.update((plan) =>
      setKidFriendly(
        setPeople(createPlan(this.today(), candidates, this.random), plan.people),
        this.kidFriendly(),
        candidates,
        this.random,
      ),
    );
  }

  private load(): Plan {
    // A plan can hold recipes picked or suggested before they were removed
    const stored = parsePlan(readStored(STORAGE_KEY), this.recipeNames());
    if (stored) {
      // A saved plan can still suggest a removed recipe, e.g. one another tab saved, or when saving
      // the plan failed after the removal was saved, and a kid-friendly one a recipe that isn't
      // kid-friendly, e.g. an own recipe edited since, or be left with too few to stay kid-friendly
      const plan = this.withinCandidates(stored);
      if (plan !== stored) {
        writeStored(STORAGE_KEY, plan);
      }
      return plan;
    }
    const plan = createPlan(this.today(), this.suggested(), this.random);
    writeStored(STORAGE_KEY, plan);
    return plan;
  }

  // Every draw comes from at least MIN_SUGGESTED candidates, so that each meal gets its three
  // suggestions: with fewer kid-friendly recipes suggested, an unaccepted plan stops being
  // kid-friendly
  private withinCandidates(plan: Plan): Plan {
    const kept = this.canBeKidFriendly()
      ? plan
      : setKidFriendly(plan, false, this.suggested(), this.random);
    return dropSuggestionsOutside(
      kept,
      this.candidatesOf(kept.kidFriendly && this.canBeKidFriendly()),
      this.random,
    );
  }

  private candidatesOf(kidFriendly: boolean): string[] {
    return kidFriendly ? this.kidFriendlySuggested() : this.suggested();
  }

  private update(change: (plan: Plan) => Plan): void {
    const plan = change(this.state());
    if (plan !== this.state()) {
      this.state.set(plan);
      writeStored(STORAGE_KEY, plan);
    }
  }

  private setRemoved(removed: string[]): void {
    this.removedState.set(removed);
    writeStored(REMOVED_KEY, removed);
  }

  private recipeNames(): string[] {
    return this.recipes.all().map((recipe) => recipe.name);
  }
}

function parseRemoved(value: unknown, names: readonly string[]): string[] {
  if (!Array.isArray(value) || !value.every((name) => typeof name === 'string')) {
    return [];
  }
  const removed = [...new Set(value.filter((name) => names.includes(name)))];
  return names.length - removed.length >= MIN_SUGGESTED ? removed : [];
}
