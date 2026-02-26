import { Component, computed, effect, ElementRef, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, Subject, takeUntil } from 'rxjs';
import { AppMenu } from './app.menu';
import { LayoutService } from '@/shell/service/layout.service';

const BREAKPOINT = 992;

@Component({
    selector: '[app-sidebar]',
    standalone: true,
    imports: [AppMenu, RouterModule],
    template: `
        <div #sidebarRef class="layout-sidebar" (mouseenter)="onMouseEnter()" (mouseleave)="onMouseLeave()">
            <div class="sidebar-header">
                <a [routerLink]="['/']" class="app-logo" style="cursor: pointer">
                    <div class="app-logo-small h-8">
                        <img class="inline-block!" [src]="'/images/logo-' + logo() + '.png'" />
                    </div>
                    <div class="app-logo-normal">
                        <img class="h-8 inline-block!" [src]="'/images/logo-' + logo() + '.png'" />
                        <img class="h-8 ml-4 inline-block!" [src]="'/images/appname-' + logo() + '.png'" />
                    </div>
                </a>
                <button class="layout-sidebar-anchor p-link z-20 hover:cursor-pointer" type="button" (click)="onAnchorToggle()"></button>
            </div>

            <div #menuContainer class="layout-menu-container" (scroll)="onMenuScroll()">
                <app-menu></app-menu>
            </div>
        </div>
    `
})
export class AppSidebar implements OnInit, OnDestroy {
    layoutService = inject(LayoutService);

    router = inject(Router);

    el = inject(ElementRef);

    @ViewChild('menuContainer') menuContainer!: ElementRef;

    @ViewChild('sidebarRef') sidebarRef!: ElementRef;

    private timeout: any = null;

    private observer: IntersectionObserver | null = null;

    private outsideClickListener: ((event: MouseEvent) => void) | null = null;

    private mediaQuery = window.matchMedia(`(min-width: ${BREAKPOINT}px)`);

    private destroy$ = new Subject<void>();

    logo = computed(() => this.layoutService.logo());

    constructor() {
        effect(() => {
            const state = this.layoutService.layoutState();
            const hasOpenOverlay = this.layoutService.hasOpenOverlay();

            if (this.layoutService.isDesktop()) {
                if (hasOpenOverlay) {
                    this.bindOutsideClickListener();
                } else {
                    this.unbindOutsideClickListener();
                }
            } else {
                if (state.mobileMenuActive) {
                    this.bindOutsideClickListener();
                } else {
                    this.unbindOutsideClickListener();
                }
            }
        });

        effect(() => {
            const hasOpenOverlaySubmenu = this.layoutService.hasOpenOverlaySubmenu();
            if (this.layoutService.isDesktop()) {
                if (hasOpenOverlaySubmenu) {
                    setTimeout(() => this.setupIntersectionObserver());
                } else {
                    this.unbindObserver();
                }
            }
        });
    }

    ngOnInit() {
        this.router.events
            .pipe(
                filter((event) => event instanceof NavigationEnd),
                takeUntil(this.destroy$)
            )
            .subscribe((event) => {
                const navEvent = event as NavigationEnd;
                this.onRouteChange(navEvent.urlAfterRedirects);
            });

        this.onRouteChange(this.router.url);
        this.mediaQuery.addEventListener('change', this.screenChangeListener);
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
        this.unbindOutsideClickListener();
        this.unbindObserver();
        this.mediaQuery.removeEventListener('change', this.screenChangeListener);
    }

    private onRouteChange(path: string) {
        let newActivePath: string | null;

        if (this.layoutService.hasOverlaySubmenu() && this.layoutService.isDesktop()) {
            newActivePath = null;
        } else {
            newActivePath = path;
        }

        this.layoutService.layoutState.update((val) => ({
            ...val,
            activePath: newActivePath,
            overlayMenuActive: false,
            mobileMenuActive: false,
            menuHoverActive: false
        }));
    }

