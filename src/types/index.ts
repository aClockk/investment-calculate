// 资金类型
export type CapitalType = 'loan' | 'own';

// 还款方式
export type RepaymentType = 'equal_interest' | 'equal_principal' | 'interest_first' | 'lump_sum';

// 投资状态
export type InvestmentStatus = 'settled' | 'unsettled';

// 结清方式
export type SettlementType = 'lump_sum' | 'continuous';

// 资金记录（贷款+自有混合）
export interface CapitalRecord {
  id: string;
  type: CapitalType;
  name: string;
  amount: number;
  date: string;
  remark: string;
  loanDetails?: {
    lender: string;
    repaymentType: RepaymentType;
    totalPeriods: number;
    monthlyPayment: number;
    monthlyRate: number;
    annualRate: number;
    startDate: string;
    endDate: string;
  };
  createdAt: number;
}

// 还款记录
export interface RepaymentRecord {
  id: string;
  loanId: string;
  date: string;
  amount: number;
  principal: number;
  interest: number;
  period: number;
  isExtra: boolean;
  remark: string;
  createdAt: number;
}

// 投资记录
export interface InvestmentRecord {
  id: string;
  name: string;
  principal: number;
  interestRate: number;        // 利息点数（如 6, 11, 25）
  settlementFrequency: number; // 每月结算次数（一直结有效，默认1）
  returnedPrincipal: number;
  returnedInterest: number;
  remainingPrincipal: number;
  settlementType: SettlementType;
  status: InvestmentStatus;
  startDate: string;
  endDate?: string;            // 一次性结必须有，一直结无
  remark: string;
  createdAt: number;
}

// 利润统计
export interface ProfitSummary {
  totalProfit: number;
  totalRepayment: number;
  netProfit: number;
  settledProfit: number;
  unsettledProfit: number;
}

// 按月利润
export interface MonthlyProfit {
  month: string;
  totalProfit: number;
  items: {
    projectId: string;
    projectName: string;
    amount: number;
    settlementType: SettlementType;
    // 「一直结」且每月结算多次时，用于展示「单次利润 × 次数 = 总和」
    perTimeProfit?: number;
    times?: number;
  }[];
}
