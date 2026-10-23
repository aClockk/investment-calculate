import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { RepaymentType, InvestmentStatus, SettlementType } from "@/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('zh-CN');
}

export function getRepaymentTypeLabel(type: RepaymentType): string {
  const map: Record<RepaymentType, string> = {
    equal_interest: '等额本息',
    equal_principal: '等额本金',
    interest_first: '先息后本',
    lump_sum: '一次结清',
  };
  return map[type] || type;
}

export function getInvestmentStatusLabel(status: InvestmentStatus): string {
  const map: Record<InvestmentStatus, string> = {
    settled: '结清',
    unsettled: '未结清',
  };
  return map[status] || status;
}

export function getSettlementTypeLabel(type: SettlementType): string {
  const map: Record<SettlementType, string> = {
    lump_sum: '一次性结',
    continuous: '一直结',
  };
  return map[type] || type;
}

// 根据开始日期、每月结算次数、已结算期数，推算“结算至 X月第N期”。
// 第 p 期：月份偏移 = floor((p-1)/freq)，月内第几期 = (p-1)%freq + 1。
export function getSettledPeriodLabel(startDate: string, frequency: number, settledPeriods: number): string {
  if (!settledPeriods || settledPeriods <= 0) return '未开始结算';
  const freq = frequency > 0 ? frequency : 1;
  const start = new Date(startDate);
  if (isNaN(start.getTime())) return `已结算 ${settledPeriods} 期`;
  const monthOffset = Math.floor((settledPeriods - 1) / freq);
  const periodInMonth = ((settledPeriods - 1) % freq) + 1;
  const d = new Date(start.getFullYear(), start.getMonth() + monthOffset, 1);
  return `${d.getMonth() + 1}月第${periodInMonth}期`;
}

export function getStatusColorClass(status: InvestmentStatus): string {
  const map: Record<InvestmentStatus, string> = {
    settled: 'text-green-600 bg-green-50 border-green-200',
    unsettled: 'text-orange-600 bg-orange-50 border-orange-200',
  };
  return map[status] || '';
}
