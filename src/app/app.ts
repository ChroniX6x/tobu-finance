import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PrimeNG } from 'primeng/config';

@Component({
  selector: 'tbf-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('tobu-finance');
  private config = inject(PrimeNG)

  constructor() {
    this.config.ripple.set(true);
  }
}
