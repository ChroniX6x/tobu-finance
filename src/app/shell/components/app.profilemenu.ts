import {Component, inject} from '@angular/core';
import {DrawerModule} from "primeng/drawer";
import {LayoutService} from "@/shell/service/layout.service";
import {DatePickerModule} from "primeng/datepicker";
import {FormsModule} from "@angular/forms";
import {CommonModule} from "@angular/common";

@Component({
    selector: 'app-profile-menu',
    imports: [DrawerModule, DatePickerModule, FormsModule, CommonModule],
    standalone: true,
    template:`<p-drawer [(visible)]="rightMenuVisible" header="Profile" position="right" styleClass="layout-profile-sidebar !w-full sm:!w-[28rem]" [ngClass]="{ 'layout-rightmenu-active': rightMenuVisible }">
    <div class="layout-rightmenu h-full overflow-y-auto overflow-x-hidden">
        <div class="flex flex-col items-center" style="padding: 4.5rem 0 2rem 0">
            <div class="flex flex-col items-center mb-6">
                <img src="/images/ecommerce-dashboard/gene.png" alt="atlantis" class="user-image" />
                <span class="user-name text-2xl text-center block mt-6 mb-1">Gene Russell</span>
                <span class="user-number">(406) 555-0120</span>
            </div>
            <div class="flex items-center py-6 px-4 gap-8">
                <div class="in-progress font-medium flex flex-col items-center">
                    <span class="task-number text-red-500 flex justify-center items-center rounded" style="background: rgba(255, 255, 255, 0.05); padding: 9px; width: 50px; height: 50px; font-size: 30px">23</span>
                    <span class="task-name block mt-4">Progress</span>
                </div>
                <div class="font-medium flex flex-col items-center">
                    <a class="task-number flex justify-center items-center rounded" style="background: rgba(255, 255, 255, 0.05); padding: 9px; width: 50px; height: 50px; font-size: 30px">6</a>
                    <span class="task-name block mt-4">Overdue</span>
                </div>
                <div class="font-medium flex flex-col items-center">
                    <a class="task-number flex justify-center items-center rounded" style="background: rgba(255, 255, 255, 0.05); padding: 9px; width: 50px; height: 50px; font-size: 30px">38</a>
                    <span class="task-name block mt-4">All deals</span>
                </div>
            </div>
        </div>
        <div>
            <p-datepicker [(ngModel)]="date" inline styleClass="w-full p-0"></p-datepicker>
        </div>
        <div class="mt-8">
            <span>14 Sunday, Jun 2025</span>
            <ul class="list-none overflow-hidden p-0 m-0">
                <li class="mt-4 rounded py-2 px-4" style="background: rgba(255, 255, 255, 0.05)">
                    <span class="block font-semibold text-surface-500 dark:text-surface-400">1:00 PM - 2:00 PM</span>
                    <span class="block mt-2">Meeting with Alfredo Rhiel Madsen</span>
                </li>
                <li class="mt-4 rounded py-2 px-4" style="background: rgba(255, 255, 255, 0.05)">
                    <span class="block font-semibold text-surface-500 dark:text-surface-400">2:00 PM - 3:00 PM</span>
                    <span class="block mt-2">Team Sync</span>
                </li>
                <li class="mt-4 rounded py-2 px-4" style="background: rgba(255, 255, 255, 0.05)">
                    <span class="block font-semibold text-surface-500 dark:text-surface-400">5:00 PM - 6:00 PM</span>
                    <span class="block mt-2">Team Sync</span>
                </li>
                <li class="mt-4 rounded py-2 px-4" style="background: rgba(255, 255, 255, 0.05)">
                    <span class="block font-semibold text-surface-500 dark:text-surface-400">7:00 PM - 7:30 PM</span>
                    <span class="block mt-2">Meeting with Engineering managers</span>
                </li>
            </ul>
        </div>
    </div>
</p-drawer>`
})
export class AppProfileMenu {
    layoutService = inject(LayoutService);

    get rightMenuVisible() {
        return this.layoutService.layoutState().rightMenuActive;
    }

    set rightMenuVisible(val: boolean) {
        this.layoutService.layoutState.update((prev) => ({...prev, rightMenuActive: val}))
    }

    date = new Date();

}
