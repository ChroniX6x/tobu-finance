import {Component, inject, signal} from '@angular/core';
import {IconField} from 'primeng/iconfield';
import {InputIcon} from 'primeng/inputicon';
import {ButtonModule} from 'primeng/button';
import {Router, RouterModule} from '@angular/router';
import {FormsModule} from '@angular/forms';
import {InputText} from 'primeng/inputtext';
import {Checkbox} from 'primeng/checkbox';
import {Fluid} from 'primeng/fluid';
import {LayoutService} from '@/shell/service/layout.service';
import {Ripple} from 'primeng/ripple';
import {AppConfigurator} from "@/shell/components/app.configurator";
import {CommonModule} from "@angular/common";
import {AuthService} from './services/auth.service';

@Component({
    selector: 'app-register',
    standalone: true,
    imports: [CommonModule, IconField, InputIcon, ButtonModule, RouterModule, FormsModule, InputText, Checkbox, Fluid, Ripple, AppConfigurator],
    template: `
        <div [class]="'flex min-h-screen  ' + (layoutService.isDarkTheme() ? 'layout-dark' : 'layout-light')">
            <div *ngIf="layoutService.isDarkTheme()" class="w-6/12 h-screen hidden md:block flex-shrink-0" style="max-width: 490px; background-image: url('/images/pages/register-ondark.png'); background-repeat: no-repeat; background-size: cover"></div>
            <div *ngIf="!layoutService.isDarkTheme()" class="w-6/12 h-screen hidden md:block flex-shrink-0" style="max-width: 490px; background-image: url('/images/pages/register-onlight.png'); background-repeat: no-repeat; background-size: cover"></div>
            <div class="w-full" style="background: var(--surface-ground)">
                <p-fluid class="min-h-screen text-center w-full flex items-center md:items-start justify-center flex-col bg-auto md:bg-contain !bg-no-repeat" style="padding: 20% 10% 20% 10%; background: var(--exception-pages-image); background-size: contain;">
                    <div class="flex flex-col">
                        <div class="flex items-center mb-12">
                            <img src="/images/logo-{{ layoutService.isDarkTheme() ? 'light' : 'dark' }}.png" style="width: 45px" alt="logo" />
                            <img src="/images/appname-{{ layoutService.isDarkTheme() ? 'light' : 'dark' }}.png" class="ml-4" style="width: 100px" alt="logo" />
                        </div>
                        <div class="form-container text-left" style="max-width: 320px; min-width: 270px">
                            <span class="text-2xl font-semibold m-0 mb-2">Register</span>
                            <span class="block text-surface-600 dark:text-surface-200 font-medium mb-6">Let's get started</span>

                            @if (errorMessage()) {
                                <div class="p-3 mb-4 bg-red-100 dark:bg-red-900 text-red-900 dark:text-red-100 border border-red-200 dark:border-red-800 rounded" style="white-space: pre-line;">
                                    {{ errorMessage() }}
                                </div>
                            }

                            <p-icon-field>
                                <p-inputicon class="pi pi-user" />
                                <input pInputText type="text" [(ngModel)]="name" placeholder="Username" class="block mb-4" style="max-width: 320px; min-width: 270px" />
                            </p-icon-field>

                            <p-icon-field>
                                <p-inputicon class="pi pi-envelope" />
                                <input pInputText type="email" [(ngModel)]="email" autocomplete="off" placeholder="Email" class="block mb-4" style="max-width: 320px; min-width: 270px" />
                            </p-icon-field>
                            <p-icon-field>
                                <p-inputicon class="pi pi-key" />
                                <input pInputText type="password" [(ngModel)]="password" autocomplete="off" placeholder="Password" class="block mb-4" style="max-width: 320px; min-width: 270px" />
                            </p-icon-field>

                            <div class="mt-2 flex flex-wrap">
                                <p-checkbox type="checkbox" id="confirmed" [(ngModel)]="confirmed" class="mr-2" />
                                <label for="confirmed" class="text-surface-900 dark:text-surface-0 font-medium mr-2">I have read the</label>
                                <a class="text-surface-600 dark:text-surface-200 hover:text-primary cursor-pointer">Terms and Conditions</a>
                            </div>
                        </div>
                        <div class="mt-6 text-left" style="max-width: 320px; min-width: 270px">
                            <div class="flex items-center gap-4">
                                <button pButton pRipple type="button" [routerLink]="['/auth/login']" class="block" severity="danger" outlined style="max-width: 320px; margin-bottom: 32px">Cancel</button>
                                <button pButton pRipple type="button" (click)="onRegister()" [disabled]="isLoading()" [loading]="isLoading()" class="block" style="max-width: 320px; margin-bottom: 32px">Submit</button>
                            </div>
                            <span class="font-medium text-surface-600 dark:text-surface-200"
                                >Already have an account? <a [routerLink]="['/auth/login']" class="font-semibold cursor-pointer text-surface-900 dark:text-surface-0 hover:text-primary transition-colors duration-300">Login</a></span
                            >
                        </div>
                    </div>

                    <div class="flex items-center mt-6">
                        <div class="flex items-center pr-6 mr-6 border-r border-surface-200 dark:border-surface-700">
                            <img src="/images/logo-gray.png" style="width: 22px" alt="logo" />
                            <img src="/images/appname-gray.png" class="ml-2" style="width: 45px" alt="logo" />
                        </div>
                        <span class="text-sm text-surface-500 dark:text-surface-400 mr-4">Copyright 2025</span>
                    </div>
                </p-fluid>
            </div>
        </div>
        <app-configurator [simple]="true"/>`
})
export class Register {
    private authService = inject(AuthService);
    private router = inject(Router);
    protected layoutService = inject(LayoutService);

    protected name = '';
    protected email = '';
    protected password = '';
    protected confirmed = false;
    protected isLoading = signal(false);
    protected errorMessage = signal<string | null>(null);

    protected onRegister(): void {
        if (!this.name || !this.email || !this.password) {
            this.errorMessage.set('Please fill in all fields');
            return;
        }

        if (!this.confirmed) {
            this.errorMessage.set('Please accept the Terms and Conditions');
            return;
        }

        this.isLoading.set(true);
        this.errorMessage.set(null);

        this.authService.register({
            name: this.name,
            email: this.email,
            password: this.password
        }).subscribe({
            next: () => {
                this.isLoading.set(false);
                this.router.navigate(['/accounts']);
            },
            error: (err) => {
                this.isLoading.set(false);
                const message = err.message || 'Registration failed. Please check your input and try again.';
                this.errorMessage.set(message);
                console.error('[Register] Error:', err);
            }
        });
    }
}
