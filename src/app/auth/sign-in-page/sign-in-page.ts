import {
  afterNextRender,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { MessageId } from '../../i18n';
import { LanguageStore } from '../../language-store';
import { AuthStore } from '../auth-store';
import { isEmail } from '../email';

@Component({
  selector: 'app-sign-in-page',
  styleUrl: './sign-in-page.css',
  templateUrl: './sign-in-page.html',
})
export class SignInPage {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly language = inject(LanguageStore);
  protected readonly sending = signal(false);
  protected readonly sentTo = signal<string | null>(null);
  protected readonly problem = signal<MessageId | null>(null);
  private readonly emailField = viewChild<ElementRef<HTMLInputElement>>('emailInput');
  private readonly checkInbox = viewChild<ElementRef<HTMLElement>>('checkInbox');

  constructor() {
    this.focusField();
    // The link may be opened in another tab, whose session the client shares with this one
    effect(() => {
      if (this.auth.email() !== null) {
        void this.router.navigateByUrl('/plan', { replaceUrl: true });
      }
    });
  }

  // Without preventDefault the browser would submit the form and reload the page. The focus goes
  // back to the field when nothing was sent: a clicked button takes it, and loses it once disabled
  protected async send(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    // Enter in the field submits again while the disabled button can't
    if (this.sending()) {
      return;
    }
    // The form holds the field, so it is there while the form can be submitted
    const input = this.emailField()!.nativeElement;
    const email = input.value.trim();
    if (!isEmail(email)) {
      this.problem.set('signIn.enterEmail');
      input.focus();
      return;
    }
    this.problem.set(null);
    this.sending.set(true);
    const sent = await this.auth.sendLink(email);
    // The user may have left the page while waiting; it has nothing left to show then
    if (this.destroyRef.destroyed) {
      return;
    }
    this.sending.set(false);
    if (sent) {
      this.sentTo.set(email);
      afterNextRender(() => this.checkInbox()?.nativeElement.focus(), { injector: this.injector });
    } else {
      this.problem.set('signIn.failed');
      input.focus();
    }
  }

  protected useAnotherEmail(): void {
    this.sentTo.set(null);
    this.focusField();
  }

  private focusField(): void {
    afterNextRender(() => this.emailField()?.nativeElement.focus(), { injector: this.injector });
  }
}
