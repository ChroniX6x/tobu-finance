// accounts/month-view/month-view.actions.ts

export class LoadMonthView {
  static readonly type = '[MonthView] Load';
  constructor(
    public readonly accountId: string,
    public readonly month: string, // YYYY-MM
  ) {}
}

export class SetMonthViewMonth {
  static readonly type = '[MonthView] Set Month';
  constructor(public readonly month: string) {} // YYYY-MM
}
