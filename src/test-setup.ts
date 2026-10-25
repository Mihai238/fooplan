import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';

// The tests don't bootstrap the app, so app.config.ts doesn't register it for them
registerLocaleData(localeDe);
