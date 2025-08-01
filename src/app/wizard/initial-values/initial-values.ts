import { Component, effect, inject, OnInit, signal } from '@angular/core';
import { select, Store } from '@ngxs/store';
import { ButtonModule } from 'primeng/button';
import { FluidModule } from 'primeng/fluid';
import { InputTextModule } from 'primeng/inputtext';
import { RippleModule } from 'primeng/ripple';
import { NextStepAction, SaveWizardData, SetInitials } from '../state/wizard.actions';
import { InputNumberModule } from 'primeng/inputnumber';
import { ReactiveFormsModule, FormBuilder, Validators, FormArray, FormGroup } from '@angular/forms';
import { FieldsetModule } from 'primeng/fieldset';
import { WizardState } from '../state/wizard.state';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { WizardInitialsModel } from '../domain/wizard-initials.model';
import { MemberInitialValuesModel } from '../domain/member-initial-values.model';
import { CategoryInitialValuesModel } from '../domain/category-initial-values.model';

@Component({
  selector: 'tbf-initial-values',
  templateUrl: './initial-values.html',
  styleUrls: ['./initial-values.scss'],
  imports: [ InputTextModule, InputNumberModule, FluidModule, ButtonModule, RippleModule, ReactiveFormsModule, FieldsetModule, InputGroupModule, InputGroupAddonModule ]
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
        this.fb.nonNullable.group({
          name: [member.name, Validators.required],
          memberId: [member.tempId, Validators.required],
          initialIncome: [0, Validators.required]
        })
      )
    })
    this.memberGroups.set(memberarray.controls as FormGroup[]);
  })

  private categories = select(WizardState.categories);
  public categoryGroups = signal<FormGroup[]>([]);

  categoryChangeEffect = effect(() => {
    let categories = this.categories();

    let categoryArray = this.initialsForm.get('categoryInitials') as FormArray;
    categories.forEach( category => {
      categoryArray.push(
        this.fb.nonNullable.group({
          name: [category.name, Validators.required],
          categoryId: [category.tempId, Validators.required],
          initialExpenseEst: [0, Validators.required]
        })
      )
    })
    this.categoryGroups.set(categoryArray.controls as FormGroup[]);
  })

  public initialsForm = this.fb.nonNullable.group({
    accountBalance: [0, Validators.required],
    memberInitials: this.fb.nonNullable.array<MemberInitialValuesModel>([]),
    categoryInitials: this.fb.nonNullable.array<CategoryInitialValuesModel>([])
  })

  // public memberInitialsArray = signal((this.initialsForm.get('memberInitials') as FormArray).controls as);
  // public categoryInitialsArray = signal(this.initialsForm.get('categoryInitials') as FormArray);

  public memberInitialsArray = this.initialsForm.get('memberInitials') as FormArray;
  public categoryExpenseEstimationsArray = this.initialsForm.get('categoryInitials') as FormArray;

  constructor() { }

  ngOnInit() {
  }

  nextStep() {
    let value = this.initialsForm.value;
    this.store.dispatch(new SetInitials({accountBalance: value.accountBalance!, memberInitials: value.memberInitials!, categoryInitials: value.categoryInitials!}))

    this.store.dispatch(new SaveWizardData())
  }

}
