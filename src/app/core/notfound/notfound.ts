import {Component, inject} from '@angular/core';
import {RouterModule} from '@angular/router';
import {ButtonModule} from 'primeng/button';
import {LayoutService} from '@/core/layout/service/layout.service';
import {RippleModule} from 'primeng/ripple';
import {AppConfigurator} from "@/core/layout/components/app.configurator";

@Component({
    selector: 'app-notfound',
    standalone: true,
    imports: [RouterModule, ButtonModule, RippleModule, AppConfigurator],
    template: ` <div [class]="'min-h-screen ' + (layoutService.isDarkTheme() ? 'layout-dark' : 'layout-light')" style="background: var(--surface-ground)">
        <div
            class="exception-container min-h-screen flex items-center justify-center flex-col bg-auto md:bg-contain bg-no-repeat"
            style="box-sizing: border-box; background: var(--exception-pages-image); background-repeat: no-repeat; background-size: contain"
        >
            <div class="text-center flex items-center justify-center flex-col" style="margin-top: -200px; box-sizing: border-box">
                <h1 class="text-blue-500 mb-0" style="font-size: 140px; font-weight: 900; text-shadow: 0px 0px 50px rgba(#0f8bfd, 0.2)">404</h1>
                <h3 class="text-blue-700" style="font-size: 80px; font-weight: 900; margin-top: -90px; margin-bottom: 50px">not found</h3>
                <p class="text-3xl" style="max-width: 320px">The page that you are looking for does not exist</p>
                <button pButton pRipple type="button" label="Go back to home" style="margin-top: 50px" [routerLink]="['/']"></button>
            </div>
            <div class="absolute items-center flex" style="bottom: 60px">
                <img src="/images/logo-{{ layoutService.isDarkTheme() ? 'light' : 'dark' }}.png" class="exception-logo" style="width: 34px" alt="logo" />
                <img src="/images/appname-{{ layoutService.isDarkTheme() ? 'light' : 'dark' }}.png" class="exception-appname ml-4" style="width: 72px" alt="logo" />
            </div>
        </div>
    </div>
    <app-configurator [simple]="true"/>`
})
export class Notfound {
    layoutService = inject(LayoutService);
}
