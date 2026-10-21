import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, lastValueFrom, map } from 'rxjs';
import { CalculationStateModel } from './state/calculation.state';
import { MongoClient } from 'mongodb';

@Injectable({
  providedIn: 'root',
})
export class CalculationDataService {
  private http: HttpClient = inject(HttpClient);
  constructor() {}

  public getTestData(selectedMonth: string) {

    let filname = `/test/calc-data-${selectedMonth}`

    return this.http
      .get<CalculationStateModel>(filname)
      .pipe(
        map((value) => {
          value.calculationGroup.map((x) => {
            x.calculatedParticipantPayments = new Map<string, number>(
              Object.entries(x.calculatedParticipantPayments)
            );
            // x.positions.map(y => {
            //   y.date = new Date(y.date);
            //   return y;
            // })
            return x;
          });

          value.calculationResult.calculatedParticipantPayments = new Map<
            string,
            number
          >(Object.entries(value.calculationResult.calculatedParticipantPayments));

          return value;
        }),
        catchError(_ => this.http
                  .get<CalculationStateModel>('/test/calculation-data.json')
                  .pipe(
                    map((value) => {
                      value.calculationGroup.map((x) => {
                        x.calculatedParticipantPayments = new Map<string, number>(
                          Object.entries(x.calculatedParticipantPayments)
                        );
                        // x.positions.map(y => {
                        //   y.date = new Date(y.date);
                        //   return y;
                        // })
                        return x;
                      });

                      value.calculationResult.calculatedParticipantPayments = new Map<
                        string,
                        number
                      >(Object.entries(value.calculationResult.calculatedParticipantPayments));

                      return value;
                    }))
      ));
  }

  // public async testDB() {
  //   const client = new MongoClient('mongodb://localhost:27017/');
  //   await client.connect();
  // }
}
