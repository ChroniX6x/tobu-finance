import { Injectable, effect, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

export type MenuMode = 'static' | 'overlay' | 'slim-plus' | 'slim' | 'horizontal' | 'reveal' | 'drawer';

export interface LayoutConfig {
    preset: string;
    primary: string;
    surface: string | undefined | null;
    darkTheme: boolean;
    menuMode: MenuMode;
}

interface LayoutState {
    staticMenuDesktopInactive: boolean;
    overlayMenuActive: boolean;
    profileSidebarVisible: boolean;
    configSidebarVisible: boolean;
    searchBarActive: boolean;
    sidebarExpanded: boolean;
    menuHoverActive: boolean;
    activePath: any;
    anchored: boolean;
    rightMenuActive: boolean;
    topbarMenuActive: boolean;
    menuProfileActive: boolean;
    mobileMenuActive: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class LayoutService {
    layoutConfig = signal<LayoutConfig>({
        preset: 'Aura',
        primary: 'emerald',
        surface: null,
        darkTheme: true,
        menuMode: 'static'
    });

    layoutState = signal<LayoutState>({
        staticMenuDesktopInactive: false,
        overlayMenuActive: false,
        configSidebarVisible: false,
        mobileMenuActive: false,
        searchBarActive: false,
        sidebarExpanded: false,
        menuHoverActive: false,
        activePath: null,
        anchored: false,
        profileSidebarVisible: false,
        rightMenuActive: false,
        topbarMenuActive: false,
        menuProfileActive: false
    });

    router = inject(Router);

    isDarkTheme = computed(() => this.layoutConfig().darkTheme);

    isSlim = computed(() => this.layoutConfig().menuMode === 'slim');

    isSlimPlus = computed(() => this.layoutConfig().menuMode === 'slim-plus');

    isHorizontal = computed(() => this.layoutConfig().menuMode === 'horizontal');

    isOverlay = computed(() => this.layoutConfig().menuMode === 'overlay');

    hasOverlaySubmenu = computed(() => this.isSlim() || this.isSlimPlus() || this.isHorizontal());

    hasOpenOverlay = computed(() => this.layoutState().overlayMenuActive || this.hasOpenOverlaySubmenu());

    hasOpenOverlaySubmenu = computed(() => {
        return this.hasOverlaySubmenu() && !!this.layoutState().activePath;
    });

    isSidebarStateChanged = computed(() => {
        const layoutConfig = this.layoutConfig();
        return layoutConfig.menuMode === 'horizontal' || layoutConfig.menuMode === 'slim' || layoutConfig.menuMode === 'slim-plus';
    });

    isSidebarActive = computed(() => this.layoutState().overlayMenuActive || this.layoutState().mobileMenuActive);

    logo = computed(() => (this.layoutConfig().darkTheme ? 'light' : 'dark'));

    changeMenuMode(mode: MenuMode) {
        this.layoutConfig.update((prev) => ({ ...prev, menuMode: mode }));
        this.layoutState.update((prev) => ({ ...prev, staticMenuDesktopInactive: false, overlayMenuActive: false, mobileMenuActive: false, sidebarExpanded: false, menuHoverActive: false, anchored: false }));

        if (this.isDesktop()) {
            this.layoutState.update((prev) => ({ ...prev, activePath: this.hasOverlaySubmenu() ? null : this.router.url }));
        }
    }

    private initialized = false;

    private previousMenuMode: MenuMode | undefined = undefined;

    constructor() {
        effect(() => {
            const config = this.layoutConfig();

            if (!this.initialized || !config) {
                this.initialized = true;
                return;
            }

            this.handleDarkModeTransition(config);
        });

        effect(() => {
            this.updateMenuState();
        });
    }

    private updateMenuState() {
        const menuMode = this.layoutConfig().menuMode;
        if (this.previousMenuMode === undefined) {
            this.previousMenuMode = menuMode;
            return;
        }

        if (this.previousMenuMode === menuMode) {
            return;
        }

        this.previousMenuMode = menuMode;

        const isOverlaySubmenu = menuMode === 'slim' || menuMode === 'slim-plus' || menuMode === 'horizontal';

        this.layoutState.update((prev) => ({
            ...prev,
            staticMenuDesktopInactive: false,
            overlayMenuActive: false,
            mobileMenuActive: false,
            sidebarExpanded: false,
            menuHoverActive: false,
            anchored: false,
            activePath: this.isDesktop() ? (isOverlaySubmenu ? null : this.router.url) : prev.activePath
        }));
    }

    private handleDarkModeTransition(config: LayoutConfig): void {
        const supportsViewTransition = 'startViewTransition' in document;

        if (supportsViewTransition) {
            this.startViewTransition(config);
        } else {
            this.toggleDarkMode(config);
        }
    }

    private startViewTransition(config: LayoutConfig): void {
        document.startViewTransition(() => {
            this.toggleDarkMode(config);
        });
    }

    toggleDarkMode(config?: LayoutConfig): void {
        const _config = config || this.layoutConfig();
        if (_config.darkTheme) {
            document.documentElement.classList.add('app-dark');
        } else {
            document.documentElement.classList.remove('app-dark');
        }
    }

    onMenuToggle() {
        if (this.isOverlay()) {
            this.layoutState.update((prev) => ({ ...prev, overlayMenuActive: !this.layoutState().overlayMenuActive }));
        }

        if (this.isDesktop()) {
            this.layoutState.update((prev) => ({ ...prev, staticMenuDesktopInactive: !this.layoutState().staticMenuDesktopInactive }));
        } else {
            this.layoutState.update((prev) => ({ ...prev, mobileMenuActive: !this.layoutState().mobileMenuActive }));
        }
    }

    onMenuProfileToggle() {
        this.layoutState.update((prev) => ({ ...prev, menuProfileActive: !prev.menuProfileActive }));
    }

    toggleProfileSidebar() {
        this.layoutState.update((prev) => ({
            ...prev,
            profileSidebarVisible: !prev.profileSidebarVisible
        }));
    }

    toggleConfigSidebar() {
        this.layoutState.update((prev) => ({
            ...prev,
            configSidebarVisible: !prev.configSidebarVisible
        }));
    }

    showConfigSidebar() {
        this.layoutState.update((prev) => ({
            ...prev,
            configSidebarVisible: true
        }));
    }

    hideConfigSidebar() {
        this.layoutState.update((prev) => ({ ...prev, configSidebarVisible: false }));
    }

    showProfileSidebar() {
        this.layoutState.update((prev) => ({
            ...prev,
            profileSidebarVisible: true
        }));
    }

    isDesktop() {
        return window.innerWidth > 991;
    }
}