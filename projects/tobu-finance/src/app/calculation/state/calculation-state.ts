import { Injectable } from "@angular/core";
import { Selector, State } from "@ngxs/store";
import { DateTime } from "luxon";
import { CalculationGroup } from "../domain/calculation-group";
import { CalculationParticipant } from "../domain/calculation-participant";
import { GroupType } from "../domain/group-type";


export class CalculationStateModel {
  selectedDate: DateTime;

  calculationGroup: CalculationGroup[];

  participants: CalculationParticipant[];
}

@State<CalculationStateModel>({
  name: 'calculationState',
  defaults: {
    selectedDate: DateTime.now().startOf('month'),
    calculationGroup: [
      {
        id: 'test',
        estimation: 200,
        groupType: GroupType.Groceries,
        name: 'Lebensmittel',
        positions: [
          {
            id: '1',
            description: 'Some stuff',
            value: 50
          }
        ],
        calculatedParticipantPayments: new Map([['Caro', 1500], ['Tony', 1700]])
      },
      {
        id: 'test2',
        estimation: 1200,
        groupType: GroupType.Rent,
        name: 'Miete',
        positions: [
          {
            id: '23',
            description: 'Miete Wohnung xy',
            value: 1200
          }
        ],
        calculatedParticipantPayments: new Map([['Caro', 1500], ['Tony', 1700]])
      }
    ],
    participants: [{id: '1', name: 'Caro'}, {id: '2', name: 'Tony'}]
  }
})
@Injectable()
export class CalculationState {

  @Selector()
  public static getGroups(state: CalculationStateModel): CalculationGroup[] {
    return state.calculationGroup;
  }

  @Selector()
  public static getParticipants(state: CalculationStateModel): CalculationParticipant[] {
    return state.participants;
  }

}



