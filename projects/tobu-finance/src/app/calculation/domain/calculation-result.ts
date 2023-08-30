export class CalculationResult {
  verifiedChange: number;
  estimatedChange: number;

  calculatedParticipantPayments: Map<string,number>;

  additionalContributions: number;
  monthlyChange: number;
  monthlyAccountValue: number;
}
