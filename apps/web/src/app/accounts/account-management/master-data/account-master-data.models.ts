import type { AccountMasterDataResponse, AccountMasterVm, MemberMasterItemVm, CategoryMasterItemVm, MasterDataMetaVm } from '@tobu/contracts/master-data';
export type { AccountMasterDataResponse, AccountMasterVm, MemberMasterItemVm, CategoryMasterItemVm, MasterDataMetaVm } from '@tobu/contracts/master-data';

// ---- Payload-Typen für Schreiboperationen ----

import type {z} from 'zod';
import type {UpdateAccount} from '@tobu/contracts/accounts';
export type SaveAccountMasterDataPayload = z.input<typeof UpdateAccount>;

export interface CreateMemberPayload {
  name: string;
  email?: string | null;
  role: 'owner' | 'member';
}

export interface UpdateMemberPayload {
  name?: string;
  email?: string | null;
  role?: 'owner' | 'member';
}

export interface CreateCategoryPayload {
  name: string;
  customSplit?: Array<{ memberId: string; split: number }>;
}

export interface UpdateCategoryPayload {
  name?: string;
  customSplit?: Array<{ memberId: string; split: number }>;
}
