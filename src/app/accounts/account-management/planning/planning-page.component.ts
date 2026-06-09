import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Store, select } from '@ngxs/store';
import { BreakpointObserver } from '@angular/cdk/layout';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DateTime } from 'luxon';
import { FormsModule } from '@angular/forms';
import { AccordionModule } from 'primeng/accordion';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';
import { DatePickerModule } from 'primeng/datepicker';
import { PlanningPageSelectors } from './state/planning.selectors';
import { LoadPlanning, SetPlanningReferenceMonth } from './state/planning.actions';
import { PlanningOverviewSectionComponent } from './planning-overview-section.component';
import { BudgetPlanningSectionComponent } from './budget-planning-section.component';
import { IncomePlanningSectionComponent } from './income-planning-section.component';
import { ContributionRulesSectionComponent } from './contribution-rules-section.component';
import { SpecialBlocksSectionComponent } from './special-blocks-section.component';
import { PlanningPreviewCardComponent } from './planning-preview-card.component';
import { BudgetEditorSidebarComponent } from './budget-editor-sidebar.component';
import { IncomeEditorSidebarComponent } from './income-editor-sidebar.component';

type ActiveSection = 'overview' | 'budgets' | 'incomes' | 'rules' | 'specials';

@Component({
  selector: 'tbf-planning-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    AccordionModule,
    ButtonModule,
    ProgressSpinnerModule,
    MessageModule,
    DatePickerModule,
    PlanningPreviewCardComponent,
    BudgetEditorSidebarComponent,
    IncomeEditorSidebarComponent,
    PlanningOverviewSectionComponent,
    BudgetPlanningSectionComponent,
    IncomePlanningSectionComponent,
    ContributionRulesSectionComponent,
    SpecialBlocksSectionComponent,
  ],
  templateUrl: './planning-page.component.html',
})
export class PlanningPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(Store);
  private readonly breakpointObserver = inject(BreakpointObserver);

  protected readonly loading = select(PlanningPageSelectors.loading);
  protected readonly error = select(PlanningPageSelectors.error);
  protected readonly isMobile = signal(false);
  protected readonly activeSection = signal<ActiveSection>('overview');

  /** Date object bound to p-datepicker (month-only mode) */
  protected pickerDate = new Date();

  protected readonly navItems: { key: ActiveSection; label: string }[] = [
    { key: 'overview', label: 'Überblick' },
    { key: 'budgets', label: 'Budgets' },
    { key: 'incomes', label: 'Einkommen' },
    { key: 'rules', label: 'Beitragsregeln' },
    { key: 'specials', label: 'Sonderbausteine' },
  ];

  constructor() {
    const accountId = this.route.snapshot.pathFromRoot
      .map(r => r.params['accountId'])
      .find(id => !!id);

    if (accountId) {
      const currentMonth = DateTime.now().toFormat('yyyy-MM');
      this.pickerDate = DateTime.now().startOf('month').toJSDate();
      this.store.dispatch(new LoadPlanning(accountId, currentMonth));
    }

    this.breakpointObserver
      .observe('(max-width: 767px)')
      .pipe(takeUntilDestroyed())
      .subscribe(state => this.isMobile.set(state.matches));
  }

  protected onPickerMonthSelect(date: Date): void {
    const month = DateTime.fromJSDate(date).toFormat('yyyy-MM');
    this.pickerDate = DateTime.fromISO(`${month}-01`).toJSDate();
    this.store.dispatch(new SetPlanningReferenceMonth(month));
  }

  protected retry(): void {
    const accountId = this.route.snapshot.pathFromRoot
      .map(r => r.params['accountId'])
      .find(id => !!id);
    if (accountId) {
      const month = DateTime.fromJSDate(this.pickerDate).toFormat('yyyy-MM');
      this.store.dispatch(new LoadPlanning(accountId, month));
    }
  }

  protected scrollToSection(section: ActiveSection): void {
    this.activeSection.set(section);
    document
      .getElementById(`planning-${section}-section`)
      ?.scrollIntoView({ behavior: 'smooth' });
  }
}
