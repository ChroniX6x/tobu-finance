import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { provideRouter } from '@angular/router';
import { AuthStore } from './core/auth/services/auth.store';

describe('App', () => {
  let authStore: jasmine.SpyObj<AuthStore>;
  beforeEach(async () => {
    authStore = jasmine.createSpyObj<AuthStore>('AuthStore', ['initialize']);
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideZonelessChangeDetection(), provideRouter([]), { provide: AuthStore, useValue: authStore }]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('initializes authentication and renders the routed application shell', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(authStore.initialize).toHaveBeenCalledTimes(1);
    expect(compiled.querySelector('router-outlet')).not.toBeNull();
  });
});
