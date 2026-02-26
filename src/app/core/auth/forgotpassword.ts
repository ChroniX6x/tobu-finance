import {Component, inject} from '@angular/core';
import {IconField} from 'primeng/iconfield';
import {InputIcon} from 'primeng/inputicon';
import {InputText} from 'primeng/inputtext';
import {ButtonModule} from 'primeng/button';
import {RouterModule} from '@angular/router';
import {LayoutService} from '@/shell/service/layout.service';
import {Fluid} from 'primeng/fluid';
import {RippleModule} from 'primeng/ripple';
import {AppConfigurator} from "@/shell/components/app.configurator";
import {CommonModule} from "@angular/common";

@Component({
    standalone: true,
    selector: 'app-forgot-password',
    imports: [CommonModule, IconField, InputIcon, InputText, ButtonModule, RippleModule, RouterModule, Fluid, AppConfigurator],
    template: ` <div [class]="'flex min-h-screen  ' + (layoutService.isDarkTheme() ? 'layout-dark' : 'layout-light')">
        <div *ngIf="layoutService.isDarkTheme()" class="w-6/12 h-screen hidden md:block flex-shrink-0" style="max-width: 490px; background-image: url('/images/pages/forgot-password-ondark.png'); background-repeat: no-repeat; background-size: cover"></div>
        <div *ngIf="!layoutService.isDarkTheme()" class="w-6/12 h-screen hidden md:block flex-shrink-0" style="max-width: 490px; background-image: url('/images/pages/forgot-password-onlight.png'); background-repeat: no-repeat; background-size: cover"></div>
        <div class="w-full" style="background: var(--surface-ground)">
            <p-fluid class="min-h-screen text-center w-full flex items-center md:items-start justify-center flex-col bg-auto md:bg-contain !bg-no-repeat" style="padding: 20% 10% 20% 10%; background: var(--exception-pages-image); background-size: contain;">
                <div class="flex flex-col">
                    <div class="flex items-center mb-12">
                        <img src="/images/logo-{{ layoutService.isDarkTheme() ? 'light' : 'dark' }}.png" style="width: 45px" alt="logo" />
                        <img src="/images/appname-{{ layoutService.isDarkTheme() ? 'light' : 'dark' }}.png" class="ml-4" style="width: 100px" />
                    </div>
                    <div class="form-container text-left" style="max-width: 320px; min-width: 270px">
                        <span class="text-2xl font-semibold m-0">Forgot Password</span>
                        <span class="block text-surface-600 dark:text-surface-200 font-medium mb-6 mt-4">Enter your email to reset your password</span>
                        <p-icon-field>
                            <p-inputicon class="pi pi-envelope" />
                            <input pInputText type="text" placeholder="Email" class="block mb-4" style="max-width: 320px; min-width: 270px" />
                        </p-icon-field>
                    </div>
                    <div class="mt-6 text-left" style="max-width: 320px; min-width: 270px">
                        <div class="flex items-center gap-4">
                            <button pButton pRipple type="button" [routerLink]="['/']" class="block" style="max-width: 320px; margin-bottom: 32px">Submit</button>
                        </div>
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
export class ForgotPassword {
    layoutService = inject(LayoutService);
}
