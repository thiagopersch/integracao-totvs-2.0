export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ApiResponse<T> = {
  data: T;
  meta?: PaginationMeta;
  message?: string;
};

export type ApiError = {
  message: string;
  errors?: Record<string, string[]>;
};

export type SelectOption = {
  label: string;
  value: string;
};

export type SortDirection = "asc" | "desc";

export type SortParams = {
  field: string;
  direction: SortDirection;
};

export type ListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: SortParams;
  filters?: Record<string, string | boolean | undefined>;
};
