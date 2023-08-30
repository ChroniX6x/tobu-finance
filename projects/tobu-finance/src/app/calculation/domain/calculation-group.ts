
import { CalculationPosition } from "./calculation-position";
import { GroupType } from "./group-type";

export class CalculationGroup {
  id: string;

  verifiedChange: number;
  estimatedChange: number;

  name: string;
  positions: CalculationPosition[]

  groupType: GroupType;

  calculatedParticipantPayments: Map<string,number>;

}
