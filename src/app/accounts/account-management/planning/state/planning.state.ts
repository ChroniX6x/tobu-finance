import { Injectable } from '@angular/core';
import { State } from '@ngxs/store';

// Stub – wird in Baustein 2 mit vollständigem StateModel und Actions befüllt.
export interface PlanningPageStateModel {}

@State<PlanningPageStateModel>({
  name: 'planningPage',
  defaults: {},
})
@Injectable()
export class PlanningPageState {}
