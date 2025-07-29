import {Component, inject} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {RouterModule} from '@angular/router';
import {ButtonModule} from 'primeng/button';
import {CheckboxModule} from 'primeng/checkbox';
import {InputTextModule} from 'primeng/inputtext';
import {PasswordModule} from 'primeng/password';
import {RippleModule} from 'primeng/ripple';
import {InputIcon} from 'primeng/inputicon';
import {IconField} from 'primeng/iconfield';
import {LayoutService} from '@/core/layout/service/layout.service';
import {Fluid} from 'primeng/fluid';
import {AppConfigurator} from "@/core/layout/components/app.configurator";
import {CommonModule} from "@angular/common";

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [CommonModule, ButtonModule, CheckboxModule, InputTextModule, PasswordModule, FormsModule, RouterModule, RippleModule, InputIcon, IconField, Fluid, AppConfigurator],
    template: `
        <div [class]="'flex min-h-screen  ' + (layoutService.isDarkTheme() ? 'layout-dark' : 'layout-light')">
            <div *ngIf="layoutService.isDarkTheme()" class="w-6/12 h-screen hidden md:block flex-shrink-0" style="max-width: 490px; background-image: url('/images/pages/login-ondark.png'); background-repeat: no-repeat; background-size: cover"></div>
            <div *ngIf="!layoutService.isDarkTheme()" class="w-6/12 h-screen hidden md:block flex-shrink-0" style="max-width: 490px; background-image: url('/images/pages/login-onlight.png'); background-repeat: no-repeat; background-size: cover"></div>
            <div class="w-full" style="background: var(--surface-ground)">
                <p-fluid class="min-h-screen text-center w-full flex items-center md:items-start justify-center flex-col bg-auto md:bg-contain !bg-no-repeat" style="padding: 20% 10% 20% 10%; background: var(--exception-pages-image); background-size: contain;">
                    <div class="flex flex-col">
                        <div class="flex items-center mb-12">
                            <img src="/images/logo-{{ layoutService.isDarkTheme() ? 'light' : 'dark' }}.png" style="width: 45px" alt="logo" />
                            <img src="/images/appname-{{ layoutService.isDarkTheme() ? 'light' : 'dark' }}.png" class="ml-4" style="width: 100px" alt="logo" />
                        </div>
                        <div class="form-container">
                            <p-iconfield>
                                <p-inputicon class="pi pi-envelope" />
                                <input pInputText type="text" placeholder="Email" class="block mb-4" style="max-width: 320px; min-width: 270px" />
                            </p-iconfield>

                            <p-iconfield>
                                <p-inputicon class="pi pi-key" />
                                <input pInputText type="password" placeholder="Password" class="block mb-4" style="max-width: 320px; min-width: 270px" />
                            </p-iconfield>
                            <a href="#" class="flex text-surface-500 dark:text-surface-400 mb-6 text-sm">Forgot your password?</a>
                        </div>
                        <div class="mt-6">
                            <button pButton pRipple type="button" [routerLink]="['/']" class="block" style="max-width: 320px; margin-bottom: 32px">Login</button>
                            <span class="flex text-sm text-surface-500 dark:text-surface-400">Don’t have an account?<a class="cursor-pointer ml-1">Sign-up here</a></span>
                        </div>
                    </div>

                    <div class="flex items-center absolute" style="bottom: 75px">
                        <div class="flex items-center pr-6 mr-6 border-r border-surface-200 dark:border-surface-700">
                            <img src="/images/logo-gray.png" style="width: 22px" />
                            <img src="/images/appname-gray.png" class="ml-2" style="width: 45px" />
                        </div>
                        <span class="text-sm text-surface-500 dark:text-surface-400 mr-4">Copyright 2025</span>
                    </div>
                </p-fluid>
            </div>
        </div>
        <app-configurator [simple]="true"/>`
})
export class Login {
    layoutService = inject(LayoutService);
}
