import { Component, computed, inject, OnInit, output, signal } from '@angular/core';
import { select, Store } from '@ngxs/store';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { RippleModule } from 'primeng/ripple';
import { NextStepAction } from '../state/wizard.actions';
import { DataViewModule } from 'primeng/dataview';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { WizardState } from '../state/wizard.state';
import { WizardCategoryModel } from '../domain/wizard-category.model';
import { forEach, split } from 'lodash';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule, JsonPipe } from '@angular/common';

@Component({
  selector: 'tbf-categories',
  templateUrl: './categories.html',
  styleUrls: ['./categories.scss'],
  imports: [ DataViewModule, InputTextModule, ButtonModule, RippleModule, ReactiveFormsModule, ToggleSwitchModule, CommonModule ]
})
export class Categories implements OnInit {

  private store = inject(Store);
  private fb = inject(FormBuilder);
  public members = select(WizardState.members)
  public customSplitEntries = computed(() => {
    let currentMembers = this.members();
    let customSplit = this.categoriesForm.get('customSplit') as FormArray;
    customSplit.clear()
    if(currentMembers.length > 0) {
      currentMembers.forEach(member => {
        customSplit.push(this.fb.nonNullable.group({
          memberId: member.tempId,
          name: member.name,
          split: ['', Validators.required]
        }));
      });
    }
    return customSplit;
  })

  public categoryGroups = signal<FormGroup[]>([]);

  public wizardForm =  this.fb.group({
    categories: this.fb.array([])
  })

  public categoriesForm =  this.fb.group({
    name: ['', Validators.required],
    hasCustomSplit: false,
    customSplit: this.fb.array([this.fb.nonNullable.group({
      memberId: ['', Validators.required],
      split: ['', Validators.required]
    })])
  })
  public hasCustomSplit = toSignal(this.categoriesForm.get('hasCustomSplit')!.valueChanges, {initialValue: false})

  private categoryArray = this.wizardForm.get('categories') as FormArray;

  constructor() { }

  ngOnInit(): void {

  }

  // addCategory() {
  //   let newValue = this.categoriesForm.value;
  //   this.categories.update(x => {
  //     let category: WizardCategoryModel = {name: newValue.name!};
  //     if(newValue.customSplit && newValue.customSplit.length > 0) {
  //       category.customSplit = []
  //       newValue.customSplit.forEach(splitValue => {
  //         category.customSplit?.push({
  //           memberId: splitValue.memberId as string,
  //           split: Number(splitValue.split)
  //         });
  //       });
  //     }
  //     x.push(category);
  //     return [...x];
  //   })
  //   this. categoriesForm.reset();
  // }

  // removeCategory(category: WizardCategoryModel) {
  //   this.categories.update(x => {

  //     let index = x.findIndex(value => value == category);
  //     x.splice(index);

  //     return x;
  //   })
  // }

    addCategory() {
    if (this.categoriesForm.invalid) return;

    const categoryData = this.categoriesForm.value;

    const categoryGroup = this.fb.group({
      //this.generateTempId(),
      name: [categoryData.name],
      customSplit: [categoryData.customSplit],
    });

    this.categoryArray.push(categoryGroup);

    this.categoryGroups.set(this.categoryArray.controls as FormGroup[]);
    this.categoriesForm.reset();
  }

  removeCategory(index: number) {
    this.categoryArray.removeAt(index);
    this.categoryGroups.set(this.categoryArray.controls as FormGroup[]);
  }

  nextStep() {
    this.store.dispatch(new NextStepAction())
  }

}
