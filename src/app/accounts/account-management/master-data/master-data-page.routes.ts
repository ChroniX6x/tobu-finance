import { Routes } from '@angular/router';
import { provideStates } from '@ngxs/store';
import { MasterDataPageState } from './state/master-data-page.state';

export default [
  {
    path: 'master-data',
    providers: [provideStates([MasterDataPageState])],
    loadComponent: () =>
      import('./master-data-page.component').then(m => m.MasterDataPageComponent),
  },
] as Routes;
