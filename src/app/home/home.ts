import { DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { cartCount } from '../groceries/groceries';
import { MessageId } from '../i18n';
import { Language, LanguageStore } from '../language-store';
import { filledMeals, MealKind } from '../plan/plan';
import { PlanStore, TODAY } from '../plan/plan-store';
import { recipeSlug } from '../recipes/recipe-slug';
import { RecipeStore } from '../recipes/recipe-store';
import { planStage, todayMeals } from './overview';

const DATE_FORMATS: Record<Language, string> = { en: 'EEEE, MMMM d', de: 'EEEE, d. MMMM' };

const PHOTO_CREDITS: readonly PhotoCredit[] = [
  { photographer: 'Katie Smith', page: 'https://unsplash.com/photos/uQs1802D0CQ' },
  { photographer: 'Ella Olsson', page: 'https://unsplash.com/photos/lMcRyBx4G50' },
  { photographer: 'Peter Wendt', page: 'https://unsplash.com/photos/-r5KSMkyoSc' },
  { photographer: 'Kevin McCutcheon', page: 'https://unsplash.com/photos/APDMfLHZiRA' },
];

interface MainLink {
  label: MessageId;
  link: string;
  detail: string;
}

interface PhotoCredit {
  photographer: string;
  page: string;
}

@Component({
  imports: [DatePipe, RouterLink],
  selector: 'app-home',
  styleUrl: './home.css',
  templateUrl: './home.html',
})
export class Home {
  private readonly store = inject(PlanStore);
  private readonly recipes = inject(RecipeStore);
  protected readonly language = inject(LanguageStore);
  private readonly plan = this.store.plan;
  protected readonly today = inject(TODAY)();
  protected readonly stage = computed(() => planStage(this.plan()));
  protected readonly main = computed((): MainLink => {
    switch (this.stage()) {
      case 'empty':
        return { label: 'home.start', link: '/plan', detail: '' };
      case 'started':
        return { label: 'home.continue', link: '/plan', detail: this.mealsPicked() };
      case 'complete':
        return { label: 'home.accept', link: '/plan', detail: '' };
      case 'accepted':
        return { label: 'home.shop', link: '/groceries', detail: this.inCart() };
    }
  });
  protected readonly todayMeals = computed(() => todayMeals(this.plan(), this.today));
  protected readonly dateFormat = computed(() => DATE_FORMATS[this.language.language()]);
  protected readonly planFact = computed(() => {
    switch (this.stage()) {
      case 'empty':
        return this.language.t('home.noMealsPicked');
      case 'accepted':
        return this.language.planSummary(this.plan());
      default:
        return this.mealsPicked();
    }
  });
  protected readonly groceriesFact = computed(() =>
    this.plan().accepted ? this.inCart() : this.language.t('home.groceriesLater'),
  );
  protected readonly recipesFact = computed(() => {
    const count = this.recipes.all().length;
    const own = this.recipes.own().length;
    const recipes = this.language.t(count === 1 ? 'home.recipes.one' : 'home.recipes.other', {
      count,
    });
    if (own === 0) {
      return recipes;
    }
    return `${recipes}, ${this.language.t(own === 1 ? 'home.own.one' : 'home.own.other', { count: own })}`;
  });
  protected readonly recipeSlug = recipeSlug;
  protected readonly photoCredits = PHOTO_CREDITS;
  protected readonly meals: readonly { kind: MealKind; label: MessageId }[] = [
    { kind: 'lunch', label: 'meal.lunch' },
    { kind: 'dinner', label: 'meal.dinner' },
  ];
  private readonly recipesByName = computed(
    () => new Map(this.recipes.all().map((recipe) => [recipe.name, recipe])),
  );

  protected displayName(name: string): string {
    const recipe = this.recipesByName().get(name);
    return recipe ? this.recipes.displayName(recipe) : name;
  }

  protected minutes(recipe: string): number | undefined {
    return this.recipesByName().get(recipe)?.minutes;
  }

  private mealsPicked(): string {
    const plan = this.plan();
    return this.language.t('home.mealsPicked', {
      filled: filledMeals(plan),
      total: plan.days.length * 2,
    });
  }

  private inCart(): string {
    const { inCart, total } = cartCount(this.plan(), this.recipes.all());
    return this.language.t('home.inCart', { inCart, total });
  }
}
