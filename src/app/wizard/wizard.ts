import { Component, effect, inject, OnInit, Signal, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { StepperModule } from 'primeng/stepper';
import { CardModule } from 'primeng/card';
import { WizardState } from './state/wizard.state';
import { select, Store } from '@ngxs/store';
import { SetStepAction } from './state/wizard.actions';

@Component({
  selector: 'app-wizard',
  templateUrl: './wizard.html',
  styleUrls: ['./wizard.scss'],
  imports: [RouterOutlet, StepperModule, CardModule]
})
export class Wizard implements OnInit {

  private store = inject(Store);
  private activeRoute = inject(ActivatedRoute);
  private router = inject(Router);

  public currentStep: Signal<number> = select(WizardState.currentStep);

  stepChangeEffect = effect(() => {
    this.router.navigate([ this.currentStep() ], { relativeTo: this.activeRoute });
  })

  constructor() { }

  ngOnInit() {
  }

  stepChanged(step: number) {
    this.store.dispatch(new SetStepAction(step))
  }

}
