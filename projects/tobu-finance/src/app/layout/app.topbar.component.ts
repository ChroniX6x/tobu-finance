import { Component, ElementRef, ViewChild } from '@angular/core';
import { AppSidebarComponent } from './app.sidebar.component';
import { LayoutService } from './service/app.layout.service';

@Component({
    selector: 'app-topbar',
    templateUrl: './app.topbar.component.html'
})
export class AppTopbarComponent {

    @ViewChild('menubutton') menuButton!: ElementRef;
    @ViewChild('searchinput') searchInput!: ElementRef;
    @ViewChild(AppSidebarComponent) appSidebar!: AppSidebarComponent;
    searchActive: boolean = false;
    constructor(public layoutService: LayoutService,public el: ElementRef) { }
    activateSearch() {
        this.searchActive = true;
        setTimeout(() => {
            this.searchInput.nativeElement.focus();
        }, 100);
    }

    deactivateSearch() {
        this.searchActive = false;
    }
    onMenuButtonClick() {
        this.layoutService.onMenuToggle();
    }

    onConfigButtonClick() {
        this.layoutService.showConfigSidebar();
    }

    onSidebarButtonClick() {
        this.layoutService.showSidebar();
    }
}
