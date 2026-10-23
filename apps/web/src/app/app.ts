import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PrimeNG } from 'primeng/config';
import { AuthStore } from './core/auth/services/auth.store';

@Component({
  selector: 'tbf-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('tobu-finance');
  private config = inject(PrimeNG);
  private authStore = inject(AuthStore);

  constructor() {
    this.config.ripple.set(true);

    // Initialize auth store from session storage
    this.authStore.initialize();
  }
}
