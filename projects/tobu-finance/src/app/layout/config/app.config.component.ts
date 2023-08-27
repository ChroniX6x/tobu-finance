import { Component, Input, OnInit } from "@angular/core";
import { MenuService } from "../app.menu.service";
import {
    ColorScheme,
    LayoutService,
    MenuMode,
} from "../service/app.layout.service";

@Component({
    selector: "app-config",
    templateUrl: "./app.config.component.html",
})
export class AppConfigComponent implements OnInit {
    @Input() minimal: boolean = false;

    componentThemes: any[] = [];

    layoutThemes: any[] = [];

    scales: number[] = [12, 13, 14, 15, 16];

    constructor(
        public layoutService: LayoutService,
        public menuService: MenuService
    ) {}

    get visible(): boolean {
        return this.layoutService.state.configSidebarVisible;
    }

    set visible(_val: boolean) {
        this.layoutService.state.configSidebarVisible = _val;
    }

    get scale(): number {
        return this.layoutService.config.scale;
    }

    set scale(_val: number) {
        this.layoutService.config.scale = _val;
    }

    get menuMode(): MenuMode {
        return this.layoutService.config.menuMode;
    }

    set menuMode(_val: MenuMode) {
        this.layoutService.config.menuMode = _val;
        if (
            this.layoutService.isSlimPlus() ||
            this.layoutService.isSlim() ||
            this.layoutService.isHorizontal()
        ) {
            this.menuService.reset();
        }
    }

    get colorScheme(): ColorScheme {
        return this.layoutService.config.colorScheme;
    }

    set colorScheme(_val: ColorScheme) {
        this.changeColorScheme(_val);
    }

    get ripple(): boolean {
        return this.layoutService.config.ripple;
    }

    set ripple(_val: boolean) {
        this.layoutService.config.ripple = _val;
    }

    ngOnInit() {
        this.componentThemes = [
            { name: "blue", color: "#0F8BFD" },
            { name: "green", color: "#0BD18A" },
            { name: "magenta", color: "#EC4DBC" },
            { name: "orange", color: "#FD9214" },
            { name: "purple", color: "#873EFE" },
            { name: "red", color: "#FC6161" },
            { name: "teal", color: "#00D0DE" },
            { name: "yellow", color: "#EEE500" },
        ];
    }

    onConfigButtonClick() {
        this.layoutService.showConfigSidebar();
    }

    changeColorScheme(colorScheme: ColorScheme) {
        const themeLink = <HTMLLinkElement>(
            document.getElementById("theme-link")
        );
        const themeLinkHref = themeLink.getAttribute("href");
        const currentColorScheme =
            "theme-" + this.layoutService.config.colorScheme;
        const newColorScheme = "theme-" + colorScheme;
        const newHref = themeLinkHref!.replace(
            currentColorScheme,
            newColorScheme
        );
        this.replaceThemeLink(
            newHref,
            () => {
                this.layoutService.config.colorScheme = colorScheme;
                this.layoutService.onConfigUpdate();
            },
            "theme-link"
        );
    }

    changeTheme(theme: string) {
        const themeLink = <HTMLLinkElement>(
            document.getElementById("theme-link")
        );

        const newHref = themeLink
            .getAttribute("href")!
            .replace(this.layoutService.config.theme, theme);
        this.replaceThemeLink(
            newHref,
            () => {
                this.layoutService.config.theme = theme;
                this.layoutService.onConfigUpdate();
            },
            "theme-link"
        );
    }

    replaceThemeLink(href: string, onComplete: Function, linkId: string) {
        const id = linkId;
        const themeLink = <HTMLLinkElement>document.getElementById(id);
        const cloneLinkElement = <HTMLLinkElement>themeLink.cloneNode(true);                                

        cloneLinkElement.setAttribute("href", href);
        cloneLinkElement.setAttribute("id", id + "-clone");

        themeLink.parentNode!.insertBefore(
            cloneLinkElement,
            themeLink.nextSibling
        );

        cloneLinkElement.addEventListener("load", () => {
            themeLink.remove();
            cloneLinkElement.setAttribute("id", id);
            onComplete();
        });
    }

    decrementScale() {
        this.scale--;
        this.applyScale();
    }

    incrementScale() {
        this.scale++;
        this.applyScale();
    }

    applyScale() {
        document.documentElement.style.fontSize = this.scale + "px";
    }
}
