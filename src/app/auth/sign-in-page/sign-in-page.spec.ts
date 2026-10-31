import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { deferred, LANGUAGE_KEY } from '../../testing';
import { FakeSupabase, LINK_FAILED, LINK_SENT, provideSupabase, sessionFor } from '../testing';
import { SignInPage } from './sign-in-page';

describe('SignInPage', () => {
  let fake: FakeSupabase;
  let fixture: ComponentFixture<SignInPage>;
  let element: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    fake = new FakeSupabase();
    fake.load(null);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideSupabase(fake)],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.lang = 'en';
  });

  it('shows the h1 "Sign in", the label "Email" for an email field with autocomplete "email" that has the focus, the button "Send sign-in link", and after the form "We\'ll email you a link that signs you in. No password needed." (#43 3)', async () => {
    await open();
    expect(element.querySelector('h1')?.textContent?.trim()).toBe('Sign in');
    const input = field();
    expect(input.type).toBe('email');
    expect(input.getAttribute('autocomplete')).toBe('email');
    const label = element.querySelector(`label[for="${input.id}"]`);
    expect(input.id, 'the field has no id').not.toBe('');
    expect(label?.textContent?.trim()).toBe('Email');
    expect(document.activeElement, 'focus on open').toBe(input);
    expect(sendButton().type).toBe('submit');
    expect(sendButton().form).toBe(input.form);
    const note = input.form!.nextElementSibling;
    expect(note?.textContent?.trim(), 'text after the form').toBe(
      "We'll email you a link that signs you in. No password needed.",
    );
  });

  it('says "Enter your email address." in the status line, sends nothing and keeps the focus in the field, when submitted empty with the button and with "not-an-email" by Enter (#43 4)', async () => {
    await open();
    await click(sendButton());
    expect(status().textContent?.trim(), 'empty').toBe('Enter your email address.');
    expect(document.activeElement, 'focus after an empty submit').toBe(field());
    expect(fake.sent, 'sent for an empty field').toEqual([]);

    await type('not-an-email');
    await pressEnter();
    expect(status().textContent?.trim(), 'not-an-email').toBe('Enter your email address.');
    expect(document.activeElement, 'focus after not-an-email').toBe(field());
    expect(field().value).toBe('not-an-email');
    expect(fake.sent, 'sent for not-an-email').toEqual([]);
  });

  it('sends the link to "ana@example.com", typed with surrounding spaces, disables the button until it returns, then shows "Check your inbox" with the focus, the address and "Use another email", which brings back the empty form with the focus in the field (#43 5)', async () => {
    const sending = deferred<typeof LINK_SENT>();
    fake.sendLink = () => sending.promise;
    await open();
    await type(' ana@example.com ');
    await click(sendButton());

    expect(fake.sent).toEqual([expect.objectContaining({ email: 'ana@example.com' })]);
    expect(sendButton().disabled, 'button while sending').toBe(true);

    sending.resolve(LINK_SENT);
    await stable();
    expect(element.querySelector('form'), 'form after sending').toBeNull();
    const heading = element.querySelector<HTMLElement>('h2');
    expect(heading?.textContent?.trim()).toBe('Check your inbox');
    expect(document.activeElement, 'focus after sending').toBe(heading);
    expect(textOf(heading!.nextElementSibling!)).toBe(
      'We sent a sign-in link to "ana@example.com". Open it on this device to sign in.',
    );
    const other = buttonNamed('Use another email');
    expect(other.type).toBe('button');
    expect(other.classList).toContain('link');

    await click(other);
    expect(element.querySelector('h2'), '"Check your inbox" after "Use another email"').toBeNull();
    expect(field().value, 'field after "Use another email"').toBe('');
    expect(document.activeElement, 'focus after "Use another email"').toBe(field());
    expect(sendButton().disabled).toBe(false);
  });

  it('says "Couldn\'t send the link. Try again." when sending fails, keeping "ana@example.com" in the field, the button enabled again and the focus in the field (#43 6)', async () => {
    fake.sendLink = () => Promise.resolve(LINK_FAILED);
    await open();
    await type('ana@example.com');
    await click(sendButton());

    expect(fake.sent.length, 'not sent').toBe(1);
    expect(status().textContent?.trim()).toBe("Couldn't send the link. Try again.");
    expect(field().value).toBe('ana@example.com');
    expect(element.querySelector('h2'), '"Check your inbox"').toBeNull();
    expect(sendButton().disabled).toBe(false);
    expect(document.activeElement).toBe(field());
  });

  describe('edge cases', () => {
    it('shows "Anmelden", "E-Mail", "Anmeldelink senden" and "Wir schicken dir einen Link, der dich anmeldet. Kein Passwort nötig." in German (#43 3a)', async () => {
      localStorage.setItem(LANGUAGE_KEY, 'de');
      await open();
      expect(element.querySelector('h1')?.textContent?.trim()).toBe('Anmelden');
      expect(element.querySelector(`label[for="${field().id}"]`)?.textContent?.trim()).toBe(
        'E-Mail',
      );
      expect(textOf(sendButtonIn('Anmeldelink senden'))).toBe('Anmeldelink senden');
      expect(field().form!.nextElementSibling?.textContent?.trim()).toBe(
        'Wir schicken dir einen Link, der dich anmeldet. Kein Passwort nötig.',
      );
    });

    it('says "Gib deine E-Mail-Adresse ein." in German when submitted empty (#43 4b)', async () => {
      localStorage.setItem(LANGUAGE_KEY, 'de');
      await open();
      await click(sendButtonIn('Anmeldelink senden'));
      expect(status().textContent?.trim()).toBe('Gib deine E-Mail-Adresse ein.');
      expect(fake.sent).toEqual([]);
    });

    it('sends nothing more when the form is submitted again by Enter while the link is being sent (#43 5a)', async () => {
      const sending = deferred<typeof LINK_SENT>();
      fake.sendLink = () => sending.promise;
      await open();
      await type('ana@example.com');
      await click(sendButton());
      await pressEnter();
      expect(fake.sent.length).toBe(1);
      sending.resolve(LINK_SENT);
      await stable();
      expect(fake.sent.length).toBe(1);
    });

    it('shows "Sieh in deinem Posteingang nach", the German confirmation with „ana@example.com“ and "Andere E-Mail-Adresse" in German (#43 5b)', async () => {
      localStorage.setItem(LANGUAGE_KEY, 'de');
      await open();
      await type('ana@example.com');
      await click(sendButtonIn('Anmeldelink senden'));
      const heading = element.querySelector('h2');
      expect(heading?.textContent?.trim()).toBe('Sieh in deinem Posteingang nach');
      expect(textOf(heading!.nextElementSibling!)).toBe(
        'Wir haben einen Anmeldelink an „ana@example.com“ geschickt. Öffne ihn auf diesem Gerät, um dich anzumelden.',
      );
      expect(textOf(buttonNamed('Andere E-Mail-Adresse'))).toBe('Andere E-Mail-Adresse');
    });

    it('says "Der Link konnte nicht gesendet werden. Versuch es noch einmal." in German when sending fails (#43 6b)', async () => {
      localStorage.setItem(LANGUAGE_KEY, 'de');
      fake.sendLink = () => Promise.resolve(LINK_FAILED);
      await open();
      await type('ana@example.com');
      await click(sendButtonIn('Anmeldelink senden'));
      expect(status().textContent?.trim()).toBe(
        'Der Link konnte nicht gesendet werden. Versuch es noch einmal.',
      );
    });

    it('goes to the Plan page, replacing the URL, when the user is signed in meanwhile, as by the link opened in another tab (#43 7d)', async () => {
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      await open();
      await type('ana@example.com');
      await click(sendButton());
      expect(navigate, 'before signing in').not.toHaveBeenCalled();

      fake.emit('SIGNED_IN', sessionFor('ana@example.com'));
      await stable();
      expect(navigate).toHaveBeenCalledExactlyOnceWith('/plan', { replaceUrl: true });
    });

    it('lets the send end without an error when the user has left the page meanwhile (#43 5c)', async () => {
      const sending = deferred<typeof LINK_SENT>();
      fake.sendLink = () => sending.promise;
      // send() is protected; the spy only reaches the promise the form's submit starts
      const send = vi.spyOn(
        SignInPage.prototype as unknown as { send: () => Promise<void> },
        'send',
      );
      await open();
      await type('ana@example.com');
      await click(sendButton());
      fixture.destroy();
      sending.resolve(LINK_SENT);
      await expect(send.mock.results[0].value).resolves.toBeUndefined();
    });
  });

  async function open() {
    fixture = TestBed.createComponent(SignInPage);
    element = fixture.nativeElement as HTMLElement;
    await stable();
  }

  // jsdom doesn't focus what is clicked, unlike a browser
  async function click(target: HTMLElement) {
    target.focus();
    target.click();
    await stable();
  }

  async function type(text: string) {
    field().value = text;
    field().dispatchEvent(new Event('input', { bubbles: true }));
    await stable();
  }

  // Unless the keydown is handled, a browser submits the field's form on Enter, which jsdom doesn't
  async function pressEnter() {
    const enter = { key: 'Enter', bubbles: true, cancelable: true };
    if (field().dispatchEvent(new KeyboardEvent('keydown', enter))) {
      field().form?.requestSubmit();
    }
    field().dispatchEvent(new KeyboardEvent('keyup', enter));
    await stable();
  }

  // The fake client answers in promises, whose renders come after the microtasks they start
  async function stable() {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  function field(): HTMLInputElement {
    const input = element.querySelector<HTMLInputElement>('form input');
    expect(input, 'no field').not.toBeNull();
    return input!;
  }

  function status(): HTMLElement {
    const line = element.querySelector<HTMLElement>('[role="status"]');
    expect(line, 'no status line').not.toBeNull();
    return line!;
  }

  function sendButton(): HTMLButtonElement {
    return sendButtonIn('Send sign-in link');
  }

  function sendButtonIn(text: string): HTMLButtonElement {
    const button = Array.from(element.querySelectorAll('form button')).find(
      (candidate) => textOf(candidate) === text,
    );
    expect(button, `no "${text}" button`).toBeDefined();
    return button as HTMLButtonElement;
  }

  function buttonNamed(text: string): HTMLButtonElement {
    const button = Array.from(element.querySelectorAll('button')).find(
      (candidate) => textOf(candidate) === text,
    );
    expect(button, `no "${text}" button`).toBeDefined();
    return button as HTMLButtonElement;
  }

  function textOf(target: Element): string {
    return target.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }
});
