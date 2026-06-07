import { Injectable, inject } from '@angular/core';
import { State, Action, StateContext } from '@ngxs/store';
import { tap, catchError } from 'rxjs/operators';
import { EMPTY, of } from 'rxjs';
import { MessageService } from 'primeng/api';
import { AccountPlanningResponse } from '../planning.models';
import { PlanningApiService } from '../services/planning-api.service';
import {
  LoadPlanning,
  SetPlanningReferenceMonth,
  ReloadPlanning,
  OpenBudgetSidebar,
  OpenIncomeSidebar,
  OpenRuleSidebar,
  ClosePlanningSidebar,
  CreateBudget,
  UpdateBudget,
  DeleteBudget,
  CreateIncome,
  UpdateIncome,
  DeleteIncome,
  CreateContributionRule,
  UpdateContributionRule,
  DeleteContributionRule,
} from './planning.actions';

export type PlanningEditor =
  | { kind: 'budget'; mode: 'create' | 'edit'; budgetId?: string; categoryId?: string }
  | { kind: 'income'; mode: 'create' | 'edit'; incomeId?: string; memberId?: string }
  | { kind: 'rule'; mode: 'create' | 'edit'; ruleId?: string; ruleType?: 'additional' | 'topup' }
  | null;

export interface PlanningPageStateModel {
  vm: AccountPlanningResponse | null;
  referenceMonth: string;
  loading: boolean;
  error: string | null;
  activeSection: 'overview' | 'budgets' | 'incomes' | 'rules' | 'specials';
  editor: PlanningEditor;
  currentAccountId: string | null;
}

const defaults: PlanningPageStateModel = {
  vm: null,
  referenceMonth: '',
  loading: false,
  error: null,
  activeSection: 'overview',
  editor: null,
  currentAccountId: null,
};

@State<PlanningPageStateModel>({
  name: 'planningPage',
  defaults,
})
@Injectable()
export class PlanningPageState {
  private api = inject(PlanningApiService);
  private toast = inject(MessageService);

  // ---- Read ----

  @Action(LoadPlanning, { cancelUncompleted: true })
  load(ctx: StateContext<PlanningPageStateModel>, { accountId, referenceMonth }: LoadPlanning) {
    ctx.patchState({ loading: true, error: null, currentAccountId: accountId, referenceMonth });
    return this.api.getPlanning(accountId, referenceMonth).pipe(
      tap(vm => ctx.patchState({ vm, loading: false })),
      catchError(err => {
        ctx.patchState({ error: err?.message ?? 'Laden fehlgeschlagen', loading: false });
        return EMPTY;
      }),
    );
  }

  @Action(SetPlanningReferenceMonth)
  setReferenceMonth(
    ctx: StateContext<PlanningPageStateModel>,
    { month }: SetPlanningReferenceMonth,
  ) {
    ctx.patchState({ referenceMonth: month });
    return ctx.dispatch(new ReloadPlanning());
  }

  @Action(ReloadPlanning)
  reload(ctx: StateContext<PlanningPageStateModel>) {
    const { currentAccountId, referenceMonth } = ctx.getState();
    if (!currentAccountId || !referenceMonth) return of(null);
    return ctx.dispatch(new LoadPlanning(currentAccountId, referenceMonth));
  }

  // ---- Sidebar UI ----

  @Action(OpenBudgetSidebar)
  openBudgetSidebar(
    ctx: StateContext<PlanningPageStateModel>,
    { mode, budgetId, categoryId }: OpenBudgetSidebar,
  ) {
    ctx.patchState({ editor: { kind: 'budget', mode, budgetId, categoryId } });
  }

  @Action(OpenIncomeSidebar)
  openIncomeSidebar(
    ctx: StateContext<PlanningPageStateModel>,
    { mode, incomeId, memberId }: OpenIncomeSidebar,
  ) {
    ctx.patchState({ editor: { kind: 'income', mode, incomeId, memberId } });
  }

  @Action(OpenRuleSidebar)
  openRuleSidebar(
    ctx: StateContext<PlanningPageStateModel>,
    { mode, ruleId, ruleType }: OpenRuleSidebar,
  ) {
    ctx.patchState({ editor: { kind: 'rule', mode, ruleId, ruleType } });
  }

