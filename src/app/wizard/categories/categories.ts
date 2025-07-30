import {
  Component,
  computed,
  inject,
  OnInit,
  effect,
  signal,
  ChangeDetectorRef,
} from '@angular/core';
import { select, Store } from '@ngxs/store';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { RippleModule } from 'primeng/ripple';
import { NextStepAction, SetCategories } from '../state/wizard.actions';
import { DataViewModule } from 'primeng/dataview';
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
import { WizardState } from '../state/wizard.state';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule, JsonPipe } from '@angular/common';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { InputNumberModule } from 'primeng/inputnumber';
import { WizardCategoryModel } from '../domain/wizard-category.model';

export function customSplitSumValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const hasCustomSplit = control.get('hasCustomSplit')?.value;
    const customSplitArray = control.get('customSplit') as FormArray;

    if (!hasCustomSplit) {
      return null;
    }

    const total = customSplitArray.controls.reduce((sum, group) => {
      const split = parseFloat(group.get('split')?.value);
      return sum + (isNaN(split) ? 0 : split);
    }, 0);

    return total !== 100 ? { splitSumInvalid: true } : null;
  };
}

export function wizardValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const categoriesArray = control.get('categories') as FormArray;

    return categoriesArray.length < 1 ? { toFewCategories: true } : null;
  };
}


@Component({
  selector: 'tbf-categories',
  templateUrl: './categories.html',
  styleUrls: ['./categories.scss'],
  imports: [
    DataViewModule,
    InputTextModule,
    ButtonModule,
    RippleModule,
    ReactiveFormsModule,
    ToggleSwitchModule,
    CommonModule,
    InputGroupModule,
    InputGroupAddonModule,
    InputNumberModule,
  ],
})
export class Categories implements OnInit {
  private store = inject(Store);
  private fb = inject(FormBuilder);

  public categoryGroups = signal<FormGroup[]>([]);
  public members = select(WizardState.members);
  formChangeEffect = effect(() => {
    const shouldBuild = this.hasCustomSplit();
    const currentMembers = this.members();

    const customSplitArray = this.categoriesForm.get('customSplit') as FormArray;

    if (shouldBuild && customSplitArray.length !== currentMembers.length) {

      customSplitArray.clear();
      currentMembers.forEach((member) => {
        customSplitArray.push(
          this.fb.nonNullable.group({
            memberId: member.tempId,
            name: member.name,
            split: ['', Validators.required],
          })
        );
      });
    }
  });

  public wizardForm = this.fb.group({
    categories: this.fb.array([]),
  },
  {
    validators: wizardValidator(),
    updateOn: 'change'
  } as AbstractControlOptions
);

  public categoriesForm = this.fb.group(
    {
      name: ['', Validators.required],
      hasCustomSplit: false,
      customSplit: this.fb.array([]),
    },
    {
      validators: customSplitSumValidator(),
      updateOn: 'change'
    } as AbstractControlOptions
  )

  public hasCustomSplit = toSignal(
    this.categoriesForm.get('hasCustomSplit')!.valueChanges,
    { initialValue: false }
  );

  private categoryArray = this.wizardForm.get('categories') as FormArray;
  protected customSplitGroups = computed(() => {
    const hasCustomSplit = this.hasCustomSplit();
    const splitArray = this.categoriesForm.get('customSplit') as FormArray
    return splitArray.controls as FormGroup[]
  });

  updateValidator = effect(() => {
    const hasCustomSplit = this.hasCustomSplit();
    let customSplitArray = this.categoriesForm.get('customSplit') as FormArray;

    customSplitArray.controls.forEach((group) => {
      if (hasCustomSplit) {
        group.get('memberId')?.setValidators(Validators.required);
        group.get('split')?.setValidators(Validators.required);
      } else {
        group.get('memberId')?.clearValidators();
        group.get('split')?.clearValidators();
      }

      group.get('memberId')?.updateValueAndValidity();
      group.get('split')?.updateValueAndValidity();
    });
  });

  constructor() {}

  ngOnInit(): void {}

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
    if (this.categoryGroups().length < 2) return;

    const categoriesData = this.wizardForm.value.categories! as WizardCategoryModel[];
    this.store.dispatch(new SetCategories(categoriesData));

    this.store.dispatch(new NextStepAction());
  }
}
