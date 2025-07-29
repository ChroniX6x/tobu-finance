/* tslint:disable:no-unused-variable */

import { TestBed, async, inject } from '@angular/core/testing';
import { CalculationDataService } from './calculation-data.service';

describe('Service: CalculationData', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CalculationDataService]
    });
  });

  it('should ...', inject([CalculationDataService], (service: CalculationDataService) => {
    expect(service).toBeTruthy();
  }));
});
