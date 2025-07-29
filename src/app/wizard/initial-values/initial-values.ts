import { Component, inject, OnInit, output } from '@angular/core';
import { Store } from '@ngxs/store';
import { ButtonModule } from 'primeng/button';
import { FluidModule } from 'primeng/fluid';
import { InputTextModule } from 'primeng/inputtext';
import { RippleModule } from 'primeng/ripple';
import { NextStepAction } from '../state/wizard.actions';
import { InputNumberModule } from 'primeng/inputnumber';

@Component({
  selector: 'tbf-initial-values',
  templateUrl: './initial-values.html',
  styleUrls: ['./initial-values.scss'],
  imports: [ InputTextModule, InputNumberModule, FluidModule, ButtonModule, RippleModule ]
})
export class InitialValues implements OnInit {

  private store = inject(Store);

  public next = output();

  constructor() { }

  ngOnInit() {
  }

  onNextClicked() {
    this.store.dispatch(new NextStepAction())
  }

}
