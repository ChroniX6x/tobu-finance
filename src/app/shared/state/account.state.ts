import { State, Selector, Action, StateContext } from '@ngxs/store';
import { Injectable } from '@angular/core';
import { map, switchMap, tap } from 'rxjs/operators';
import { AccountModel } from '@/shared/models/account.model';
import { MembersDataService } from '@/accounts/domain/member-data.service';
import { AccountDataService } from '@/accounts/domain/account-data.service';

export class LoadAccounts {
  static readonly type = '[Accounts] Load';
  constructor(public accountId: string){}
}

@State<AccountModel>({
  name: 'accounts',
})
@Injectable()
export class AccountState {
  constructor(private accountService: AccountDataService, private memberService: MembersDataService) {}

  @Selector()
  static account(state: AccountModel) {
    return state;
  }

  @Action(LoadAccounts)
  loadAccounts(ctx: StateContext<AccountModel>, {accountId}: LoadAccounts ) {
    return this.accountService.getAccountForId(accountId).pipe(
      switchMap(account =>
        this.memberService.getMembersWithIds(account.memberIds).pipe(
          map(members => ({
            ...account,
            members: members
          })),
          tap(res => {
            ctx.setState(res);
          })
        )
      )
    )
  }
}
