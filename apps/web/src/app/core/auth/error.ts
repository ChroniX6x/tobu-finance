import {Component, inject} from '@angular/core';
import {RouterModule} from '@angular/router';
import {ButtonModule} from 'primeng/button';
import {RippleModule} from 'primeng/ripple';
import {LayoutService} from '@/shell/service/layout.service';
import {AppConfigurator} from "@/shell/components/app.configurator";

@Component({
    selector: 'app-error',
    imports: [ButtonModule, RippleModule, RouterModule, AppConfigurator],
    standalone: true,
    template: ` <div [class]="'min-h-screen ' + (layoutService.isDarkTheme() ? 'layout-dark' : 'layout-light')" style="background: var(--surface-ground)">
        <div
            class="min-h-screen flex items-center justify-center flex-col bg-auto md:bg-contain bg-no-repeat!"
            [style]="{
                background: 'var(--exception-pages-image)',
                backgroundRepeat: 'no-repeat',
                backgroundSize: 'contain',
                boxSizing: 'border-box'
            }"
        >
            <div class="text-center flex items-center justify-center flex-col" style="margin-top: -200px; box-sizing: border-box">
                <h1 class="text-red-400 mb-0" style="font-size: 140px; font-weight: 900; text-shadow: 0px 0px 50px rgba(#fc6161, 0.2)">ERROR</h1>
                <h3 class="text-red-300" style="font-size: 80px; font-weight: 900; margin-top: -90px; margin-bottom: 50px">something's went wrong</h3>
                <button pButton pRipple [routerLink]="['/']" style="margin-top: 50px">Go back to home</button>
            </div>
            <div class="absolute items-center flex" style="bottom: 60px">
                <img src="/images/logo-{{ layoutService.isDarkTheme() ? 'light' : 'dark' }}.png" class="exception-logo" style="width: 34px" alt="logo" />
                <img src="/images/appname-{{ layoutService.isDarkTheme() ? 'light' : 'dark' }}.png" class="exception-appname ml-4" style="width: 72px" alt="logo" />
            </div>
        </div>
    </div>
    <app-configurator [simple]="true"/>`
})
export class Error {
    layoutService = inject(LayoutService);
}