  @Action(ClosePlanningSidebar)
  closeSidebar(ctx: StateContext<PlanningPageStateModel>) {
    ctx.patchState({ editor: null });
  }

  // ---- Budget CRUD ----

  @Action(CreateBudget)
  createBudget(ctx: StateContext<PlanningPageStateModel>, { payload }: CreateBudget) {
    return this.api.createBudget(payload).pipe(
      tap(() => {
        ctx.dispatch(new ClosePlanningSidebar());
        this.toast.add({ severity: 'success', summary: 'Budget erstellt', life: 3000 });
        ctx.dispatch(new ReloadPlanning());
      }),
    );
  }

  @Action(UpdateBudget)
  updateBudget(ctx: StateContext<PlanningPageStateModel>, { budgetId, payload }: UpdateBudget) {
    return this.api.updateBudget(budgetId, payload).pipe(
      tap(() => {
        ctx.dispatch(new ClosePlanningSidebar());
        this.toast.add({ severity: 'success', summary: 'Budget aktualisiert', life: 3000 });
        ctx.dispatch(new ReloadPlanning());
      }),
    );
  }

  @Action(DeleteBudget)
  deleteBudget(ctx: StateContext<PlanningPageStateModel>, { budgetId }: DeleteBudget) {
    return this.api.deleteBudget(budgetId).pipe(
      tap(() => {
        this.toast.add({ severity: 'success', summary: 'Budget gelöscht', life: 3000 });
        ctx.dispatch(new ReloadPlanning());
      }),
    );
  }

  // ---- Income CRUD ----

  @Action(CreateIncome)
  createIncome(ctx: StateContext<PlanningPageStateModel>, { payload }: CreateIncome) {
    return this.api.createIncome(payload).pipe(
      tap(() => {
        ctx.dispatch(new ClosePlanningSidebar());
        this.toast.add({ severity: 'success', summary: 'Einkommen erstellt', life: 3000 });
        ctx.dispatch(new ReloadPlanning());
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

  @Action(UpdateIncome)
  updateIncome(ctx: StateContext<PlanningPageStateModel>, { incomeId, payload }: UpdateIncome) {
    return this.api.updateIncome(incomeId, payload).pipe(
      tap(() => {
        ctx.dispatch(new ClosePlanningSidebar());
        this.toast.add({ severity: 'success', summary: 'Einkommen aktualisiert', life: 3000 });
        ctx.dispatch(new ReloadPlanning());
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

  @Action(DeleteIncome)
  deleteIncome(ctx: StateContext<PlanningPageStateModel>, { incomeId }: DeleteIncome) {
    return this.api.deleteIncome(incomeId).pipe(
      tap(() => {
        this.toast.add({ severity: 'success', summary: 'Einkommen gelöscht', life: 3000 });
        ctx.dispatch(new ReloadPlanning());
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

  // ---- Contribution Rule CRUD ----

  @Action(CreateContributionRule)
  createContributionRule(
    ctx: StateContext<PlanningPageStateModel>,
    { payload }: CreateContributionRule,
  ) {
    return this.api.createContributionRule(payload).pipe(
      tap(() => {
        ctx.dispatch(new ClosePlanningSidebar());
        this.toast.add({ severity: 'success', summary: 'Beitragsregel erstellt', life: 3000 });
        ctx.dispatch(new ReloadPlanning());
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

  @Action(UpdateContributionRule)
  updateContributionRule(
    ctx: StateContext<PlanningPageStateModel>,
    { ruleId, payload }: UpdateContributionRule,
  ) {
    return this.api.updateContributionRule(ruleId, payload).pipe(
      tap(() => {
        ctx.dispatch(new ClosePlanningSidebar());
        this.toast.add({ severity: 'success', summary: 'Beitragsregel aktualisiert', life: 3000 });
        ctx.dispatch(new ReloadPlanning());
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

  @Action(DeleteContributionRule)
  deleteContributionRule(
    ctx: StateContext<PlanningPageStateModel>,
    { ruleId }: DeleteContributionRule,
  ) {
    return this.api.deleteContributionRule(ruleId).pipe(
      tap(() => {
        this.toast.add({ severity: 'success', summary: 'Beitragsregel gelöscht', life: 3000 });
        ctx.dispatch(new ReloadPlanning());
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
