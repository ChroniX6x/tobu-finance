import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { Store } from '@ngxs/store';
import { ButtonModule } from 'primeng/button';
import { FluidModule } from 'primeng/fluid';
import { InputTextModule } from 'primeng/inputtext';
import { RippleModule } from 'primeng/ripple';
import { NextStepAction, SetBaseInformation } from '../state/wizard.actions';
import { form, FormField, FormRoot, required } from '@angular/forms/signals';

@Component({
  selector: 'app-base-information',
  templateUrl: './base-information.html',
  styleUrls: ['./base-information.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InputTextModule, FluidModule, ButtonModule, RippleModule, FormField, FormRoot],
})
export class BaseInformation {

  private readonly store = inject(Store);

  public readonly next = output();

  protected readonly baseModel = signal({ name: '' });

  protected readonly baseForm = form(this.baseModel, (p) => {
    required(p.name, { message: 'Name ist erforderlich' });
  },
    {
    submission: {
      action: async () => this.nextStep(),   // <- wichtig
    },
  });

  protected nextStep(): void {
    this.store.dispatch(new SetBaseInformation({ name: this.baseModel().name }));
    this.store.dispatch(new NextStepAction());
  }
}
