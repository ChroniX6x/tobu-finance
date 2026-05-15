import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AccordionModule } from 'primeng/accordion';
import { PlanningOverviewSectionComponent } from './planning-overview-section.component';
import { BudgetPlanningSectionComponent } from './budget-planning-section.component';
import { IncomePlanningSectionComponent } from './income-planning-section.component';
import { ContributionRulesSectionComponent } from './contribution-rules-section.component';
import { SpecialBlocksSectionComponent } from './special-blocks-section.component';

type ActiveSection = 'overview' | 'budgets' | 'incomes' | 'rules' | 'specials';

@Component({
  selector: 'tbf-planning-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AccordionModule,
    PlanningOverviewSectionComponent,
    BudgetPlanningSectionComponent,
    IncomePlanningSectionComponent,
    ContributionRulesSectionComponent,
    SpecialBlocksSectionComponent,
  ],
  templateUrl: './planning-page.component.html',
})
export class PlanningPageComponent {
  private readonly breakpointObserver = inject(BreakpointObserver);

  protected readonly isMobile = signal(false);
  protected readonly activeSection = signal<ActiveSection>('overview');

  protected readonly navItems: { key: ActiveSection; label: string }[] = [
    { key: 'overview', label: 'Überblick' },
    { key: 'budgets', label: 'Budgets' },
    { key: 'incomes', label: 'Einkommen' },
    { key: 'rules', label: 'Beitragsregeln' },
    { key: 'specials', label: 'Sonderbausteine' },
  ];

  constructor() {
    this.breakpointObserver
      .observe('(max-width: 767px)')
      .pipe(takeUntilDestroyed())
      .subscribe(state => this.isMobile.set(state.matches));
  }

  protected scrollToSection(section: ActiveSection): void {
    this.activeSection.set(section);
    document
      .getElementById(`planning-${section}-section`)
      ?.scrollIntoView({ behavior: 'smooth' });
  }
}
