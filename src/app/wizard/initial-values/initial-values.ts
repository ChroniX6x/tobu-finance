import { Component, effect, inject, OnInit, signal } from '@angular/core';
import { select, Store } from '@ngxs/store';
import { ButtonModule } from 'primeng/button';
import { FluidModule } from 'primeng/fluid';
import { InputTextModule } from 'primeng/inputtext';
import { RippleModule } from 'primeng/ripple';
import { NextStepAction } from '../state/wizard.actions';
import { InputNumberModule } from 'primeng/inputnumber';
import { ReactiveFormsModule, FormBuilder, Validators, FormArray, FormGroup } from '@angular/forms';
import { FieldsetModule } from 'primeng/fieldset';
import { WizardState } from '../state/wizard.state';

@Component({
  selector: 'tbf-initial-values',
  templateUrl: './initial-values.html',
  styleUrls: ['./initial-values.scss'],
  imports: [ InputTextModule, InputNumberModule, FluidModule, ButtonModule, RippleModule, ReactiveFormsModule, FieldsetModule ]
})
export class InitialValues implements OnInit {

  private store = inject(Store);
  private fb = inject(FormBuilder);

  private members = select(WizardState.members);
  public memberGroups = signal<FormGroup[]>([]);
  memberChangeEffect = effect(() => {
    let members = this.members();

    let memberarray = this.initialsForm.get('memberInitials') as FormArray;
    members.forEach( member => {
      memberarray.push(
        this.fb.group({
          name: member.name,
          memberId: member.tempId,
          initialIncome: 0
        })
      )
    })
    this.memberGroups.set(memberarray.controls as FormGroup[]);
  })



  public initialsForm = this.fb.group({
    accountBalance: ['', Validators.required],
    memberInitials: this.fb.array([]),
    categoryInitials: this.fb.array([])
  })

  // public memberInitialsArray = signal((this.initialsForm.get('memberInitials') as FormArray).controls as);
  // public categoryInitialsArray = signal(this.initialsForm.get('categoryInitials') as FormArray);

  public memberInitialsFormArray = this.initialsForm.get('memberInitials') as FormArray;
  public categoryInitialsFormArray = this.initialsForm.get('categoryInitials') as FormArray;

  constructor() { }

  ngOnInit() {
  }

  nextStep() {
    this.store.dispatch(new NextStepAction())
  }

}
