import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CalculationDataService } from './calculation-data.service';

describe('CalculationDataService', () => {
  let service: CalculationDataService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CalculationDataService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());
  const fixture = () => ({
    calculationGroup: [{ calculatedParticipantPayments: { alice: 1250, bob: 750 } }],
    calculationResult: { calculatedParticipantPayments: { alice: 1250, bob: 750 } },
  });

  it('loads the selected month and converts serialized payments to Maps', () => {
    service.getTestData('2026-04').subscribe(result => {
      expect(result.calculationGroup[0].calculatedParticipantPayments.get('alice')).toBe(1250);
      expect(result.calculationResult.calculatedParticipantPayments.get('bob')).toBe(750);
    });
    http.expectOne('/test/calc-data-2026-04').flush(fixture());
  });

  it('falls back to the default data when the month is unavailable', () => {
    service.getTestData('2026-04').subscribe(result => {
      expect(result.calculationResult.calculatedParticipantPayments.get('alice')).toBe(1250);
    });
    http.expectOne('/test/calc-data-2026-04').flush('Missing', { status: 404, statusText: 'Not Found' });
    http.expectOne('/test/calculation-data.json').flush(fixture());
  });
});
