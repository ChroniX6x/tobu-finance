import { DateTime } from "luxon";
import { CalculationPositionType } from "./calculation-position-type.enum";

export class CalculationPosition {
  id: string;
  description: string;
  value: number;
  positionType: CalculationPositionType;
  partnerName: string;
  date: Date;
}