    private screenChangeListener = () => {
        if (this.layoutService.hasOverlaySubmenu()) {
            this.layoutService.layoutState.update((val) => ({
                ...val,
                activePath: this.layoutService.isDesktop() ? null : this.router.url,
                menuHoverActive: false
            }));
            this.unbindOutsideClickListener();
            this.unbindObserver();
        }
    };

    private bindOutsideClickListener() {
        if (!this.outsideClickListener) {
            this.outsideClickListener = (event: MouseEvent) => {
                if (this.isOutsideClicked(event)) {
                    this.layoutService.layoutState.update((val) => ({
                        ...val,
                        overlayMenuActive: false,
                        mobileMenuActive: false,
                        menuHoverActive: false
                    }));

                    if (this.layoutService.hasOverlaySubmenu()) {
                        this.layoutService.layoutState.update((val) => ({
                            ...val,
                            activePath: null
                        }));
                    }
                }
            };

            document.addEventListener('click', this.outsideClickListener);
        }
    }

    private unbindOutsideClickListener() {
        if (this.outsideClickListener) {
            document.removeEventListener('click', this.outsideClickListener);
            this.outsideClickListener = null;
        }
    }

    private isOutsideClicked(event: MouseEvent): boolean {
        const topbarButtonEl = document.querySelector('.topbar-start > button');
        const sidebarEl = this.el.nativeElement;

        return !(sidebarEl?.isSameNode(event.target as Node) || sidebarEl?.contains(event.target as Node) || topbarButtonEl?.isSameNode(event.target as Node) || topbarButtonEl?.contains(event.target as Node));
    }

    onMouseEnter() {
        if (!this.layoutService.layoutState().anchored) {
            if (this.timeout) {
                clearTimeout(this.timeout);
                this.timeout = null;
            }
            this.layoutService.layoutState.update((state) => ({
                ...state,
                sidebarExpanded: true
            }));
        }
    }

    onMouseLeave() {
        if (!this.layoutService.layoutState().anchored && !this.timeout) {
            this.timeout = setTimeout(() => {
                this.layoutService.layoutState.update((state) => ({
                    ...state,
                    sidebarExpanded: false
                }));
            }, 300);
        }
    }

    onAnchorToggle() {
        this.layoutService.layoutState.update((state) => ({
            ...state,
            anchored: !state.anchored
        }));
    }

    onMenuScroll() {
        if (this.menuContainer?.nativeElement) {
            if (this.layoutService.isHorizontal()) {
                const scrollLeft = this.menuContainer.nativeElement.scrollLeft;
                this.menuContainer.nativeElement.style.setProperty('--menu-scroll-x', `-${scrollLeft}px`);
            } else {
                const scrollTop = this.menuContainer.nativeElement.scrollTop;
                this.menuContainer.nativeElement.style.setProperty('--menu-scroll-y', `-${scrollTop}px`);
            }
        }

        if (this.layoutService.hasOverlaySubmenu() && this.layoutService.isDesktop()) {
            this.layoutService.layoutState.update((val) => ({
                ...val,
                activePath: null,
                menuHoverActive: false
            }));
        }
    }

    private setupIntersectionObserver() {
        if (!this.menuContainer?.nativeElement) return;

        if (this.observer) {
            this.observer.disconnect();
        }

        const activeMenuItem = this.menuContainer.nativeElement.querySelector('.layout-root-menuitem.active-menuitem');
        if (!activeMenuItem) return;

        this.observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (this.layoutService.isDesktop() && !entry.isIntersecting && this.layoutService.hasOverlaySubmenu() && this.layoutService.layoutState().activePath) {
                        this.layoutService.layoutState.update((val) => ({
                            ...val,
                            activePath: null
                        }));
                    }
                });
            },
            {
                root: this.menuContainer.nativeElement,
                threshold: 0
            }
        );

        this.observer.observe(activeMenuItem);
    }

    private unbindObserver() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }
}
