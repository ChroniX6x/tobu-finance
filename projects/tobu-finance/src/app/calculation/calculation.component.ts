import { Component, OnInit } from '@angular/core';
import { CalculationStateModel } from './state/calculation.state';
import { CalculationState } from "./state/calculation.state";
import { CalculationGroup } from './domain/calculation-group';
import { CalculationParticipant } from './domain/calculation-participant';
import { Select, Store } from '@ngxs/store';
import { Observable } from 'rxjs';
import { InitCalculationDataAction } from './state/calculation.actions';


@Component({
  selector: 'tobu-calculation',
  templateUrl: './calculation.component.html',
  styleUrls: ['./calculation.component.scss']
})
export class CalculationComponent implements OnInit {

  @Select(CalculationState) loading$!: Observable<CalculationStateModel>;

  @Select(CalculationState.getGroups)
  public groups$: Observable<CalculationGroup[]>

  @Select(CalculationState.getParticipants)
  public participants$: Observable<CalculationParticipant[]>

  constructor(private store: Store) { }

  ngOnInit(): void {
    this.store.dispatch(new InitCalculationDataAction());
    // this.groups$ = this.store.select(CalculationState.getGroups);
    // console.log('test2', this.store.selectSnapshot(CalculationState.getGroups));

    // this.groups$.subscribe(x=> console.log('test1',x));
    // this.loading$.subscribe(x=> console.log('test3',x));
  }

}
