import { DateTime } from "luxon";
import { GroupType } from "projects/tobu-finance/src/app/calculation/domain/group-type";
import { CalculationStateModel } from "projects/tobu-finance/src/app/calculation/state/calculation.state";

export const data: CalculationStateModel = {
  selectedDate: DateTime.now().startOf('month'),
  calculationGroup: [
    {
      id: 'test',
      verifiedChange: 135,
      estimatedChange: 200,
      type: GroupType.Groceries,
      typeName: 'Lebensmittel',
      positions: [
        {
          id: '1',
          description: 'Some stuff',
          value: 50,
          positionType: 1,
          partnerName: "Edeka",
          date: new Date("2023-08-05T00:00Z")
        },
        {
          id: "2",
          description: "Other stuff",
          value: 20,
          positionType: 1,
          partnerName: "Lidl",
          date: new Date("2023-08-19T00:00Z")
        }
      ],
      calculatedParticipantPayments: new Map([['Caro', 555], ['Tony', 650]])
    },
    {
      id: "test3",
      verifiedChange: 123,
      estimatedChange: 100,
      type: 2,
      typeName: "Drugs",
      positions: [
        {
          id: "56",
          description: "Einkauf dm",
          value: 1200,
          positionType: 0,
          partnerName: "DM",
          date: new Date("2023-08-14T00:00Z")
        }
      ],
      calculatedParticipantPayments: new Map([["Caro", 300], ["Tony", 400]])
    },
    {
      id: 'test2',
      verifiedChange: 1200,
      estimatedChange: 1200,
      type: GroupType.Rent,
      typeName: "Miete",
      positions: [
        {
          id: '23',
          description: 'Miete Wohnung xy',
          value: 1200,
          positionType: 0,
          partnerName: "Vermieter XY",
          date: new Date("2023-08-02T00:00Z")
        }
      ],
      calculatedParticipantPayments: new Map([['Caro', 200], ['Tony', 240]])
    }
  ],
  participants: [{ id: '1', name: 'Caro' }, { id: '2', name: 'Tony' }],

  calculationResult: {
    calculatedParticipantPayments: new Map([['Caro', 1055], ['Tony', 1290]]),
    estimatedChange: 1500,
    verifiedChange: 1458,
    monthlyChange: 400,
    additionalContributions: 300,
    monthlyAccountValue: 3040
  }
}
