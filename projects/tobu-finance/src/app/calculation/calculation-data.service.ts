import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { lastValueFrom, map } from 'rxjs';
import { CalculationStateModel } from './state/calculation.state';

@Injectable({
  providedIn: 'root'
})
export class CalculationDataService {

private http: HttpClient = inject(HttpClient);

constructor() { }

public getTestData() {
  return this.http.get<CalculationStateModel>('assets/data/test/calculation-data.json').pipe(
    map( (value) => {
      value.calculationGroup.map( x => {
        x.calculatedParticipantPayments = new Map<string,number>(x.calculatedParticipantPayments);
        // x.positions.map(y => {
        //   y.date = new Date(y.date);
        //   return y;
        // })
        return x;
      })

      return value;
    })
  );
}

}
