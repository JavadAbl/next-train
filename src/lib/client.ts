"use client";

export type Role = "ADMIN" | "OPERATOR" | "REPAIRMAN";
export type ServiceType = "REPAIR" | "VISIT" | "REPLACEMENT";

export interface SessionUser {
  id: string;
  username: string;
  fullName: string;
  role: Role;
}

export interface TrainSummary {
  id: string;
  name: string;
  model: string | null;
  serialNo: string | null;
  description: string | null;
  rootImage: string | null;
  nodeCount: number;
  areaCount: number;
  leafParts: number;
  recordCount: number;
}

export interface TreeArea {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  hasChild: boolean;
  childNode: TreeNode | null;
}

export interface TreeNode {
  id: string;
  name: string;
  image: string;
  areas: TreeArea[];
}

export interface TrainTree {
  train: {
    id: string;
    name: string;
    model: string | null;
    serialNo: string;
    description: string | null;
  };
  root: TreeNode | null;
}

export interface RecordRow {
  id: string;
  trainId: string;
  train: { id: string; name: string };
  areaId: string | null;
  area: { id: string; name: string } | null;
  path: string;
  type: ServiceType;
  date: string;
  description: string;
  partNumber: string | null;
  laborHours: number | null;
  repairman: { id: string; fullName: string };
  createdAt: string;
}

export interface UserRow {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  active: boolean;
  createdAt: string;
  _count?: { records: number };
}

export async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  if (init?.body) headers["Content-Type"] = "application/json";
  const res = await fetch(path, { ...init, headers });
  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    throw new Error((data.error as string) || "خطا در ارتباط با سرور");
  }
  return data as T;
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "مدیر",
  OPERATOR: "اپراتور",
  REPAIRMAN: "تعمیرکار",
};

export const ROLE_BADGES: Record<Role, string> = {
  ADMIN: "bg-primary text-primary-foreground",
  OPERATOR: "bg-secondary text-secondary-foreground",
  REPAIRMAN: "bg-accent text-accent-foreground",
};

export const TYPE_LABELS: Record<ServiceType, string> = {
  REPAIR: "تعمیر",
  VISIT: "بازدید",
  REPLACEMENT: "تعویض قطعه",
};

export const TYPE_BADGES: Record<ServiceType, string> = {
  REPAIR: "bg-amber-100 text-amber-900 border-amber-300",
  VISIT: "bg-emerald-100 text-emerald-900 border-emerald-300",
  REPLACEMENT: "bg-rose-100 text-rose-900 border-rose-300",
};

export const SEPARATOR = " › ";
