import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { EditionDto, GetAccountNftsOptions, GetAccountStakingOptions, GetEditionsOptions, GetListingsOptions, GetSalesOptions, ListingDto, NftItemDto, PagedQueryOptions, PagedResponse, ReferralInfoDto, SaleDto, StakingPairDto, TransparencySummaryDto } from './market-data.models';

@Injectable({ providedIn: 'root' })
export class MarketDataService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  private buildPageParams(opts: PagedQueryOptions): HttpParams {
    let params = new HttpParams()
      .set('page', String(opts.page))
      .set('pageSize', String(opts.pageSize));
    if (opts.filter) params = params.set('filter', opts.filter);
    if (opts.orderBy) params = params.set('orderBy', opts.orderBy);
    return params;
  }

  async getListings(opts: GetListingsOptions): Promise<PagedResponse<ListingDto>> {
    return firstValueFrom(
      this.http.get<PagedResponse<ListingDto>>(`${this.base}/marketplace/listings`, { params: this.buildPageParams(opts) }),
    );
  }

  async getEditions(opts: GetEditionsOptions): Promise<PagedResponse<EditionDto>> {
    return firstValueFrom(
      this.http.get<PagedResponse<EditionDto>>(`${this.base}/editions`, { params: this.buildPageParams(opts) }),
    );
  }

  async getAccountNfts(address: string, opts: GetAccountNftsOptions): Promise<PagedResponse<NftItemDto>> {
    return firstValueFrom(
      this.http.get<PagedResponse<NftItemDto>>(`${this.base}/accounts/${address}/nfts`, { params: this.buildPageParams(opts) }),
    );
  }

  async getAllAccountNfts(address: string): Promise<NftItemDto[]> {
    const pageSize = 100;
    const first = await this.getAccountNfts(address, { page: 1, pageSize });
    const total = first.totalCount;
    const totalPages = Math.ceil(total / pageSize);
    if (totalPages <= 1) return first.items;
    const rest = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) =>
        this.getAccountNfts(address, { page: i + 2, pageSize }).then((r) => r.items),
      ),
    );
    return [...first.items, ...rest.flat()];
  }

  async getAccountStaking(address: string, opts: GetAccountStakingOptions): Promise<PagedResponse<StakingPairDto>> {
    return firstValueFrom(
      this.http.get<PagedResponse<StakingPairDto>>(`${this.base}/accounts/${address}/staking`, { params: this.buildPageParams(opts) }),
    );
  }

  async getTransparencySummary(): Promise<TransparencySummaryDto> {
    return firstValueFrom(
      this.http.get<TransparencySummaryDto>(`${this.base}/transparency/summary`),
    );
  }

  async getSales(opts: GetSalesOptions): Promise<PagedResponse<SaleDto>> {
    return firstValueFrom(
      this.http.get<PagedResponse<SaleDto>>(`${this.base}/transparency/sales`, { params: this.buildPageParams(opts) }),
    );
  }

  async getAccountReferral(address: string): Promise<ReferralInfoDto> {
    return firstValueFrom(
      this.http.get<ReferralInfoDto>(`${this.base}/accounts/${address}/referral`),
    );
  }
}
