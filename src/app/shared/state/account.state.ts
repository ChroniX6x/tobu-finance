import { State, Selector, Action, StateContext } from '@ngxs/store';
import { Injectable } from '@angular/core';
import { map, switchMap, tap } from 'rxjs/operators';
import { AccountModel } from '@/shared/models/account.model';
import { MemberModel } from '@/shared/models/member.model';
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

  private extractMemberIds(account: Partial<AccountModel> & { members?: unknown }): string[] {
    const legacyMemberIds = Array.isArray(account.memberIds) ? account.memberIds : [];

    const relationMemberIds = Array.isArray(account.members)
      ? account.members
          .map((entry) => {
            if (!entry || typeof entry !== 'object') return null;
            const relation = entry as { memberId?: unknown };
            return typeof relation.memberId === 'string' ? relation.memberId : null;
          })
          .filter((id): id is string => !!id)
      : [];

    return Array.from(new Set([...legacyMemberIds, ...relationMemberIds]));
  }

  private normalizeAndFilterMembers(rawMembers: unknown, allowedMemberIds: string[]): MemberModel[] {
    if (!Array.isArray(rawMembers) || allowedMemberIds.length === 0) {
      return [];
    }

    const allowed = new Set(allowedMemberIds);
    return rawMembers
      .map((raw) => {
        if (!raw || typeof raw !== 'object') return null;
        const candidate = raw as Record<string, unknown>;
        const id = typeof candidate['id'] === 'string'
          ? candidate['id']
          : (typeof candidate['_id'] === 'string' ? candidate['_id'] : null);

        if (!id || !allowed.has(id)) {
          return null;
        }

        return {
          id,
          name: typeof candidate['name'] === 'string' ? candidate['name'] : '',
          email: typeof candidate['email'] === 'string' ? candidate['email'] : '',
          userID: typeof candidate['userID'] === 'string'
            ? candidate['userID']
            : (typeof candidate['userId'] === 'string' ? candidate['userId'] : undefined),
        } as MemberModel;
      })
      .filter((member): member is MemberModel => !!member);
  }

  @Selector()
  static account(state: AccountModel) {
    return state;
  }

  @Action(LoadAccounts)
  loadAccounts(ctx: StateContext<AccountModel>, {accountId}: LoadAccounts ) {
    return this.accountService.getAccountForId(accountId).pipe(
      switchMap(account => {
        const memberIds = this.extractMemberIds(account);
        return this.memberService.getMembersWithIds(memberIds).pipe(
          map(members => ({
            ...account,
            members: this.normalizeAndFilterMembers(members, memberIds),
          })),
          tap(res => {
            ctx.setState(res);
          })
        );
      })
    )
  }
}
