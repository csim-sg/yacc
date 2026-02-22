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
}