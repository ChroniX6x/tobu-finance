import {Component, computed, ElementRef, inject, ViewChild} from '@angular/core';
import {ActivatedRouteSnapshot, NavigationEnd, Router, RouterModule} from '@angular/router';
import {BehaviorSubject} from 'rxjs';
import {filter} from 'rxjs/operators';
import {CommonModule} from '@angular/common';
import {IconField} from 'primeng/iconfield';
import {InputIcon} from 'primeng/inputicon';
import {InputText} from 'primeng/inputtext';
import {ButtonModule} from 'primeng/button';
import {RippleModule} from 'primeng/ripple';
import {LayoutService} from '@/shell/service/layout.service';

interface Breadcrumb {
    label: string;
    url?: string;
}

@Component({
    selector: '[app-breadcrumb]',
    standalone: true,
    imports: [CommonModule, RouterModule, IconField, InputIcon, InputText, ButtonModule, RippleModule],
    template: ` <nav>
            <ol class="relative z-20">
                <ng-template ngFor let-item let-last="last" [ngForOf]="breadcrumbs$ | async">
                    <li style="cursor: pointer;">{{ item.label }}</li>
                    <li *ngIf="!last" class="layout-breadcrumb-chevron">/</li>
                </ng-template>
            </ol>
        </nav>
        <ul class="breadcrumb-menu flex items-center justify-end lg:hidden absolute right-0 top-0 z-40 h-12 w-screen">
            <li class="w-full m-0 ml-4">
                <div class="breadcrumb-search flex justify-end" [ngClass]="{ 'breadcrumb-search-active': searchActive() }">
                    <button pButton pRipple icon="pi pi-search" class="breadcrumb-searchbutton text-surface-500 dark:text-surface-400 flex-shrink-0" type="button" severity="secondary" text rounded (click)="activateSearch()"></button>
                    <div class="search-input-wrapper">
                        <p-icon-field>
                            <p-inputicon class="pi pi-search" />
                            <input pInputText #searchinput autofocus type="text" placeholder="Search" (blur)="deactivateSearch()" (keydown.escape)="deactivateSearch()" />
                        </p-icon-field>
                    </div>
                </div>
            </li>
            <li class="right-panel-button relative">
                <button pButton pRipple type="button" label="Today" style="width: 6.7rem" icon="pi pi-bookmark" class="layout-rightmenu-button !hidden md:!inline-flex font-normal" (click)="onProfileMenuButtonClick()"></button>
                <Button pButton pRipple style="width: 3.286rem" icon="pi pi-bookmark" class="layout-rightmenu-button !block md:!hidden font-normal" (click)="onProfileMenuButtonClick()"></Button>
            </li>
        </ul>`,
    host: {
        class: 'layout-breadcrumb flex items-center relative h-12'
    }
})
export class AppBreadcrumb {
    @ViewChild('searchinput') searchInput!: ElementRef<HTMLElement>;

    private readonly _breadcrumbs$ = new BehaviorSubject<Breadcrumb[]>([]);

    readonly breadcrumbs$ = this._breadcrumbs$.asObservable();

    constructor(private router: Router) {
        this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe((event) => {
            const root = this.router.routerState.snapshot.root;
            const breadcrumbs: Breadcrumb[] = [];
            this.addBreadcrumb(root, [], breadcrumbs);

            this._breadcrumbs$.next(breadcrumbs);
        });
    }

    layoutService = inject(LayoutService);

    searchActive = computed(() => this.layoutService.layoutState().searchBarActive);

    private addBreadcrumb(route: ActivatedRouteSnapshot, parentUrl: string[], breadcrumbs: Breadcrumb[]) {
        const routeUrl = parentUrl.concat(route.url.map((url) => url.path));
        const breadcrumb = route.data['breadcrumb'];
        const parentBreadcrumb = route.parent && route.parent.data ? route.parent.data['breadcrumb'] : null;

        if (breadcrumb && breadcrumb !== parentBreadcrumb) {
            breadcrumbs.push({
                label: route.data['breadcrumb'],
                url: '/' + routeUrl.join('/')
            });
        }

        if (route.firstChild) {
            this.addBreadcrumb(route.firstChild, routeUrl, breadcrumbs);
        }
    }

    activateSearch() {
        this.layoutService.layoutState.update((val) => ({
            ...val,
            searchBarActive: true
        }));
        setTimeout(() => {
            this.searchInput.nativeElement?.focus();
            console.log(this.searchInput);
        }, 250);
    }

    deactivateSearch() {
        this.layoutService.layoutState.update((val) => ({
            ...val,
            searchBarActive: false
        }));
    }

    onProfileMenuButtonClick() {
        this.layoutService.layoutState.update((val) => ({
            ...val,
            rightMenuActive: true
        }));
    }

}
