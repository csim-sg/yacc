import { BaseListRequest } from "@yacc/common/requests/base-list.request";
import type { PgSelectQueryBuilder } from "drizzle-orm/pg-core";

export class PaginationRequest extends BaseListRequest {

    setPagination(query: PgSelectQueryBuilder): PgSelectQueryBuilder {
        return query.limit(this.getLimit()).offset(this.getPage() * this.getLimit())
    }
}