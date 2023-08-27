import { Component, Input, OnInit } from '@angular/core';
import { CalculationGroup } from '../domain/calculation-group';
import { CalculationParticipant } from '../domain/calculation-participant';

@Component({
  selector: 'tobu-calculation-table',
  templateUrl: './calculation-table.component.html',
  styleUrls: ['./calculation-table.component.scss']
})
export class CalculationTableComponent implements OnInit {

  @Input()
  public groups: CalculationGroup[] = [];

  @Input()
  public participants: CalculationParticipant[] = []

  constructor() { }

  ngOnInit() {
    console.log(this.groups)
  }

}
