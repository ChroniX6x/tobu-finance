import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalculationComponent } from './calculation.component';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CalculationTableComponent } from './calculation-table/calculation-table.component';
import { NgxsModule } from '@ngxs/store';
import { States } from './state';



@NgModule({
  declarations: [
    CalculationComponent,
    CalculationTableComponent
  ],
  imports: [
    CommonModule,
    TableModule,
    ButtonModule,
    NgxsModule.forFeature(States)
  ]
})
export class CalculationModule { }
