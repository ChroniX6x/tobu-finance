
import { CalculationPosition } from "./calculation-position";
import { GroupType } from "./group-type";

export class CalculationGroup {
  id: string;

  estimation: number;
  name: string;
  positions: CalculationPosition[]

  groupType: GroupType;

  calculatedParticipantPayments: Map<string,number>;

}
