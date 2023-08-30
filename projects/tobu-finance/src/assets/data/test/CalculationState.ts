import { DateTime } from "luxon";
import { GroupType } from "../domain/group-type";

export const data = {
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
  participants: [{ id: '1', name: 'Caro' }, { id: '2', name: 'Tony' }]
}
