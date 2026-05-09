// account-master-data.models.ts
// Isoliertes ViewModel für die Stammdaten-Page – kein Import aus account.model.ts.

export interface AccountMasterDataResponse {
  account: AccountMasterVm;
  members: MemberMasterItemVm[];
  categories: CategoryMasterItemVm[];
  meta: MasterDataMetaVm;
}

export interface AccountMasterVm {
  _id: string;
  name: string | null;
  currency: string;
  memberCount: number;
  settings: {
    dashboard: {
      historyMonths: number;
      topKCategories: number;
    };
    alerts: {
      lowBalanceForecastMinor: number | null;
      carryoverLargeMinor: number | null;
      stalenessDays: number | null;
    };
  };
}

export interface MemberMasterItemVm {
  memberId: string;
  name: string | null;
  email: string | null;
  avatar: string | null;
  role: 'owner' | 'member';
  hasUserAccount: boolean;
  canRemoveFromAccount: boolean;
  canChangeRole: boolean;
  usageHints: string[];
}

export interface CategoryMasterItemVm {
  categoryId: string;
  name: string | null;
  customSplit: Array<{ memberId: string; split: number }>;
  hasCustomSplit: boolean;
  customSplitLabel: string | null;
  transactionCount: number;
  recurrenceCount: number;
  hasBudget: boolean;
  canDelete: boolean;
  usageHints: string[];
}

export interface MasterDataMetaVm {
  uncategorizedTransactionCount: number;
  hasSingleMemberInfo: boolean;
  infoHints: string[];
  warningHints: string[];
}

// ---- Payload-Typen für Schreiboperationen ----

export interface SaveAccountMasterDataPayload {
  name?: string;
  settings?: {
    dashboard?: {
      historyMonths?: number;
      topKCategories?: number;
    };
    alerts?: {
      lowBalanceForecastMinor?: number | null;
      carryoverLargeMinor?: number | null;
      stalenessDays?: number | null;
    };
  };
}

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
