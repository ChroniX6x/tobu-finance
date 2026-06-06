import {
  CreateBudgetPayload,
  UpdateBudgetPayload,
  CreateIncomePayload,
  UpdateIncomePayload,
  CreateContributionRulePayload,
  UpdateContributionRulePayload,
} from '../planning.models';

const prefix = '[Planning]';

export class LoadPlanning {
  static readonly type = `${prefix} Load`;
  constructor(public accountId: string, public referenceMonth: string) {}
}

export class SetPlanningReferenceMonth {
  static readonly type = `${prefix} Set Reference Month`;
  constructor(public month: string) {}
}

export class ReloadPlanning {
  static readonly type = `${prefix} Reload`;
}

// ---- Sidebar UI ----

export class OpenBudgetSidebar {
  static readonly type = `${prefix} Open Budget Sidebar`;
  constructor(
    public mode: 'create' | 'edit',
    public budgetId?: string,
    public categoryId?: string,
  ) {}
}

export class OpenIncomeSidebar {
  static readonly type = `${prefix} Open Income Sidebar`;
  constructor(
    public mode: 'create' | 'edit',
    public incomeId?: string,
    public memberId?: string,
  ) {}
}

export class OpenRuleSidebar {
  static readonly type = `${prefix} Open Rule Sidebar`;
  constructor(
    public mode: 'create' | 'edit',
    public ruleId?: string,
    public ruleType?: 'additional' | 'topup',
  ) {}
}

export class ClosePlanningSidebar {
  static readonly type = `${prefix} Close Sidebar`;
}

// ---- Budget CRUD ----

export class CreateBudget {
  static readonly type = `${prefix} Create Budget`;
  constructor(public payload: CreateBudgetPayload) {}
}

export class UpdateBudget {
  static readonly type = `${prefix} Update Budget`;
  constructor(public budgetId: string, public payload: UpdateBudgetPayload) {}
}

export class DeleteBudget {
  static readonly type = `${prefix} Delete Budget`;
  constructor(public budgetId: string) {}
}

// ---- Income CRUD ----

export class CreateIncome {
  static readonly type = `${prefix} Create Income`;
  constructor(public payload: CreateIncomePayload) {}
}

export class UpdateIncome {
  static readonly type = `${prefix} Update Income`;
  constructor(public incomeId: string, public payload: UpdateIncomePayload) {}
}

export class DeleteIncome {
  static readonly type = `${prefix} Delete Income`;
  constructor(public incomeId: string) {}
}

// ---- Contribution Rule CRUD ----

export class CreateContributionRule {
  static readonly type = `${prefix} Create Contribution Rule`;
  constructor(public payload: CreateContributionRulePayload) {}
}

export class UpdateContributionRule {
  static readonly type = `${prefix} Update Contribution Rule`;
  constructor(public ruleId: string, public payload: UpdateContributionRulePayload) {}
}

export class DeleteContributionRule {
  static readonly type = `${prefix} Delete Contribution Rule`;
  constructor(public ruleId: string) {}
}
