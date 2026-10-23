import { Component, input, model, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { RippleModule } from 'primeng/ripple';
import { DatePickerModule } from 'primeng/datepicker';
import { FormsModule } from '@angular/forms';
import { DateTime } from 'luxon';
import { CalculationGroup } from '../domain/calculation-group';
import { CalculationParticipant } from '../domain/calculation-participant';
import { CalculationResult } from '../domain/calculation-result';

@Component({
  selector: 'tobu-calculation-table',
  templateUrl: './calculation-table.html',
  styleUrls: ['./calculation-table.scss'],
  imports: [
    CommonModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    RippleModule,
    DatePickerModule,
    FormsModule
  ]
})
export class CalculationTable implements OnInit {

  public groups = input<CalculationGroup[]>([]);

  public participants = input<CalculationParticipant[]>([]);

  public calculationResult = input<CalculationResult>();

  public selectedMonth = model<string>('2025-01');


  constructor() { }

  ngOnInit() {
    console.log(this.groups)
  }

  onGlobalFilter(dt1: any, $event: any) {

  }

  prevMonth() {
    this.selectedMonth.update(month => DateTime.fromISO(month).plus({month:-1}).toFormat('yyyy-MM'))
  }

  nextMonth() {
    this.selectedMonth.update(month => DateTime.fromISO(month).plus({month:1}).toFormat('yyyy-MM'))
  }

}
