import { State } from '@ngxs/store';
import { Injectable } from '@angular/core';

export interface MonthViewStateModel {
  loading: boolean;
}

@State<MonthViewStateModel>({
  name: 'monthView',
  defaults: { loading: false },
})
@Injectable()
export class MonthViewState {}
