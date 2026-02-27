import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Store } from '@ngxs/store';
import { ButtonModule } from 'primeng/button';
import { DataViewModule } from 'primeng/dataview';
import { InputTextModule } from 'primeng/inputtext';
import { RippleModule } from 'primeng/ripple';
import { NextStepAction, SetMembers } from '../state/wizard.actions';
import { WizardMemberModel } from '../domain/wizard-member.model';
import { email, form, FormField, FormRoot, required } from '@angular/forms/signals';

@Component({
  selector: 'app-member-information',
  templateUrl: './member-information.html',
  styleUrls: ['./member-information.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DataViewModule,
    InputTextModule,
    ButtonModule,
    RippleModule,
    FormField,
    FormRoot,
  ],
})
export class MemberInformation {
  private readonly store = inject(Store);

  protected readonly members = signal<WizardMemberModel[]>([]);

  protected readonly memberInput = signal({ name: '', email: '' });

  protected readonly memberForm = form(
    this.memberInput,
    (p) => {
      required(p.name, { message: 'Name ist erforderlich' });
      email(p.email, {message: 'Keine gültige E-Mail'});
    },
    {
      submission: {
        action: async () => this.addMember(),
      },
    },
  );

  protected addMember(): void {
    const { name, email } = this.memberInput();
    this.members.update(list => [
      ...list,
      { tempId: String(list.length), name, email: email || undefined },
    ]);
    this.memberInput.set({ name: '', email: '' });
  }

  protected removeMember(index: number): void {
    this.members.update(list => list.filter((_, i) => i !== index));
  }

  protected nextStep(): void {
    if (this.members().length < 2) return;
    this.store.dispatch(new SetMembers(this.members()));
    this.store.dispatch(new NextStepAction());
  }
}
