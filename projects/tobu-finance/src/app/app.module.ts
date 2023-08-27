import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AppLayoutModule } from './layout/app.layout.module';
import { CalculationModule } from './calculation/calculation.module';
import { NgxsModule } from '@ngxs/store';
import { States } from './store';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    AppLayoutModule,
    CalculationModule,

    NgxsModule.forRoot(States, { developmentMode: true,  })
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
