import { Component, inject } from '@angular/core';
import { isActive, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  // A recipe page belongs to Recipes, so the link stays current there, but it isn't that page
  protected readonly onRecipesPage = isActive('/recipes', inject(Router), { paths: 'exact' });
}
