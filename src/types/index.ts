export type Role = "ADMIN" | "SUPERVISOR" | "VIEWER";
export type EntryType = "REJECTION" | "REWORK";

export interface Line {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface Part {
  id: string;
  name: string;
  netWeight?: number | null;
  unitCost: number;
  isActive: boolean;
}

export interface DefectType {
  id: string;
  name: string;
  category?: string | null;
  description?: string | null;
  isActive: boolean;
}

export interface User {
  id: string;
  email: string;
  name?: string | null;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export interface RejectionRow {
  id?: string;
  defectTypeId: string;
  defectTypeName?: string;
  qty: number;
  unitCost: number;
  totalCost: number;
  type: EntryType;
}

export interface DailyEntryFull {
  id: string;
  date: string;
  lineId: string;
  lineName: string;
  partId: string;
  partName: string;
  producedQty: number;
  notes?: string | null;
  rejections: RejectionRow[];
  enteredBy: { name?: string | null; email: string };
  createdAt: string;
}

export interface OverviewMetrics {
  totalProduced: number;
  totalRejections: number;
  totalRework: number;
  totalCost: number;
  rejectionRate: number | null;
  reworkRate: number | null;
  period: string;
  anomalies: AnomalyFlag[];
}

export interface TrendDataPoint {
  date: string;
  produced: number;
  rejections: number;
  rework: number;
  rejectionRate: number | null;
  cost: number;
  movingAvgRate?: number | null;
}

export interface ParetoItem {
  defectName: string;
  count: number;
  cost: number;
  cumPercent: number;
}

export interface LineComparisonItem {
  lineName: string;
  produced: number;
  rejections: number;
  rework: number;
  rejectionRate: number | null;
  cost: number;
}

export interface HeatmapCell {
  lineName: string;
  defectName: string;
  count: number;
  cost: number;
}

export interface AnomalyFlag {
  date: string;
  lineName?: string;
  rejectionRate: number;
  threshold: number;
  deviation: number;
}
