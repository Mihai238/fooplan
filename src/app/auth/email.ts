// The browser's own rule for an email field (WHATWG "valid email address"); the form checks it
// itself so the browser shows no bubble of its own
const VALID_EMAIL =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export function isEmail(value: string): boolean {
  return VALID_EMAIL.test(value);
}
