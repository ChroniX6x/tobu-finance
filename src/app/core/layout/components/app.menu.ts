import {Component, ElementRef, inject, ViewChild} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterModule} from '@angular/router';
import {AppMenuitem} from './app.menuitem';

interface MenuItem {
    label?: string;
    icon?: string;
    routerLink?: string[];
    url?: string[];
    target?: '_blank' | '_self' | '_parent' | '_top';
    routerLinkActiveOptions?: { [key: string]: any };
    items?: MenuItem[];
    separator?: boolean;
    visible?: boolean;
    disabled?: boolean;
    command?: (event?: any) => void;
    class?: string;
    style?: string;
    styleClass?: string;
    id?: string;
    urlTarget?: '_blank' | '_self' | '_parent' | '_top';
}

@Component({
    selector: '[app-menu]',
    standalone: true,
    imports: [CommonModule, AppMenuitem, RouterModule],
    template: `<ul class="layout-menu" #menuContainer>
        @for (item of model; track $index; let i = $index) {
          @if(!item.separator) {
            <li app-menuitem [item]="item" [index]="i" [root]="true"></li>
          }
          @if(item.separator) {
            <li class="menu-separator"></li>
          }
        }
    </ul>`,
    host: {
        class: 'layout-menu-container'
    }
})
export class AppMenu {
    el: ElementRef = inject(ElementRef);

    @ViewChild('menuContainer') menuContainer!: ElementRef;

    model: MenuItem[] = [
        {
            label: 'TobuFinance',
            icon: 'pi pi-home',
            items: [
                {
                    label: 'Calculation',
                    icon: 'pi pi-fw pi-home',
                    routerLink: ['/calculation']
                },
                {
                    label: 'Wizard',
                    icon: 'pi pi-fw pi-home',
                    routerLink: ['/wizard']
                }
            ]
        },
    ];
}
