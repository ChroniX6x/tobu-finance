import { Component, inject, OnInit, Signal, effect } from '@angular/core';
import { CalculationStateModel } from './state/calculation.state';
import { CalculationState } from "./state/calculation.state";
import { select, Store } from '@ngxs/store';
import { InitCalculationDataAction, SetCalculationMonthAction } from './state/calculation.actions';
import { CalculationTable } from './calculation-table/calculation-table';
import { CommonModule } from '@angular/common';
import { CalculationGroup } from './domain/calculation-group';
import { CalculationParticipant } from './domain/calculation-participant';
import { CalculationResult } from './domain/calculation-result';


@Component({
  selector: 'tobu-calculation',
  templateUrl: './calculation.html',
  styleUrls: ['./calculation.scss'],
  imports: [
    CommonModule,
    CalculationTable
  ]
})
export class Calculation implements OnInit {

  private store = inject(Store)

  public loading: Signal<CalculationStateModel> = select(CalculationState.state);

  public groups: Signal<CalculationGroup[]> = select(CalculationState.getGroups);

  public participants: Signal<CalculationParticipant[]> = select(CalculationState.getParticipants);

  public calculationResult: Signal<CalculationResult> = select(CalculationState.getCalculationResult);

  public selectedMonth: Signal<string> = select(CalculationState.getSelectedMonth);

  public d = effect(() => {
    console.log(this.selectedMonth());
  })

  constructor() { }

  ngOnInit(): void {
    this.store.dispatch(new InitCalculationDataAction());
    // this.groups$ = this.store.select(CalculationState.getGroups);
    // console.log('test2', this.store.selectSnapshot(CalculationState.getGroups));

    // this.groups$.subscribe(x=> console.log('test1',x));
    // this.loading$.subscribe(x=> console.log('test3',x));

  }

  public selectedMonthChanged(month: string) {
    this.store.dispatch(new SetCalculationMonthAction(month))
  }

}
