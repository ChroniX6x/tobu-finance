import {
  CreateCategoryPayload,
  CreateMemberPayload,
  SaveAccountMasterDataPayload,
  UpdateCategoryPayload,
  UpdateMemberPayload,
} from '../account-master-data.models';

export class LoadMasterData {
  static readonly type = '[MasterDataPage] Load';
  constructor(public accountId: string) {}
}

export class ReloadMasterData {
  static readonly type = '[MasterDataPage] Reload';
}

export class OpenMemberSidebar {
  static readonly type = '[MasterDataPage] Open Member Sidebar';
  constructor(
    public mode: 'create' | 'edit',
    public memberId?: string,
  ) {}
}

export class OpenCategorySidebar {
  static readonly type = '[MasterDataPage] Open Category Sidebar';
  constructor(
    public mode: 'create' | 'edit',
    public categoryId?: string,
  ) {}
}

export class CloseMasterDataSidebar {
  static readonly type = '[MasterDataPage] Close Sidebar';
}

export class SaveAccountMasterData {
  static readonly type = '[MasterDataPage] Save Account';
  constructor(public payload: SaveAccountMasterDataPayload) {}
}

export class CreateMemberForAccount {
  static readonly type = '[MasterDataPage] Create Member';
  constructor(public payload: CreateMemberPayload) {}
}

export class UpdateMemberForAccount {
  static readonly type = '[MasterDataPage] Update Member';
  constructor(
    public memberId: string,
    public payload: UpdateMemberPayload,
  ) {}
}

export class RemoveMemberFromAccount {
  static readonly type = '[MasterDataPage] Remove Member';
  constructor(public memberId: string) {}
}

export class CreateCategory {
  static readonly type = '[MasterDataPage] Create Category';
  constructor(public payload: CreateCategoryPayload) {}
}

export class UpdateCategory {
  static readonly type = '[MasterDataPage] Update Category';
  constructor(
    public categoryId: string,
    public payload: UpdateCategoryPayload,
  ) {}
}

export class DeleteCategory {
  static readonly type = '[MasterDataPage] Delete Category';
  constructor(public categoryId: string) {}
}
