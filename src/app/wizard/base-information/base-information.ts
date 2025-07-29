import { Component, inject, OnInit, output } from '@angular/core';
import { Store } from '@ngxs/store';
import { ButtonModule } from 'primeng/button';
import { FluidModule } from 'primeng/fluid';
import { InputTextModule } from 'primeng/inputtext';
import { RippleModule } from 'primeng/ripple';
import { NextStepAction, SetBaseInformation } from '../state/wizard.actions';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-base-information',
  templateUrl: './base-information.html',
  styleUrls: ['./base-information.scss'],
  imports: [ InputTextModule, FluidModule, ButtonModule, RippleModule, ReactiveFormsModule ]
})
export class BaseInformation implements OnInit {

  private store = inject(Store);
  private fb = inject(FormBuilder);

  public baseInformationForm = this.fb.group({
    name: ['', Validators.required]
  });

  public next = output();

  constructor() { }

  ngOnInit() {
  }

  nextStep() {
    let value = this.baseInformationForm.value;

    this.store.dispatch(new SetBaseInformation({name: value.name!}))

    this.store.dispatch(new NextStepAction())
  }

}
