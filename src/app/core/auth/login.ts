import {Component, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {Router, RouterModule} from '@angular/router';
import {ButtonModule} from 'primeng/button';
import {CheckboxModule} from 'primeng/checkbox';
import {InputTextModule} from 'primeng/inputtext';
import {PasswordModule} from 'primeng/password';
import {RippleModule} from 'primeng/ripple';
import {InputIcon} from 'primeng/inputicon';
import {IconField} from 'primeng/iconfield';
import {LayoutService} from '@/shell/service/layout.service';
import {Fluid} from 'primeng/fluid';
import {AppConfigurator} from "@/shell/components/app.configurator";
import {CommonModule} from "@angular/common";
import {AuthService} from './services/auth.service';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [CommonModule, ButtonModule, CheckboxModule, InputTextModule, PasswordModule, FormsModule, RouterModule, RippleModule, InputIcon, IconField, Fluid, AppConfigurator],
    template: `
        <div [class]="'flex min-h-screen  ' + (layoutService.isDarkTheme() ? 'layout-dark' : 'layout-light')">
            <div *ngIf="layoutService.isDarkTheme()" class="w-6/12 h-screen hidden md:block shrink-0" style="max-width: 490px; background-image: url('/images/pages/login-ondark.png'); background-repeat: no-repeat; background-size: cover"></div>
            <div *ngIf="!layoutService.isDarkTheme()" class="w-6/12 h-screen hidden md:block shrink-0" style="max-width: 490px; background-image: url('/images/pages/login-onlight.png'); background-repeat: no-repeat; background-size: cover"></div>
            <div class="w-full" style="background: var(--surface-ground)">
                <p-fluid class="min-h-screen text-center w-full flex items-center md:items-start justify-center flex-col bg-auto md:bg-contain bg-no-repeat!" style="padding: 20% 10% 20% 10%; background: var(--exception-pages-image); background-size: contain;">
                    <div class="flex flex-col">
                        <div class="flex items-center mb-12">
                            <img src="/images/logo-{{ layoutService.isDarkTheme() ? 'light' : 'dark' }}.png" style="width: 45px" alt="logo" />
                            <img src="/images/appname-{{ layoutService.isDarkTheme() ? 'light' : 'dark' }}.png" class="ml-4" style="width: 100px" alt="logo" />
                        </div>

                        @if (errorMessage()) {
                            <div class="p-3 mb-4 bg-red-100 dark:bg-red-900 text-red-900 dark:text-red-100 border border-red-200 dark:border-red-800 rounded" style="max-width: 320px; white-space: pre-line;">
                                {{ errorMessage() }}
                            </div>
                        }

                        <div class="form-container">
                            <p-iconfield>
                                <p-inputicon class="pi pi-envelope" />
                                <input pInputText type="email" [(ngModel)]="email" placeholder="Email" class="block mb-4" style="max-width: 320px; min-width: 270px" />
                            </p-iconfield>

                            <p-iconfield>
                                <p-inputicon class="pi pi-key" />
                                <input pInputText type="password" [(ngModel)]="password" (keyup.enter)="onLogin()" placeholder="Password" class="block mb-4" style="max-width: 320px; min-width: 270px" />
                            </p-iconfield>
                            <a [routerLink]="['/auth/forgotpassword']" class="flex text-surface-500 dark:text-surface-400 mb-6 text-sm cursor-pointer">Forgot your password?</a>
                        </div>
                        <div class="mt-6">
                            <button pButton pRipple type="button" (click)="onLogin()" [disabled]="isLoading()" [loading]="isLoading()" class="block" style="max-width: 320px; margin-bottom: 32px">Login</button>
                            <span class="flex text-sm text-surface-500 dark:text-surface-400">Don't have an account?<a [routerLink]="['/auth/register']" class="cursor-pointer ml-1">Sign-up here</a></span>
                        </div>
                    </div>

                    <div class="flex items-center absolute" style="bottom: 75px">
                        <div class="flex items-center pr-6 mr-6 border-r border-surface-200 dark:border-surface-700">
                            <img src="/images/logo-gray.png" style="width: 22px" />
                            <img src="/images/appname-gray.png" class="ml-2" style="width: 45px" />
                        </div>
                        <span class="text-sm text-surface-500 dark:text-surface-400 mr-4">Copyright 2026</span>
                    </div>
                </p-fluid>
            </div>
        </div>
        <app-configurator [simple]="true"/>`
})
export class Login {
    private authService = inject(AuthService);
    private router = inject(Router);
    protected layoutService = inject(LayoutService);

    protected email = '';
    protected password = '';
    protected isLoading = signal(false);
    protected errorMessage = signal<string | null>(null);

    protected onLogin(): void {
        if (!this.email || !this.password) {
            this.errorMessage.set('Please enter email and password');
            return;
        }

        this.isLoading.set(true);
        this.errorMessage.set(null);

        this.authService.login({ email: this.email, password: this.password }).subscribe({
            next: () => {
                this.isLoading.set(false);
                this.router.navigate(['/accounts']);
            },
            error: (err) => {
                this.isLoading.set(false);
                const message = err.message || 'Login failed. Please check your credentials and try again.';
                this.errorMessage.set(message);
                console.error('[Login] Error:', err);
            }
        });
    }
}
