import { Participant } from '@/domain/participant';
import { Component, inject, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  AbstractControlOptions,
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Store } from '@ngxs/store';
import { ButtonModule } from 'primeng/button';
import { DataViewModule } from 'primeng/dataview';
import { InputTextModule } from 'primeng/inputtext';
import { RippleModule } from 'primeng/ripple';
import { NextStepAction, SetMembers } from '../state/wizard.actions';
import { WizardMemberModel } from '../domain/wizard-member.model';

export function wizardValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const membersArray = control.get('members') as FormArray;

    return membersArray.length < 1 ? { toFewMembers: true } : null;
  };
}

@Component({
  selector: 'app-member-information',
  templateUrl: './member-information.html',
  styleUrls: ['./member-information.scss'],
  imports: [
    DataViewModule,
    InputTextModule,
    ButtonModule,
    RippleModule,
    ReactiveFormsModule,
  ],
})
export class MemberInformation implements OnInit {
  private store = inject(Store);
  private fb = inject(FormBuilder);

  public memberGroups = signal<FormGroup[]>([]);

  wizardForm = this.fb.group({
    members: this.fb.array<WizardMemberModel>([]),
  },
  {
    validators: wizardValidator(),
    updateOn: 'change'
  } as AbstractControlOptions
);

  memberForm = this.fb.group({
    name: ['', [Validators.required]],
    email: ['', [Validators.email]],
  });

  private memberArray = this.wizardForm.get('members') as FormArray;

  constructor() {}

  ngOnInit() {}

  // public addMember() {
  //   let value = this.memberForm.value;
  //   this.members.update(x => {
  //     x.push({
  //       tempId: this.members().length + '',
  //       name: value.name!,
  //       email: value.email!
  //     })
  //     return [...x];
  //   })
  //   this.memberForm.reset();
  // }

  // public removeMember(member: WizardMemberModel) {
  //   this.members.update(x => {

  //     let index = x.findIndex(value => value == member);
  //     x.splice(index);

  //     return x;
  //   })
  // }

  addMember() {
    if (this.memberForm.invalid) return;

    const memberData = this.memberForm.value;

    // Optional: Generiere tempId hier oder im Backend
    const memberGroup = this.fb.group({
      name: [memberData.name],
      email: [memberData.email],
    });

    this.memberArray.push(memberGroup);

    this.memberGroups.set(this.memberArray.controls as FormGroup[]);
    this.memberForm.reset();
  }

  removeMember(index: number) {
    this.memberArray.removeAt(index);
    this.memberGroups.set(this.memberArray.controls as FormGroup[]);
  }


  nextStep() {
    if (this.memberGroups().length < 2) return;

    const membersData = this.wizardForm.value.members! as WizardMemberModel[];
    this.store.dispatch(new SetMembers(membersData));
    this.store.dispatch(new NextStepAction());
  }
}
