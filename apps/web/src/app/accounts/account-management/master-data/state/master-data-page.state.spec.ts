import { TestBed } from '@angular/core/testing';
import { provideStore, Store } from '@ngxs/store';
import { MessageService } from 'primeng/api';
import { Subject, firstValueFrom } from 'rxjs';
import {
  MasterDataPageState,
  MasterDataPageStateModel,
} from './master-data-page.state';
import { MasterDataApiService } from '../services/master-data-api.service';
import type { AccountMasterDataResponse } from '../account-master-data.models';
import {
  LoadMasterData,
  OpenMemberSidebar,
  SaveAccountMasterData,
  CreateMemberForAccount,
  UpdateMemberForAccount,
  RemoveMemberFromAccount,
} from './master-data-page.actions';

describe('P02 master-data capabilities', () => {
  it('closes owner editors before loading another account and blocks all owner commands during load and as member', async () => {
    const pending = new Subject<AccountMasterDataResponse>();
    const api = jasmine.createSpyObj<MasterDataApiService>('api', [
      'getMasterData',
      'patchAccount',
      'createMember',
      'patchMember',
      'removeMemberFromAccount',
    ]);
    api.getMasterData.and.returnValue(pending);
    TestBed.configureTestingModule({
      providers: [
        provideStore([MasterDataPageState]),
        MessageService,
        { provide: MasterDataApiService, useValue: api },
      ],
    });
    const store = TestBed.inject(Store);
    const account = {
      _id: 'a'.repeat(24),
      name: 'Owner',
      currency: 'EUR',
      memberCount: 1,
      callerRole: 'owner' as const,
      settings: {
        dashboard: { historyMonths: 6, topKCategories: 5 },
        alerts: {
          lowBalanceForecastMinor: null,
          carryoverLargeMinor: null,
          stalenessDays: null,
        },
      },
    };
    const vm: AccountMasterDataResponse = {
      account,
      members: [],
      categories: [],
      meta: {
        uncategorizedTransactionCount: 0,
        hasSingleMemberInfo: true,
        infoHints: [],
        warningHints: [],
      },
    };
    const state: MasterDataPageStateModel = {
      vm,
      loading: false,
      error: null,
      activeSection: 'account',
      editor: null,
      currentAccountId: account._id,
      accountSaveError: null,
    };
    store.reset({ ...store.snapshot(), masterDataPage: state });
    await firstValueFrom(store.dispatch(new OpenMemberSidebar('create')));
    expect(store.selectSnapshot(MasterDataPageState.editor)?.kind).toBe(
      'member',
    );
    const loading = firstValueFrom(
      store.dispatch(new LoadMasterData('b'.repeat(24))),
    );
    expect(store.selectSnapshot(MasterDataPageState.vm)).toBeNull();
    expect(store.selectSnapshot(MasterDataPageState.editor)).toBeNull();
    const tryCommands = async () => {
      await firstValueFrom(
        store.dispatch([
          new OpenMemberSidebar('create'),
          new SaveAccountMasterData({ name: 'Forbidden' }),
          new CreateMemberForAccount({ name: 'Forbidden', role: 'owner' }),
          new UpdateMemberForAccount('c'.repeat(24), {
            name: 'Forbidden',
            role: 'owner',
          }),
          new RemoveMemberFromAccount('c'.repeat(24)),
        ]),
      );
      expect(store.selectSnapshot(MasterDataPageState.editor)).toBeNull();
      for (const key of [
        'patchAccount',
        'createMember',
        'patchMember',
        'removeMemberFromAccount',
      ] as const)
        expect(api[key]).not.toHaveBeenCalled();
    };
    await tryCommands();
    pending.next({
      ...vm,
      account: { ...account, _id: 'b'.repeat(24), callerRole: 'member' },
    });
    pending.complete();
    await loading;
    await tryCommands();
  });
});
