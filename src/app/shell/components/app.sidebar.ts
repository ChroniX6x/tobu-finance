import {Component, computed, ElementRef, HostListener, inject, ViewChild} from '@angular/core';
import {AppMenu} from './app.menu';
import {ButtonModule} from 'primeng/button';
import {Router, RouterModule} from '@angular/router';
import {CommonModule} from '@angular/common';
import {LayoutService} from '@/shell/service/layout.service';

@Component({
    selector: '[app-sidebar]',
    standalone: true,
    imports: [AppMenu, ButtonModule, RouterModule, CommonModule],
    template: `
        <div class="sidebar-header">
            <a [routerLink]="['/']" class="app-logo" style="cursor: pointer">
                <div class="app-logo-small">
                    <img class="!inline-block" src="/images/logo-{{ logo() }}.png" />
                </div>
                <div class="app-logo-normal">
                    <img class="!inline-block" src="/images/logo-{{ logo() }}.png" />
                    <img class="ml-4 !inline-block" src="/images/appname-{{ logo() }}.png" />
                </div>
            </a>
            <button class="layout-sidebar-anchor z-20" type="button" (click)="onAnchorToggle()"></button>
        </div>
        <div app-menu></div>
    `,
    host: {
        class: 'layout-sidebar'
    }
})
export class AppSidebar {
    el = inject(ElementRef);

    router = inject(Router);

    layoutService = inject(LayoutService);

    @ViewChild(AppMenu) appMenu!: AppMenu;

    logo = computed(() => (this.layoutService.isDarkTheme() ? 'light' : 'dark'));

    timeout!: any;

    onAnchorToggle() {
        this.layoutService.layoutState.update((val) => ({ ...val, anchored: !val.anchored }));
    }

    @HostListener('mouseenter', ['$event'])
    onMouseEnter(event: MouseEvent) {
        if (!this.layoutService.layoutState().anchored) {
            if (this.timeout) {
                this.timeout = null;
            }
            this.layoutService.layoutState.update((val) => ({ ...val, sidebarActive: true }));
        }
    }

    @HostListener('mouseleave', ['$event'])
    onMouseLeave(event: MouseEvent) {
        if (!this.layoutService.layoutState().anchored) {
            if (!this.timeout) {
                this.timeout = setTimeout(() => {
                    this.layoutService.layoutState.update((val) => ({ ...val, sidebarActive: false }));
                    this.timeout = null;
                }, 300);
            }
        }
    }
}
