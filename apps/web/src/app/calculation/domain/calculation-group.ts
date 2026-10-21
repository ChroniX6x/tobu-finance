
import { CalculationPosition } from "./calculation-position";
import { GroupType } from "./group-type";

export class CalculationGroup {
  id!: string;

  verifiedChange!: number;
  estimatedChange!: number;

  type!: GroupType;
  typeName!: string;

  positions!: CalculationPosition[];

  calculatedParticipantPayments!: Map<string, number>;

}
