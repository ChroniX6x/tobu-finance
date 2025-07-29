export class InitCalculationDataAction {
  static readonly type = '[Calculation] Init data action';
  constructor() {}
}

export class SetCalculationMonthAction {
  static readonly type = '[Calculation] Set calculation month action';
  constructor(public selectedMonth: string) {}
}
