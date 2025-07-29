import {Component, inject} from '@angular/core';
import {ButtonModule} from 'primeng/button';
import {Ripple} from 'primeng/ripple';
import {RouterModule} from '@angular/router';
import {FormsModule} from '@angular/forms';
import {InputNumber} from 'primeng/inputnumber';
import {LayoutService} from '@/core/layout/service/layout.service';
import {Fluid} from 'primeng/fluid';
import {AppConfigurator} from "@/core/layout/components/app.configurator";
import {CommonModule} from "@angular/common";

@Component({
    selector: 'app-verification',
    standalone: true,
    imports: [CommonModule, ButtonModule, Ripple, RouterModule, FormsModule, InputNumber, Fluid, AppConfigurator],
    template: `<div [class]="'flex min-h-screen  ' + (layoutService.isDarkTheme() ? 'layout-dark' : 'layout-light')">
        <div *ngIf="layoutService.isDarkTheme()" class="w-6/12 h-screen hidden md:block flex-shrink-0" style="max-width: 490px; background-image: url('/images/pages/verification-ondark.png'); background-repeat: no-repeat; background-size: cover"></div>
        <div *ngIf="!layoutService.isDarkTheme()" class="w-6/12 h-screen hidden md:block flex-shrink-0" style="max-width: 490px; background-image: url('/images/pages/verification-onlight.png'); background-repeat: no-repeat; background-size: cover"></div>
        <div class="w-full" style="background: var(--surface-ground)">

            <p-fluid class="min-h-screen text-center w-full flex items-center md:items-start justify-center flex-col bg-auto md:bg-contain !bg-no-repeat" style="padding: 20% 10% 20% 10%; background: var(--exception-pages-image); background-size: contain;">
                <div class="flex flex-col">
                    <div class="flex items-center mb-12">
                        <img src="/images/logo-{{ layoutService.isDarkTheme() ? 'light' : 'dark' }}.png" style="width: 45px" alt="logo" />
                        <img src="/images/appname-{{ layoutService.isDarkTheme() ? 'light' : 'dark' }}.png" class="ml-4" style="width: 100px" alt="logo" />
                    </div>
                    <div class="form-container text-left" style="max-width: 320px; min-width: 270px">
                        <span class="text-surface-900 dark:text-surface-0 font-bold mb-2 text-2xl m-0 block p-0 ">Verification</span>
                        <span class="text-surface-600 dark:text-surface-200 font-medium">We have sent code to you email:</span>
                        <div class="flex items-center mt-1 mb-6">
                            <i class="pi pi-envelope text-surface-600 dark:text-surface-200"></i>
                            <span class="text-surface-900 dark:text-surface-0 font-bold ml-2">dm**&#64;gmail.com</span>
                        </div>
                        <div class="flex justify-between w-full items-center gap-4">
                            <p-inputNumber inputStyleClass="text-center" [maxlength]="1" (onInput)="focusOnNext(input2)"></p-inputNumber>
                            <p-inputNumber #input2 inputStyleClass="text-center" [maxlength]="1" (onInput)="focusOnNext(input3)"></p-inputNumber>
                            <p-inputNumber #input3 inputStyleClass="text-center" [maxlength]="1" (onInput)="focusOnNext(input4)"></p-inputNumber>
                            <p-inputNumber #input4 inputStyleClass="text-center" [maxlength]="1"></p-inputNumber>
                        </div>
                    </div>
                    <div class="mt-6 text-left" style="max-width: 320px; min-width: 270px">
                        <div class="flex items-center gap-4">
                            <button pButton pRipple type="button" [routerLink]="['/']" class="block" severity="danger" outlined style="max-width: 320px; margin-bottom: 32px">Cancel</button>
                            <button pButton pRipple type="button" class="block" style="max-width: 320px; margin-bottom: 32px">Verify</button>
                        </div>
                    </div>
                </div>
                <div class="flex items-center absolute" style="bottom: 75px">
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
export class Verification {
    value: string = '';

    focusOnNext(inputEl: InputNumber) {
        inputEl.input.nativeElement.focus();
    }

    layoutService = inject(LayoutService);
}
