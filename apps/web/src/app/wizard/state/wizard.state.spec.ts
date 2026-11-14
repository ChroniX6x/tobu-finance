import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import type { StateContext } from "@ngxs/store";
import { WizardState, WizardStateModel } from "./wizard.state";
import { WizardDataService } from "./wizard-data.service";
import { SaveWizardData } from "./wizard.actions";

describe("wizard save completion", () => {
  it("shares concurrent saves, navigates with the resolved id, and clears checkpoints only after successful navigation", async () => {
    let finishCreate!: (id: string) => void;
    let finishNavigation!: (success: boolean) => void;
    const data = jasmine.createSpyObj<WizardDataService>("data", [
      "createNewAccount",
      "completeAccountCreation",
    ]);
    data.createNewAccount.and.returnValue(
      new Promise<string>((resolve) => {
        finishCreate = resolve;
      }),
    );
    const router = jasmine.createSpyObj<Router>("router", ["navigate"]);
    router.navigate.and.returnValue(
      new Promise<boolean>((resolve) => {
        finishNavigation = resolve;
      }),
    );
    TestBed.configureTestingModule({
      providers: [
        WizardState,
        { provide: Router, useValue: router },
        { provide: WizardDataService, useValue: data },
      ],
    });
    const state = TestBed.inject(WizardState);
    const context = jasmine.createSpyObj<StateContext<WizardStateModel>>(
      "context",
      ["getState", "setState"],
    );
    context.getState.and.returnValue({
      currentStep: 4,
      data: { name: "Ready" },
    });
    const first = state.saveWizardData(context, new SaveWizardData());
    expect(state.saveWizardData(context, new SaveWizardData())).toBe(first);
    expect(data.createNewAccount).toHaveBeenCalledTimes(1);
    expect(router.navigate).not.toHaveBeenCalled();
    finishCreate("a".repeat(24));
    await Promise.resolve();
    expect(router.navigate).toHaveBeenCalledOnceWith([
      "accounts",
      "a".repeat(24),
    ]);
    expect(data.completeAccountCreation).not.toHaveBeenCalled();
    finishNavigation(true);
    await first;
    expect(data.completeAccountCreation).toHaveBeenCalledOnceWith(
      "a".repeat(24),
    );
    expect(context.setState).toHaveBeenCalledOnceWith({
      currentStep: 1,
      data: { name: "Account", members: [], categories: [] },
    });
  });

  it("preserves the wizard and its checkpoint after canceled navigation, then permits an explicit retry", async () => {
    const data = jasmine.createSpyObj<WizardDataService>("data", [
      "createNewAccount",
      "completeAccountCreation",
    ]);
    data.createNewAccount.and.resolveTo("b".repeat(24));
    const router = jasmine.createSpyObj<Router>("router", ["navigate"]);
    router.navigate.and.resolveTo(false);
    TestBed.configureTestingModule({
      providers: [
        WizardState,
        { provide: Router, useValue: router },
        { provide: WizardDataService, useValue: data },
      ],
    });
    const state = TestBed.inject(WizardState);
    const context = jasmine.createSpyObj<StateContext<WizardStateModel>>(
      "context",
      ["getState", "setState"],
    );
    context.getState.and.returnValue({
      currentStep: 4,
      data: { name: "Ready" },
    });
    await state.saveWizardData(context, new SaveWizardData());
    expect(data.completeAccountCreation).not.toHaveBeenCalled();
    expect(context.setState).not.toHaveBeenCalled();
    router.navigate.and.resolveTo(true);
    await state.saveWizardData(context, new SaveWizardData());
    expect(data.createNewAccount).toHaveBeenCalledTimes(2);
    expect(data.completeAccountCreation).toHaveBeenCalledOnceWith(
      "b".repeat(24),
    );
  });
});
