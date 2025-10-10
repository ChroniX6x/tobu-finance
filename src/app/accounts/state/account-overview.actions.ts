// account-overview.actions.ts
export class LoadAccountOverview {
  static readonly type = '[AccountOverview] Load';
  constructor(public accountId: string) {}
}
