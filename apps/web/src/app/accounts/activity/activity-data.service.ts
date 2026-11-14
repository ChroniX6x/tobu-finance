import { inject, Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { map } from "rxjs";
import { ActivityPageSchema } from "@tobu/contracts/activity";
import { API_BASE_URL } from "@/core/api-base-url.token";

@Injectable({ providedIn: "root" })
export class ActivityDataService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  get(accountId: string, filters: Record<string, string>, cursor?: string) {
    let params = new HttpParams({ fromObject: { limit: "20", ...filters } });
    if (cursor) params = params.set("cursor", cursor);
    return this.http
      .get<unknown>(
        `${this.base}/api/accounts/${encodeURIComponent(accountId)}/activity`,
        { params },
      )
      .pipe(map((body) => ActivityPageSchema.parse(body)));
  }
}
