import { Routes } from '@angular/router';
import { provideStates } from '@ngxs/store';
import { MessageService } from 'primeng/api';
import { MasterDataPageState } from './state/master-data-page.state';

export default [
  {
    path: 'master-data',
    providers: [provideStates([MasterDataPageState]), MessageService],
    loadComponent: () =>
      import('./master-data-page.component').then(m => m.MasterDataPageComponent),
  },
] as Routes;
