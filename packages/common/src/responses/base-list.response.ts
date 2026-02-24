import type { BaseListRequest } from "@/requests/base-list.request";

export class BaseListResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;

  constructor(data: T[], total: number, listRequest: BaseListRequest) {
    this.total = total
    this.data = data;
    this.limit = listRequest.getLimit()
    this.page = listRequest.getPage() + 1
  }
}