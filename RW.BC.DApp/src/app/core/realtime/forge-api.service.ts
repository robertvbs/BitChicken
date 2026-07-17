import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PagedResponse } from '../market-data/market-data.models';

export interface ForgeRequestDto {
  requestId: string;
  tier: number;
  status: string;
  tokenId: string | null;
  editionId: string | null;
  blockNumber: string;
}

export type ForgeRequestFilter = 'status' | 'tier' | 'requestId';

export interface ForgeRequestsQuery {
  page?: number;
  pageSize?: number;
  filter?: string;
  orderBy?: string;
}

@Injectable({ providedIn: 'root' })
export class ForgeApiService {
  private readonly http = inject(HttpClient);

  async getForgeRequests(
    address: string,
    query: ForgeRequestsQuery = {},
  ): Promise<PagedResponse<ForgeRequestDto>> {
    const key = address.toLowerCase();
    let params = new HttpParams();
    if (query.page !== undefined) params = params.set('page', String(query.page));
    if (query.pageSize !== undefined) params = params.set('pageSize', String(query.pageSize));
    if (query.filter) params = params.set('filter', query.filter);
    if (query.orderBy) params = params.set('orderBy', query.orderBy);

    return firstValueFrom(
      this.http.get<PagedResponse<ForgeRequestDto>>(
        `${environment.apiBaseUrl}/accounts/${key}/forge-requests`,
        { params },
      ),
    );
  }
}
