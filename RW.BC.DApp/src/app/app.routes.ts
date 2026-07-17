import { Routes } from '@angular/router';
import { MainLayout } from './core/layout/main-layout/main-layout';
import { adminGuard } from './core/guards/admin-guard';
import { authGuard } from './core/guards/auth-guard';
import { walletLinkedGuard } from './core/guards/wallet-linked-guard';
import { ContractAdminService } from './core/web3/contract-admin.service';

export const routes: Routes = [
  {
    path: '',
    component: MainLayout,
    children: [
      {
        path: '',
        loadComponent: () => import('./features/home/home').then((m) => m.Home),
        data: { seo: 'home' },
      },
      {
        path: 'loja',
        loadComponent: () => import('./features/store/store').then((m) => m.Store),
        data: { seo: 'store' },
      },
      {
        path: 'forja',
        redirectTo: 'loja',
        pathMatch: 'full',
      },
      {
        path: 'mint',
        redirectTo: 'loja',
        pathMatch: 'full',
      },
      {
        path: 'mercado',
        loadComponent: () => import('./features/marketplace/marketplace').then((m) => m.Marketplace),
        data: { seo: 'mercado' },
      },
      {
        path: 'marketplace',
        redirectTo: 'mercado',
        pathMatch: 'full',
      },
      {
        path: 'granja',
        canActivate: [authGuard, walletLinkedGuard],
        loadComponent: () => import('./features/farm/farm').then((m) => m.Farm),
        data: { seo: 'granja' },
      },
      {
        path: 'farm',
        redirectTo: 'granja',
        pathMatch: 'full',
      },
      {
        path: 'colecao',
        loadComponent: () => import('./features/collection/collection').then((m) => m.Collection),
        data: { seo: 'collection' },
      },
      {
        path: 'collection',
        redirectTo: 'colecao',
        pathMatch: 'full',
      },
      {
        path: 'farms/:address',
        loadComponent: () => import('./features/public-farm/public-farm').then((m) => m.PublicFarm),
        data: { seo: 'publicFarm' },
      },
      {
        path: 'transparencia',
        loadComponent: () => import('./features/transparency/transparency').then((m) => m.Transparency),
        data: { seo: 'transparency' },
      },
      {
        path: 'legal',
        loadComponent: () => import('./features/legal/legal').then((m) => m.Legal),
        data: { seo: 'legal' },
      },
      {
        path: 'admin',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/admin/admin').then((m) => m.Admin),
        providers: [ContractAdminService],
        data: { seo: 'admin' },
      },
    ],
  },
  {
    path: '**',
    loadComponent: () => import('./features/not-found/not-found').then((m) => m.NotFound),
    data: { seo: 'notFound' },
  },
];
