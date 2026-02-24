import {computed, effect, Injectable, signal, Signal, WritableSignal} from '@angular/core';
import {Subject} from 'rxjs';
import {MenuItem} from 'primeng/api';

export type MenuMode = 'static' | 'overlay' | 'horizontal' | 'slim' | 'slim-plus' | 'reveal' | 'drawer';

export interface LayoutConfig {
    preset: string;
    primary: string;
    surface: string | undefined | null;
    darkTheme: boolean;
    menuMode: MenuMode;
}

export interface LayoutState {
    staticMenuDesktopInactive: boolean;
    overlayMenuActive: boolean;
    configSidebarVisible: boolean;
    staticMenuMobileActive: boolean;
    menuHoverActive: boolean;
    rightMenuActive: boolean;
    sidebarActive: boolean;
    activeMenuItem: any;
    overlaySubmenuActive: boolean;
    anchored: boolean;
    rightMenuVisible: boolean;
    searchBarActive: boolean;
}

export interface MenuChangeEvent {
    key: string;
    routeEvent?: boolean;
}

export interface TabCloseEvent {
    tab: MenuItem;
    index: number;
}

@Injectable({
    providedIn: 'root'
})
export class LayoutService {
    _config: LayoutConfig = {
        preset: 'Aura',
        primary: 'emerald',
        surface: null,
        darkTheme: true,
        menuMode: 'static'
    };

    _state: LayoutState = {
        staticMenuDesktopInactive: false,
        overlayMenuActive: false,
        rightMenuActive: false,
        configSidebarVisible: false,
        staticMenuMobileActive: false,
        menuHoverActive: false,
        sidebarActive: false,
        anchored: false,
        activeMenuItem: null,
        overlaySubmenuActive: false,
        rightMenuVisible: false,
        searchBarActive: false
    };

    layoutConfig = signal<LayoutConfig>(this._config);

    layoutState = signal<LayoutState>(this._state);

    private configUpdate = new Subject<LayoutConfig>();

    private overlayOpen = new Subject<any>();

    private menuSource = new Subject<MenuChangeEvent>();

    private resetSource = new Subject();

    menuSource$ = this.menuSource.asObservable();

    resetSource$ = this.resetSource.asObservable();

    configUpdate$ = this.configUpdate.asObservable();

    overlayOpen$ = this.overlayOpen.asObservable();

    isSidebarActive: Signal<boolean> = computed(() => this.layoutState().overlayMenuActive || this.layoutState().staticMenuMobileActive || this.layoutState().overlaySubmenuActive);

    isSidebarStateChanged = computed(() => {
        const layoutConfig = this.layoutConfig();
        return layoutConfig.menuMode === 'horizontal' || layoutConfig.menuMode === 'slim' || layoutConfig.menuMode === 'slim-plus';
    });

    isDarkTheme: Signal<boolean> = computed(() => this.layoutConfig().darkTheme);

    isOverlay: Signal<boolean> = computed(() => this.layoutConfig().menuMode === 'overlay');

    isSlim: Signal<boolean> = computed(() => this.layoutConfig().menuMode === 'slim');

    isSlimPlus: Signal<boolean> = computed(() => this.layoutConfig().menuMode === 'slim-plus');

    isHorizontal: Signal<boolean> = computed(() => this.layoutConfig().menuMode === 'horizontal');

    transitionComplete: WritableSignal<boolean> = signal<boolean>(false);

    logo = computed(() => (this.layoutConfig().darkTheme ? 'light' : 'dark'));

    rightMenuVisible = computed(() => this.layoutState().rightMenuActive);

    private initialized = false;

    constructor() {
        effect(() => {
            const config = this.layoutConfig();
            if (config) {
                this.onConfigUpdate();
            }
        });

        effect(() => {
            const config = this.layoutConfig();

            if (!this.initialized || !config) {
                this.initialized = true;
                return;
            }

            this.handleDarkModeTransition(config);
        });

        effect(() => {
            this.isSidebarStateChanged() && this.reset();
        });
    }

    private handleDarkModeTransition(config: LayoutConfig): void {
        if ((document as any).startViewTransition) {
            this.startViewTransition(config);
        } else {
            this.toggleDarkMode(config);
            this.onTransitionEnd();
        }
    }

    private startViewTransition(config: LayoutConfig): void {
        const transition = (document as any).startViewTransition(() => {
            this.toggleDarkMode(config);
        });

        transition.ready
            .then(() => {
                this.onTransitionEnd();
            })
            .catch(() => {});
    }

    toggleDarkMode(config?: LayoutConfig): void {
        const _config = config || this.layoutConfig();
        if (_config.darkTheme) {
            document.documentElement.classList.add('app-dark');
        } else {
            document.documentElement.classList.remove('app-dark');
        }
    }

    private onTransitionEnd() {
        this.transitionComplete.set(true);
        setTimeout(() => {
            this.transitionComplete.set(false);
        });
    }

    onMenuToggle() {
        if (this.isOverlay()) {
            this.layoutState.update((prev) => ({
                ...prev,
                overlayMenuActive: !this.layoutState().overlayMenuActive
            }));

            if (this.layoutState().overlayMenuActive) {
                this.overlayOpen.next(null);
            }
        }

        if (this.isDesktop()) {
            this.layoutState.update((prev) => ({
                ...prev,
                staticMenuDesktopInactive: !this.layoutState().staticMenuDesktopInactive
            }));
        } else {
            this.layoutState.update((prev) => ({
                ...prev,
                staticMenuMobileActive: !this.layoutState().staticMenuMobileActive
            }));

            if (this.layoutState().staticMenuMobileActive) {
                this.overlayOpen.next(null);
            }
        }
    }

    isDesktop() {
        return window.innerWidth > 991;
    }

    isMobile() {
        return !this.isDesktop();
    }

    onConfigUpdate() {
        this._config = { ...this.layoutConfig() };
        this.configUpdate.next(this.layoutConfig());
        this.toggleDarkMode();
    }

    onMenuStateChange(event: MenuChangeEvent) {
        this.menuSource.next(event);
    }

    reset() {
        this.resetSource.next(true);
    }

    onOverlaySubmenuOpen() {
        this.overlayOpen.next(null);
    }

    showProfileSidebar() {
        this.layoutState.update((prev) => ({
            ...prev,
            profileSidebarVisible: true
        }));
    }

    showConfigSidebar() {
        this.layoutState.update((prev) => ({
            ...prev,
            configSidebarVisible: true
        }));
    }

    hideConfigSidebar() {
        this.layoutState.update((prev) => ({
            ...prev,
            configSidebarVisible: false
        }));
    }
}
