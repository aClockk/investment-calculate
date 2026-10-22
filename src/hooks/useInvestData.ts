import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import type { CapitalRecord, RepaymentRecord, InvestmentRecord, ProfitSummary, MonthlyProfit } from '@/types';

const CAPITAL_KEY = 'invest_capital_records_v7';
const REPAYMENT_KEY = 'invest_repayment_records_v7';
const INVESTMENT_KEY = 'invest_investment_records_v7';
const INIT_KEY = 'invest_data_initialized_v7';
const UNSETTLED_POOL_KEY = 'invest_unsettled_pool_v7';
const OWN_CAPITAL_BASE_KEY = 'invest_own_capital_base_v7';

// 自有本金基数（含快照），作为数据一部分持久化，可随导出/导入/清空变动。
// base = 初始数据下“总本金 - 贷款剩余应还” = 1270000 - 717181.88 = 552818.12；
// 快照为该基数对应时种子数据已存在的累计流水，只计算此后增量，避免重复扣减。
interface OwnCapitalBase {
  base: number;
  snapshotProfit: number;
  snapshotInterest: number;
  snapshotPrincipal: number;
}
const DEFAULT_OWN_CAPITAL_BASE: OwnCapitalBase = {
  base: 552818.12,
  snapshotProfit: 0,
  snapshotInterest: 11256.32,
  snapshotPrincipal: 70378.80,
};

// 计算项目「应收利息总和」，用于结清时判断本+利是否收全：
// - 一次性结：本金 × 利息点数
// - 一直结：本金 × 利息点数 × 每月结算次数 × 经过月数（开始日期到今天，至少 1 个月）
function getExpectedTotalInterest(inv: InvestmentRecord): number {
  const rate = inv.interestRate / 100;
  if (inv.settlementType === 'lump_sum') {
    return inv.principal * rate;
  }
  const start = new Date(inv.startDate);
  const now = new Date();
  let months = 1;
  if (!isNaN(start.getTime())) {
    months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()) + 1;
    if (months < 1) months = 1;
  }
  return inv.principal * rate * inv.settlementFrequency * months;
}

export interface MonthlyPaymentDetail {
  month: string;
  total: number;
  items: {
    loanId: string;
    loanName: string;
    amount: number;
    principal: number;
    interest: number;
    period: number;
    note: string;
  }[];
}

