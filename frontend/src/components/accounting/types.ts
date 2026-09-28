import { ReactNode } from "react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export type StatusType =
  | "POSTED"
  | "DRAFT"
  | "RECONCILED"
  | "UNRECONCILED"
  | "PENDING"
  | "PARTIAL"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "UNPAID"
  | "VOID"
  | "REVERSED"
  | "CREDIT_IN_FAVOR"
  | "PENDING_COST";

export interface TableColumn<T = any> {
  key: string;
  header: string;
  align?: "left" | "center" | "right";
  width?: string;
  sortable?: boolean;
  render?: (row: T, index: number) => ReactNode;
}

export interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}
