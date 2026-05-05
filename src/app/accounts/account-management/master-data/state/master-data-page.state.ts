import { Injectable } from '@angular/core';
import { State } from '@ngxs/store';

// Stub – wird in Baustein 2 vollständig implementiert.
export interface MasterDataPageStateModel {
  loading: boolean;
}

@State<MasterDataPageStateModel>({
  name: 'masterDataPage',
  defaults: { loading: false },
})
@Injectable()
export class MasterDataPageState {}