export function useInvestData() {
  const [capitalRecords, setCapitalRecords] = useLocalStorage<CapitalRecord[]>(CAPITAL_KEY, []);
  const [repaymentRecords, setRepaymentRecords] = useLocalStorage<RepaymentRecord[]>(REPAYMENT_KEY, []);
  const [investmentRecords, setInvestmentRecords] = useLocalStorage<InvestmentRecord[]>(INVESTMENT_KEY, []);
  const [initialized, setInitialized] = useLocalStorage<boolean>(INIT_KEY, false);
  // 未结清本金池（全局持久化，初始 0）
  const [unsettledPool, setUnsettledPool] = useLocalStorage<number>(UNSETTLED_POOL_KEY, 0);
  // 自有本金基数（持久化，可被导出/导入/清空）
  const [ownCapitalBase, setOwnCapitalBase] = useLocalStorage<OwnCapitalBase>(OWN_CAPITAL_BASE_KEY, DEFAULT_OWN_CAPITAL_BASE);

  const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // ===== 资金操作 =====
  const addCapital = useCallback((record: Omit<CapitalRecord, 'id' | 'createdAt'>) => {
    const newRecord: CapitalRecord = { ...record, id: generateId(), createdAt: Date.now() };
    setCapitalRecords(prev => [...prev, newRecord]);
    return newRecord.id;
  }, [setCapitalRecords]);

  const updateCapital = useCallback((id: string, updates: Partial<Omit<CapitalRecord, 'id' | 'createdAt'>>) => {
    setCapitalRecords(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  }, [setCapitalRecords]);

  const deleteCapital = useCallback((id: string) => {
    setCapitalRecords(prev => prev.filter(r => r.id !== id));
    setRepaymentRecords(prev => prev.filter(r => r.loanId !== id));
  }, [setCapitalRecords, setRepaymentRecords]);

  // ===== 还款操作 =====
  const addRepayment = useCallback((record: Omit<RepaymentRecord, 'id' | 'createdAt'>) => {
    const newRecord: RepaymentRecord = { ...record, id: generateId(), createdAt: Date.now() };
    setRepaymentRecords(prev => [...prev, newRecord]);
    return newRecord.id;
  }, [setRepaymentRecords]);

  const updateRepayment = useCallback((id: string, updates: Partial<Omit<RepaymentRecord, 'id' | 'createdAt'>>) => {
    setRepaymentRecords(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  }, [setRepaymentRecords]);

  const deleteRepayment = useCallback((id: string) => {
    setRepaymentRecords(prev => prev.filter(r => r.id !== id));
  }, [setRepaymentRecords]);

  const getRepaymentsByLoanId = useCallback((loanId: string) => {
    return repaymentRecords.filter(r => r.loanId === loanId).sort((a, b) => a.period - b.period);
  }, [repaymentRecords]);

  // ===== 投资操作 =====
  const addInvestment = useCallback((record: Omit<InvestmentRecord, 'id' | 'createdAt'>) => {
    const newRecord: InvestmentRecord = { ...record, id: generateId(), createdAt: Date.now() };
    setInvestmentRecords(prev => [...prev, newRecord]);
    // 未结清本金池优先垫付新项目：按新项目投入本金冲减，不足则归 0（不改变新项目自身本金）
    setUnsettledPool(prev => Math.max(0, prev - newRecord.principal));
    return newRecord.id;
  }, [setInvestmentRecords, setUnsettledPool]);

  const updateInvestment = useCallback((id: string, updates: Partial<Omit<InvestmentRecord, 'id' | 'createdAt'>>) => {
    const old = investmentRecords.find(r => r.id === id);
    // 项目由「未结清」变为「结清」时，若 (已收本金+已收利息) < (投入本金+应收利息)，把差额挂入未结清本金池
    if (old && old.status !== 'settled' && updates.status === 'settled') {
      const merged: InvestmentRecord = { ...old, ...updates };
      const shortfall = (merged.principal + getExpectedTotalInterest(merged))
        - (merged.returnedPrincipal + merged.returnedInterest);
      if (shortfall > 0) {
        setUnsettledPool(prev => prev + shortfall);
      }
    }
    setInvestmentRecords(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  }, [investmentRecords, setInvestmentRecords, setUnsettledPool]);

  const deleteInvestment = useCallback((id: string) => {
    setInvestmentRecords(prev => prev.filter(r => r.id !== id));
  }, [setInvestmentRecords]);

  // ===== 统计计算 =====
  // 总本金 = 所有项目投入本金之和（无论结清与否）
  const getTotalCapital = useCallback(() => {
    return investmentRecords.reduce((sum, r) => sum + r.principal, 0);
  }, [investmentRecords]);

  // 贷款总额
  const getTotalLoan = useCallback(() => {
    return capitalRecords
      .filter(r => r.type === 'loan')
      .reduce((sum, r) => sum + r.amount, 0);
  }, [capitalRecords]);

  // 自有本金 = 基数 + (总利润 - 快照利润) - (还款利息 - 快照利息) - (还款本金 - 快照本金)
  const getOwnCapital = useCallback(() => {
    const totalProfit = investmentRecords.reduce((sum, r) => sum + r.returnedInterest, 0);
    const repaidInterest = repaymentRecords.reduce((sum, r) => sum + r.interest, 0);
    const repaidPrincipal = repaymentRecords.reduce((sum, r) => sum + r.principal, 0);
    return ownCapitalBase.base
      + (totalProfit - ownCapitalBase.snapshotProfit)
      - (repaidInterest - ownCapitalBase.snapshotInterest)
      - (repaidPrincipal - ownCapitalBase.snapshotPrincipal);
  }, [investmentRecords, repaymentRecords, ownCapitalBase]);

  // 贷款剩余应还本金
  const getLoanBalance = useCallback(() => {
    const loanTotal = getTotalLoan();
    const loanRepaidPrincipal = repaymentRecords
      .reduce((sum, r) => sum + r.principal, 0);
    return loanTotal - loanRepaidPrincipal;
  }, [getTotalLoan, repaymentRecords]);

  const getTotalRepayment = useCallback(() => {
    return repaymentRecords.reduce((sum, r) => sum + r.amount, 0);
  }, [repaymentRecords]);

  const getProfitSummary = useCallback((): ProfitSummary => {
    const settled = investmentRecords.filter(r => r.status === 'settled');
    const unsettled = investmentRecords.filter(r => r.status === 'unsettled');

    const settledProfit = settled.reduce((sum, r) => sum + r.returnedInterest, 0);
    const unsettledProfit = unsettled.reduce((sum, r) => sum + r.returnedInterest, 0);
    const totalProfit = settledProfit + unsettledProfit;
    const totalRepayment = getTotalRepayment();

    return {
      totalProfit,
      totalRepayment,
      netProfit: totalProfit - totalRepayment,
      settledProfit,
      unsettledProfit,
    };
  }, [investmentRecords, getTotalRepayment]);

  // ===== 按月利润计算 =====
  const getMonthlyProfits = useCallback((): MonthlyProfit[] => {
    const monthMap = new Map<string, MonthlyProfit>();
    const now = new Date();

    investmentRecords.forEach(inv => {
      // 已结清的项目不再计算利润
      if (inv.status === 'settled') return;

      if (inv.settlementType === 'lump_sum' && inv.endDate) {
        const month = inv.endDate.substring(0, 7);
        const profit = inv.principal * (inv.interestRate / 100);

        if (!monthMap.has(month)) {
          monthMap.set(month, { month, totalProfit: 0, items: [] });
        }
        const mp = monthMap.get(month)!;
        mp.totalProfit += profit;
        mp.items.push({
          projectId: inv.id,
          projectName: inv.name,
          amount: profit,
          settlementType: 'lump_sum',
        });
      } else if (inv.settlementType === 'continuous') {
        const start = new Date(inv.startDate);
        const startMonth = start.getFullYear() * 12 + start.getMonth();
        const endMonth = now.getFullYear() * 12 + now.getMonth() + 3;

        for (let m = startMonth; m <= endMonth; m++) {
          const year = Math.floor(m / 12);
          const monthIdx = (m % 12) + 1;
          const monthKey = `${year}-${String(monthIdx).padStart(2, '0')}`;
          const perTimeProfit = inv.principal * (inv.interestRate / 100);
          const profit = perTimeProfit * inv.settlementFrequency;

          if (!monthMap.has(monthKey)) {
            monthMap.set(monthKey, { month: monthKey, totalProfit: 0, items: [] });
          }
          const mp = monthMap.get(monthKey)!;
          mp.totalProfit += profit;
          mp.items.push({
            projectId: inv.id,
            projectName: inv.name,
            amount: profit,
            settlementType: 'continuous',
            perTimeProfit,
            times: inv.settlementFrequency,
          });
        }
      }
    });

    return Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [investmentRecords]);

  // ===== 每月应还金额明细计算 =====
  const getMonthlyPaymentDetails = useCallback((): MonthlyPaymentDetail[] => {
    const loans = capitalRecords.filter(r => r.type === 'loan');
    const monthMap = new Map<string, MonthlyPaymentDetail>();

    loans.forEach(loan => {
      const details = loan.loanDetails;
      if (!details) return;

      const loanReps = repaymentRecords.filter(r => r.loanId === loan.id);
      const repaidPeriods = new Set(loanReps.filter(r => !r.isExtra).map(r => r.period));
      const totalRepaidPrincipal = loanReps.reduce((s, r) => s + r.principal, 0);
      let remainingPrincipal = loan.amount - totalRepaidPrincipal;
      if (remainingPrincipal <= 0) return;

      const maxRepaidPeriod = repaidPeriods.size > 0 ? Math.max(...Array.from(repaidPeriods)) : 0;
      const startDate = new Date(details.startDate);
      const monthlyRate = details.monthlyRate;

      if (details.repaymentType === 'equal_interest') {
        const remainingPeriods = details.totalPeriods - maxRepaidPeriod;
        if (remainingPeriods <= 0) return;
        const monthlyPayment = remainingPrincipal * monthlyRate * Math.pow(1 + monthlyRate, remainingPeriods)
          / (Math.pow(1 + monthlyRate, remainingPeriods) - 1);

        for (let i = 1; i <= remainingPeriods; i++) {
          const periodNum = maxRepaidPeriod + i;
          const payDate = new Date(startDate.getFullYear(), startDate.getMonth() + periodNum, startDate.getDate());
          const monthKey = `${payDate.getFullYear()}-${String(payDate.getMonth() + 1).padStart(2, '0')}`;

          const interest = remainingPrincipal * monthlyRate;
          const principal = Math.min(monthlyPayment - interest, remainingPrincipal);
          remainingPrincipal -= principal;

          if (!monthMap.has(monthKey)) {
            monthMap.set(monthKey, { month: monthKey, total: 0, items: [] });
          }
          const detail = monthMap.get(monthKey)!;
          detail.total += principal + interest;
          detail.items.push({
            loanId: loan.id,
            loanName: loan.name,
            amount: principal + interest,
            principal,
            interest,
            period: periodNum,
            note: `第${periodNum}期`,
          });
        }
      } else if (details.repaymentType === 'equal_principal') {
        const monthlyPrincipal = loan.amount / details.totalPeriods;
        for (let i = maxRepaidPeriod + 1; i <= details.totalPeriods; i++) {
          const payDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, startDate.getDate());
          const monthKey = `${payDate.getFullYear()}-${String(payDate.getMonth() + 1).padStart(2, '0')}`;

          const interest = remainingPrincipal * monthlyRate;
          const principal = Math.min(monthlyPrincipal, remainingPrincipal);
          remainingPrincipal -= principal;

          if (!monthMap.has(monthKey)) {
            monthMap.set(monthKey, { month: monthKey, total: 0, items: [] });
          }
          const detail = monthMap.get(monthKey)!;
          detail.total += principal + interest;
          detail.items.push({
            loanId: loan.id,
            loanName: loan.name,
            amount: principal + interest,
            principal,
            interest,
            period: i,
            note: `第${i}期`,
          });
        }
      } else if (details.repaymentType === 'interest_first') {
        for (let i = maxRepaidPeriod + 1; i <= details.totalPeriods; i++) {
          const payDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, startDate.getDate());
          const monthKey = `${payDate.getFullYear()}-${String(payDate.getMonth() + 1).padStart(2, '0')}`;

          const isLast = i === details.totalPeriods;
          const interest = remainingPrincipal * monthlyRate;
          const principal = isLast ? remainingPrincipal : 0;

          if (!monthMap.has(monthKey)) {
            monthMap.set(monthKey, { month: monthKey, total: 0, items: [] });
          }
          const detail = monthMap.get(monthKey)!;
          detail.total += principal + interest;
          detail.items.push({
            loanId: loan.id,
            loanName: loan.name,
            amount: principal + interest,
            principal,
            interest,
            period: i,
            note: isLast ? `第${i}期(末)` : `第${i}期`,
          });
        }
      } else if (details.repaymentType === 'lump_sum') {
        const payDate = new Date(details.endDate);
        const monthKey = `${payDate.getFullYear()}-${String(payDate.getMonth() + 1).padStart(2, '0')}`;

        if (!monthMap.has(monthKey)) {
          monthMap.set(monthKey, { month: monthKey, total: 0, items: [] });
        }
        const detail = monthMap.get(monthKey)!;
        const interest = remainingPrincipal * monthlyRate;
        detail.total += remainingPrincipal + interest;
        detail.items.push({
          loanId: loan.id,
          loanName: loan.name,
          amount: remainingPrincipal + interest,
          principal: remainingPrincipal,
          interest,
          period: 1,
          note: '到期还款',
        });
      }
    });

    return Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [capitalRecords, repaymentRecords]);

  // ===== 数据导入 / 导出 / 清空 =====
  const exportData = useCallback(() => {
    return JSON.stringify({
      version: 7,
      exportedAt: new Date().toISOString(),
      capitalRecords,
      repaymentRecords,
      investmentRecords,
      unsettledPool,
      ownCapitalBase,
    }, null, 2);
  }, [capitalRecords, repaymentRecords, investmentRecords, unsettledPool, ownCapitalBase]);

  const importData = useCallback((json: string): boolean => {
    try {
      const data = JSON.parse(json);
      if (!Array.isArray(data.capitalRecords) || !Array.isArray(data.repaymentRecords) || !Array.isArray(data.investmentRecords)) {
        return false;
      }
      setCapitalRecords(data.capitalRecords);
      setRepaymentRecords(data.repaymentRecords);
      setInvestmentRecords(data.investmentRecords);
      setUnsettledPool(typeof data.unsettledPool === 'number' ? data.unsettledPool : 0);
      setOwnCapitalBase(data.ownCapitalBase && typeof data.ownCapitalBase.base === 'number'
        ? data.ownCapitalBase
        : { base: 0, snapshotProfit: 0, snapshotInterest: 0, snapshotPrincipal: 0 });
      setInitialized(true);
      return true;
    } catch (e) {
      console.error('导入数据失败:', e);
      return false;
    }
  }, [setCapitalRecords, setRepaymentRecords, setInvestmentRecords, setUnsettledPool, setOwnCapitalBase, setInitialized]);

  const clearAllData = useCallback(() => {
    setCapitalRecords([]);
    setRepaymentRecords([]);
    setInvestmentRecords([]);
    setUnsettledPool(0);
    setOwnCapitalBase({ base: 0, snapshotProfit: 0, snapshotInterest: 0, snapshotPrincipal: 0 });
    setInitialized(true);
  }, [setCapitalRecords, setRepaymentRecords, setInvestmentRecords, setUnsettledPool, setOwnCapitalBase, setInitialized]);

  return {
    capitalRecords,
    repaymentRecords,
    investmentRecords,
    unsettledPool,
    initialized,
    addCapital,
    updateCapital,
    deleteCapital,
    addRepayment,
    updateRepayment,
    deleteRepayment,
    getRepaymentsByLoanId,
    addInvestment,
    updateInvestment,
    deleteInvestment,
    getTotalCapital,
    getTotalLoan,
    getOwnCapital,
    getLoanBalance,
    getTotalRepayment,
    getProfitSummary,
    getMonthlyProfits,
    getMonthlyPaymentDetails,
    exportData,
    importData,
    clearAllData,
  };
}
