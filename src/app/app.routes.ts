import { Routes } from '@angular/router';
import { AppLayout } from './shell/components/app.layout';

import { authGuard } from './core/auth/guards/auth.guard';

export const routes: Routes = [
    {
        path: '',
        component: AppLayout,
        canActivate: [authGuard],
        children: [
            {
                path: '',
                redirectTo: 'accounts',
                pathMatch: 'full'
            },
            {
                path: 'calculation',
                data: { breadcrumb: 'Calculation' },
                loadChildren: () => import('@/calculation/calculation.routes')
            },
            {
                path: 'wizard',
                data: { breadcrumb: 'Wizard' },
                loadChildren: () => import('@/wizard/wizard.routes')
            },
            {
                path: 'accounts',
                data: { breadcrumb: 'Accounts' },
                loadChildren: () => import('@/accounts/accounts.routes')
            },
            // {
            //     path: 'documentation',
            //     data: { breadcrumb: 'Documentation' },
            //     loadComponent: () => import('@/pages/documentation/documentation').then((c) => c.Documentation)
            // },
            // {
            //     path: 'pages',
            //     data: { breadcrumb: 'Pages' },
            //     loadChildren: () => import('@/pages/pages.routes')
            // },
            // {
            //     path: 'apps',
            //     data: { breadcrumb: 'Apps' },
            //     loadChildren: () => import('./app/apps/apps.routes')
            // },
            // {
            //     path: 'ecommerce',
            //     data: { breadcrumb: 'E-Commerce' },
            //     loadChildren: () => import('@/pages/ecommerce/ecommerce.routes')
            // },
            // {
            //     path: 'blocks',
            //     data: { breadcrumb: 'Prime Blocks' },
            //     loadChildren: () => import('@/pages/blocks/blocks.routes')
            // },
            // {
            //     path: 'profile',
            //     data: { breadcrumb: 'User Management' },
            //     loadChildren: () => import('@/pages/usermanagement/usermanagement.routes')
            // }
        ]
    },
    { path: 'auth', loadChildren: () => import('@/core/auth/auth.routes') },
    // {
    //     path: 'landing',
    //     loadComponent: () => import('@/pages/landing/landing').then((c) => c.Landing)
    // },
    {
        path: 'notfound',
        loadComponent: () => import('@/core/notfound/notfound').then((c) => c.Notfound)
    },
    { path: '**', redirectTo: '/notfound' }
];
