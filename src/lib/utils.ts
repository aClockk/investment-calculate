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
    lump_sum: '到期一次性',
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

export function getStatusColorClass(status: InvestmentStatus): string {
  const map: Record<InvestmentStatus, string> = {
    settled: 'text-green-600 bg-green-50 border-green-200',
    unsettled: 'text-orange-600 bg-orange-50 border-orange-200',
  };
  return map[status] || '';
}
