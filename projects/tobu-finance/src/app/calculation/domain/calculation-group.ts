import { GroupType } from "src/app/store/model/group-type.enum";
import { CalculationPosition } from "./calculation-position";

export class CalculationGroup {
  id: string;

  estimation: number;
  name: string;
  positions: CalculationPosition[]

  groupType: GroupType;

  calculatedParticipantPayments: Map<string,number>;

}
