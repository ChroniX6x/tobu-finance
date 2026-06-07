import { Selector } from '@ngxs/store';
import { PlanningPageState, PlanningPageStateModel } from './planning.state';
import { BudgetPlanningItemVm, ContributionBlockVm, PlanningHintVm, IncomePlanningMemberVm } from '../planning.models';

export class PlanningPageSelectors {
  @Selector([PlanningPageState])
  static vm(s: PlanningPageStateModel) {
    return s.vm;
  }

  @Selector([PlanningPageState])
  static loading(s: PlanningPageStateModel) {
    return s.loading;
  }

  @Selector([PlanningPageState])
  static error(s: PlanningPageStateModel) {
    return s.error;
  }

  @Selector([PlanningPageState])
  static referenceMonth(s: PlanningPageStateModel) {
    return s.referenceMonth;
  }

  @Selector([PlanningPageState])
  static editor(s: PlanningPageStateModel) {
    return s.editor;
  }

  @Selector([PlanningPageState])
  static activeSection(s: PlanningPageStateModel) {
    return s.activeSection;
  }

  @Selector([PlanningPageState])
  static overview(s: PlanningPageStateModel) {
    return s.vm?.overview ?? null;
  }

  @Selector([PlanningPageState])
  static hints(s: PlanningPageStateModel): PlanningHintVm[] {
    return s.vm?.hints ?? [];
  }

  @Selector([PlanningPageState])
  static activeBudgets(s: PlanningPageStateModel): BudgetPlanningItemVm[] {
    return s.vm?.budgets.filter(b => b.isActiveInReferenceMonth) ?? [];
  }

  @Selector([PlanningPageState])
  static allBudgets(s: PlanningPageStateModel): BudgetPlanningItemVm[] {
    return s.vm?.budgets ?? [];
  }

  @Selector([PlanningPageState])
  static activeIncomes(s: PlanningPageStateModel): IncomePlanningMemberVm[] {
    return s.vm?.incomes.filter(i => i.activeIncome !== null) ?? [];
  }

  @Selector([PlanningPageState])
  static allIncomes(s: PlanningPageStateModel): IncomePlanningMemberVm[] {
    return s.vm?.incomes ?? [];
  }

  @Selector([PlanningPageState])
  static baseBlocks(s: PlanningPageStateModel): ContributionBlockVm[] {
    return s.vm?.contributionBlocks.filter(b => b.type === 'base') ?? [];
  }

  @Selector([PlanningPageState])
  static additionalBlocks(s: PlanningPageStateModel): ContributionBlockVm[] {
    return s.vm?.contributionBlocks.filter(b => b.type === 'additional') ?? [];
  }

  @Selector([PlanningPageState])
  static specialBlocks(s: PlanningPageStateModel): ContributionBlockVm[] {
    return s.vm?.specialBlocks ?? [];
  }

  @Selector([PlanningPageState])
  static preview(s: PlanningPageStateModel) {
    return s.vm?.preview ?? null;
  }

  @Selector([PlanningPageState])
  static categories(s: PlanningPageStateModel): Array<{ id: string; name: string | null }> {
    return s.vm?.categories ?? [];
  }
}
