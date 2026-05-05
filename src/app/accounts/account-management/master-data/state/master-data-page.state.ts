import { Injectable, inject } from '@angular/core';
import { State, Action, StateContext, Selector } from '@ngxs/store';
import { tap, catchError, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { MessageService } from 'primeng/api';
import { AccountMasterDataResponse } from '../account-master-data.models';
import { MasterDataApiService } from '../services/master-data-api.service';
import { LoadAccountOverview } from '../../../state/account-overview.actions';
import {
  LoadMasterData,
  ReloadMasterData,
  OpenMemberSidebar,
  OpenCategorySidebar,
  CloseMasterDataSidebar,
  SaveAccountMasterData,
  CreateMemberForAccount,
  UpdateMemberForAccount,
  RemoveMemberFromAccount,
  CreateCategory,
  UpdateCategory,
  DeleteCategory,
} from './master-data-page.actions';

export type MasterDataEditor =
  | { kind: 'member'; mode: 'create' | 'edit'; memberId?: string }
  | { kind: 'category'; mode: 'create' | 'edit'; categoryId?: string }
  | null;

export interface MasterDataPageStateModel {
  vm: AccountMasterDataResponse | null;
  loading: boolean;
  error: string | null;
  activeSection: 'account' | 'members' | 'categories';
  editor: MasterDataEditor;
  currentAccountId: string | null;
  accountSaveError: string | null;
}

const defaults: MasterDataPageStateModel = {
  vm: null,
  loading: false,
  error: null,
  activeSection: 'account',
  editor: null,
  currentAccountId: null,
  accountSaveError: null,
};

@State<MasterDataPageStateModel>({
  name: 'masterDataPage',
  defaults,
})
@Injectable()
export class MasterDataPageState {
  private api = inject(MasterDataApiService);
  private toast = inject(MessageService);

  // ---- Selectors ----

  @Selector()
  static vm(s: MasterDataPageStateModel | undefined) {
    return s?.vm ?? null;
  }

  @Selector()
  static loading(s: MasterDataPageStateModel | undefined) {
    return s?.loading ?? false;
  }

  @Selector()
  static error(s: MasterDataPageStateModel | undefined) {
    return s?.error ?? null;
  }

  @Selector()
  static activeSection(s: MasterDataPageStateModel | undefined) {
    return s?.activeSection ?? 'account';
  }

  @Selector()
  static editor(s: MasterDataPageStateModel | undefined) {
    return s?.editor ?? null;
  }

  @Selector()
  static accountSaveError(s: MasterDataPageStateModel | undefined) {
    return s?.accountSaveError ?? null;
  }

  @Selector()
  static members(s: MasterDataPageStateModel | undefined) {
    return s?.vm?.members ?? [];
  }

  @Selector()
  static categories(s: MasterDataPageStateModel | undefined) {
    return s?.vm?.categories ?? [];
  }

  // ---- Read ----

  @Action(LoadMasterData)
  load(ctx: StateContext<MasterDataPageStateModel>, { accountId }: LoadMasterData) {
    ctx.patchState({ loading: true, error: null, currentAccountId: accountId });
    return this.api.getMasterData(accountId).pipe(
      tap(vm => ctx.patchState({ vm, loading: false })),
      catchError(err => {
        ctx.patchState({ error: err?.message ?? 'Laden fehlgeschlagen', loading: false });
        return of(null);
      }),
    );
  }

  @Action(ReloadMasterData)
  reload(ctx: StateContext<MasterDataPageStateModel>) {
    const { currentAccountId } = ctx.getState();
    if (!currentAccountId) return of(null);
    return ctx.dispatch(new LoadMasterData(currentAccountId));
  }

  // ---- UI ----

  @Action(OpenMemberSidebar)
  openMemberSidebar(
    ctx: StateContext<MasterDataPageStateModel>,
    { mode, memberId }: OpenMemberSidebar,
  ) {
    ctx.patchState({ editor: { kind: 'member', mode, memberId } });
  }

  @Action(OpenCategorySidebar)
  openCategorySidebar(
    ctx: StateContext<MasterDataPageStateModel>,
    { mode, categoryId }: OpenCategorySidebar,
  ) {
    ctx.patchState({ editor: { kind: 'category', mode, categoryId } });
  }

  @Action(CloseMasterDataSidebar)
  closeSidebar(ctx: StateContext<MasterDataPageStateModel>) {
    ctx.patchState({ editor: null });
  }

  // ---- Account ----

  @Action(SaveAccountMasterData)
  saveAccount(
    ctx: StateContext<MasterDataPageStateModel>,
    { payload }: SaveAccountMasterData,
  ) {
    const { currentAccountId } = ctx.getState();
    if (!currentAccountId) return of(null);
    return this.api.patchAccount(currentAccountId, payload).pipe(
      tap(() => {
        ctx.patchState({ accountSaveError: null });
        this.toast.add({ severity: 'success', summary: 'Account gespeichert', life: 3000 });
        ctx.dispatch([new ReloadMasterData(), new LoadAccountOverview(currentAccountId)]);
      }),
      catchError(err => {
        ctx.patchState({
          accountSaveError: err?.error?.message ?? err?.message ?? 'Speichern fehlgeschlagen.',
        });
        return of(null);
      }),
    );
  }

  // ---- Members ----

  @Action(CreateMemberForAccount)
  createMember(
    ctx: StateContext<MasterDataPageStateModel>,
    { payload }: CreateMemberForAccount,
  ) {
    const { currentAccountId } = ctx.getState();
    if (!currentAccountId) return of(null);
    return this.api.createMember(payload).pipe(
      switchMap(newMember =>
        this.api.addMemberToAccount(currentAccountId, {
          memberId: newMember._id,
          role: payload.role,
        }),
      ),
      tap(() => {
        ctx.dispatch(new CloseMasterDataSidebar());
        this.toast.add({ severity: 'success', summary: 'Mitglied hinzugefügt', life: 3000 });
        ctx.dispatch(new ReloadMasterData());
      }),
      catchError(err => {
        this.toast.add({
          severity: 'error',
          summary: 'Fehler',
          detail: err?.error?.message ?? err?.message,
          life: 5000,
        });
        return of(null);
      }),
    );
  }

  @Action(UpdateMemberForAccount)
  updateMember(
    ctx: StateContext<MasterDataPageStateModel>,
    { memberId, payload }: UpdateMemberForAccount,
  ) {
    const { currentAccountId } = ctx.getState();
    if (!currentAccountId) return of(null);

    const patchMember$ = this.api.patchMember(memberId, {
      name: payload.name,
      email: payload.email,
    });

    const patchRole$ =
      payload.role !== undefined
        ? this.api.patchMemberRole(currentAccountId, memberId, payload.role)
        : of(null);

    return patchMember$.pipe(
      switchMap(() => patchRole$),
      tap(() => {
        ctx.dispatch(new CloseMasterDataSidebar());
        this.toast.add({ severity: 'success', summary: 'Mitglied gespeichert', life: 3000 });
        ctx.dispatch(new ReloadMasterData());
      }),
      catchError(err => {
        this.toast.add({
          severity: 'error',
          summary: 'Fehler',
          detail: err?.error?.message ?? err?.message,
          life: 5000,
        });
        return of(null);
      }),
    );
  }

  @Action(RemoveMemberFromAccount)
  removeMember(
    ctx: StateContext<MasterDataPageStateModel>,
    { memberId }: RemoveMemberFromAccount,
  ) {
    const { currentAccountId } = ctx.getState();
    if (!currentAccountId) return of(null);
    return this.api.removeMemberFromAccount(currentAccountId, memberId).pipe(
      tap(() => {
        ctx.dispatch(new CloseMasterDataSidebar());
        this.toast.add({ severity: 'success', summary: 'Mitglied entfernt', life: 3000 });
        ctx.dispatch(new ReloadMasterData());
      }),
      catchError(err => {
        this.toast.add({
          severity: 'error',
          summary: 'Fehler',
          detail: err?.error?.message ?? err?.message,
          life: 5000,
        });
        return of(null);
      }),
    );
  }

  // ---- Categories ----

  @Action(CreateCategory)
  createCategory(
    ctx: StateContext<MasterDataPageStateModel>,
    { payload }: CreateCategory,
  ) {
    const { currentAccountId } = ctx.getState();
    if (!currentAccountId) return of(null);
    return this.api.createCategory(currentAccountId, payload).pipe(
      tap(() => {
        ctx.dispatch(new CloseMasterDataSidebar());
        this.toast.add({ severity: 'success', summary: 'Kategorie hinzugefügt', life: 3000 });
        ctx.dispatch(new ReloadMasterData());
      }),
      catchError(err => {
        this.toast.add({
          severity: 'error',
          summary: 'Fehler',
          detail: err?.error?.message ?? err?.message,
          life: 5000,
        });
        return of(null);
      }),
    );
  }

  @Action(UpdateCategory)
  updateCategory(
    ctx: StateContext<MasterDataPageStateModel>,
    { categoryId, payload }: UpdateCategory,
  ) {
    return this.api.patchCategory(categoryId, payload).pipe(
      tap(() => {
        ctx.dispatch(new CloseMasterDataSidebar());
        this.toast.add({ severity: 'success', summary: 'Kategorie gespeichert', life: 3000 });
        ctx.dispatch(new ReloadMasterData());
      }),
      catchError(err => {
        this.toast.add({
          severity: 'error',
          summary: 'Fehler',
          detail: err?.error?.message ?? err?.message,
          life: 5000,
        });
        return of(null);
      }),
    );
  }

  @Action(DeleteCategory)
  deleteCategory(
    ctx: StateContext<MasterDataPageStateModel>,
    { categoryId }: DeleteCategory,
  ) {
    return this.api.deleteCategory(categoryId).pipe(
      tap(() => {
        this.toast.add({ severity: 'success', summary: 'Kategorie gelöscht', life: 3000 });
        ctx.dispatch(new ReloadMasterData());
      }),
      catchError(err => {
        this.toast.add({
          severity: 'error',
          summary: 'Fehler',
          detail: err?.error?.message ?? err?.message,
          life: 5000,
        });
        return of(null);
      }),
    );
  }
}
