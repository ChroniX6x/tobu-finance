import { InjectionToken } from '@angular/core';

/**
 * Injection Token für die API-Basis-URL.
 * Beispiel-Werte:
 *  - 'http://localhost:4000' (json-server)
 *  - 'https://api.example.com'
 *
 * Hinweis: Ohne abschließenden Slash angeben.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL');
