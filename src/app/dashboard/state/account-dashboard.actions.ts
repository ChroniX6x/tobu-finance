// account-dashboard.actions.ts
export class LoadAccountDashboard {
  static readonly type = '[AccountDashboard] Load';
  constructor(public accountId: string) {}
}
