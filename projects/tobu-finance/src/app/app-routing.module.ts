import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AppLayoutComponent } from './layout/app.layout.component';
import { CalculationComponent } from './calculation/calculation.component';

const routes: Routes = [{
  path:'', component: AppLayoutComponent,
  children: [
    {path: '', component: CalculationComponent}
  ]
}];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
