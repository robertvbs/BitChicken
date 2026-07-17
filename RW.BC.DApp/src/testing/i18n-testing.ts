import { Provider } from '@angular/core';
import { Observable, of } from 'rxjs';
import { provideTranslateService, TranslateLoader, TranslationObject } from '@ngx-translate/core';

class TestTranslateLoader implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of({});
  }
}

export function provideTranslateTesting(): Provider[] {
  return provideTranslateService({
    loader: { provide: TranslateLoader, useClass: TestTranslateLoader },
    fallbackLang: 'en-US',
    lang: 'en-US',
  });
}
