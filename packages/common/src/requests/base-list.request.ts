import {isNumber} from "class-validator";

export class BaseListRequest {
  page?: number = 0;
  limit?: number = 15;
  searchText?: string;

  private _defaultLimit:number[] = [15, 25, 35, 45, 55, 100, 150, 200, 0]

  getPage():number {
    if(!this.page || !isNumber(this.page) || this.page<0) {
      this.page = 0
    }
    return this.page
  }

  getLimit():number {
    if(!this.limit || !isNumber(this.limit) || this._defaultLimit.findIndex(d=>d === this.limit)<0) {
      this.limit = this._defaultLimit[0]
    }
    return this.limit
  }

  getSearch() {
    return this.searchText || ""
  }

  /**
   * Calculate the offset for database pagination queries.
   * Uses 0-indexed pages internally (page=0 is first page).
   *
   * Formula: offset = page * limit
   * - Page 0 (first page) → offset 0
   * - Page 1 (second page) → offset = limit
   *
   * Note: API accepts 1-indexed pages, but getPage() normalizes to 0-indexed.
   * BaseListResponse converts back to 1-indexed for API response.
   */
  getOffset(): number {
    return this.getPage() * this.getLimit();
  }
}