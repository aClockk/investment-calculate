import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import type { CapitalRecord, RepaymentRecord, InvestmentRecord, ProfitSummary, MonthlyProfit } from '@/types';

const CAPITAL_KEY = 'invest_capital_records_v6';
const REPAYMENT_KEY = 'invest_repayment_records_v6';
const INVESTMENT_KEY = 'invest_investment_records_v6';
const INIT_KEY = 'invest_data_initialized_v6';

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
    return newRecord.id;
  }, [setInvestmentRecords]);

  const updateInvestment = useCallback((id: string, updates: Partial<Omit<InvestmentRecord, 'id' | 'createdAt'>>) => {
    setInvestmentRecords(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  }, [setInvestmentRecords]);

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

  // 自有本金 = 总本金 - 贷款总额
  const getOwnCapital = useCallback(() => {
    return getTotalCapital() - getTotalLoan();
  }, [getTotalCapital, getTotalLoan]);

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
          const profit = inv.principal * (inv.interestRate / 100) * inv.settlementFrequency;

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

  // 初始化数据导入
  const initializeData = useCallback(() => {
    if (initialized) return;

    const now = Date.now();
    const genId = () => `${now}_${Math.random().toString(36).substr(2, 9)}`;

    const capitals: CapitalRecord[] = [];
    const repayments: RepaymentRecord[] = [];

    // 自有资金 - 小鱼 5万
    const ownId = genId();
    capitals.push({
      id: ownId,
      type: 'own',
      name: '小鱼',
      amount: 50000,
      date: '2026-01-01',
      remark: '自有资金',
      createdAt: now,
    });

    // 2. 借款1 - 杜小满 10万 等额本息
    const r1 = 0.004074;
    const loan1Id = genId();
    capitals.push({
      id: loan1Id,
      type: 'loan',
      name: '杜小满',
      amount: 100000,
      date: '2026-07-07',
      remark: '等额本息',
      loanDetails: {
        lender: '杜小满',
        repaymentType: 'equal_interest',
        totalPeriods: 12,
        monthlyPayment: 8555.98,
        monthlyRate: r1,
        annualRate: r1 * 12,
        startDate: '2026-07-07',
        endDate: '2027-07-07',
      },
      createdAt: now,
    });
    let bal1 = 100000;
    for (let i = 1; i <= 3; i++) {
      const int1 = bal1 * r1;
      const pri1 = 8555.98 - int1;
      bal1 -= pri1;
      const dates = ['2026-08-07', '2026-09-07', '2026-10-07'];
      repayments.push({
        id: genId(),
        loanId: loan1Id,
        date: dates[i - 1],
        amount: 8555.98,
        principal: pri1,
        interest: int1,
        period: i,
        isExtra: false,
        remark: '',
        createdAt: now,
      });
    }

    // 3. 借款2 - 抖音 15万 等额本金
    const loan2Id = genId();
    capitals.push({
      id: loan2Id,
      type: 'loan',
      name: '抖音',
      amount: 150000,
      date: '2026-08-07',
      remark: '等额本金，已还3期',
      loanDetails: {
        lender: '抖音',
        repaymentType: 'equal_principal',
        totalPeriods: 12,
        monthlyPayment: 13385.09,
        monthlyRate: 0.01395,
        annualRate: 0.1674,
        startDate: '2026-08-07',
        endDate: '2027-08-07',
      },
      createdAt: now,
    });
    const pri2Per = 150000 / 12;
    for (let i = 1; i <= 3; i++) {
      const rem2 = 150000 - pri2Per * (i - 1);
      const int2 = rem2 * 0.01395;
      const dates = ['2026-09-07', '2026-10-07', '2026-11-07'];
      repayments.push({
        id: genId(),
        loanId: loan2Id,
        date: dates[i - 1],
        amount: pri2Per + int2,
        principal: pri2Per,
        interest: int2,
        period: i,
        isExtra: false,
        remark: '',
        createdAt: now,
      });
    }

    // 4. 借款3 - 网商贷 5万 等额本金
    const r3 = 0.013778;
    const loan3Id = genId();
    capitals.push({
      id: loan3Id,
      type: 'loan',
      name: '网商贷',
      amount: 50000,
      date: '2026-09-17',
      remark: '等额本金，已还2期',
      loanDetails: {
        lender: '网商贷',
        repaymentType: 'equal_principal',
        totalPeriods: 12,
        monthlyPayment: 4740.73,
        monthlyRate: r3,
        annualRate: r3 * 12,
        startDate: '2026-09-17',
        endDate: '2027-09-17',
      },
      createdAt: now,
    });
    const pri3Per = 50000 / 12;
    for (let i = 1; i <= 2; i++) {
      const rem3 = 50000 - pri3Per * (i - 1);
      const int3 = rem3 * r3;
      const dates = ['2026-10-17', '2026-11-17'];
      repayments.push({
        id: genId(),
        loanId: loan3Id,
        date: dates[i - 1],
        amount: pri3Per + int3,
        principal: pri3Per,
        interest: int3,
        period: i,
        isExtra: false,
        remark: '',
        createdAt: now,
      });
    }

    // 5. 借款4 - 借呗（6笔先息后本）
    const jiebeiLoans = [
      { name: '借呗-1', amount: 89122.99, periods: 9, monthlyPay: 359.16, rate: 0.00403, start: '2026-09-04' },
      { name: '借呗-2', amount: 14510.59, periods: 9, monthlyPay: 202.42, rate: 0.01395, start: '2026-09-04' },
      { name: '借呗-3', amount: 100000, periods: 9, monthlyPay: 1395, rate: 0.01395, start: '2026-09-04' },
      { name: '借呗-4', amount: 50000, periods: 10, monthlyPay: 697.5, rate: 0.01395, start: '2026-09-04' },
      { name: '借呗-5', amount: 50000, periods: 10, monthlyPay: 697.5, rate: 0.01395, start: '2026-09-04' },
      { name: '借呗-6', amount: 30000, periods: 12, monthlyPay: 405, rate: 0.0135, start: '2026-09-04' },
    ];

    for (const jb of jiebeiLoans) {
      const lid = genId();
      capitals.push({
        id: lid,
        type: 'loan',
        name: jb.name,
        amount: jb.amount,
        date: jb.start,
        remark: '先息后本',
        loanDetails: {
          lender: '借呗',
          repaymentType: 'interest_first',
          totalPeriods: jb.periods,
          monthlyPayment: jb.monthlyPay,
          monthlyRate: jb.rate,
          annualRate: jb.rate * 12,
          startDate: jb.start,
          endDate: '2027-09-04',
        },
        createdAt: now,
      });
      repayments.push({
        id: genId(),
        loanId: lid,
        date: '2026-10-04',
        amount: jb.monthlyPay,
        principal: 0,
        interest: jb.monthlyPay,
        period: 1,
        isExtra: false,
        remark: '',
        createdAt: now,
      });
    }

    // 6. 借款5 - 闪电贷 10万 先息后本 年利率3% 共9期 已还0期 还剩9期
    const loan5Id = genId();
    const r5 = 0.0025833; // 258.33/100000 ≈ 0.25833% (按31天)
    capitals.push({
      id: loan5Id,
      type: 'loan',
      name: '闪电贷',
      amount: 100000,
      date: '2026-10-12',
      remark: '先息后本，年利率3%，按360天计息',
      loanDetails: {
        lender: '闪电贷',
        repaymentType: 'interest_first',
        totalPeriods: 9,
        monthlyPayment: 250,
        monthlyRate: r5,
        annualRate: 0.03,
        startDate: '2026-10-12',
        endDate: '2027-07-12',
      },
      createdAt: now,
    });
    // 无已还记录，还剩9期

    // 7. 借款6 - 花呗（两笔）
    const loan6aId = genId();
    capitals.push({
      id: loan6aId,
      type: 'loan',
      name: '花呗-1',
      amount: 36963.95,
      date: '2026-10-20',
      remark: '11月20日到期',
      loanDetails: {
        lender: '花呗',
        repaymentType: 'lump_sum',
        totalPeriods: 1,
        monthlyPayment: 36963.95,
        monthlyRate: 0,
        annualRate: 0,
        startDate: '2026-10-20',
        endDate: '2026-11-20',
      },
      createdAt: now,
    });

    const loan6bId = genId();
    capitals.push({
      id: loan6bId,
      type: 'loan',
      name: '花呗-2',
      amount: 16963.15,
      date: '2026-11-20',
      remark: '12月20日到期',
      loanDetails: {
        lender: '花呗',
        repaymentType: 'lump_sum',
        totalPeriods: 1,
        monthlyPayment: 16963.15,
        monthlyRate: 0,
        annualRate: 0,
        startDate: '2026-11-20',
        endDate: '2026-12-20',
      },
      createdAt: now,
    });

    // 8. 借款7 - 平安信用卡
    const loan7Id = genId();
    capitals.push({
      id: loan7Id,
      type: 'loan',
      name: '平安信用卡',
      amount: 50000,
      date: '2026-10-16',
      remark: '11月16日还款50000.64',
      loanDetails: {
        lender: '平安信用卡',
        repaymentType: 'lump_sum',
        totalPeriods: 1,
        monthlyPayment: 50000.64,
        monthlyRate: 0,
        annualRate: 0,
        startDate: '2026-10-16',
        endDate: '2026-11-16',
      },
      createdAt: now,
    });

    // ========== 导入投资项目 ==========
    const investments: InvestmentRecord[] = [
      {
        id: genId(),
        name: '项目1-月结3次',
        principal: 300000,
        interestRate: 6,
        settlementFrequency: 3,
        returnedPrincipal: 0,
        returnedInterest: 0,
        remainingPrincipal: 300000,
        settlementType: 'continuous',
        status: 'unsettled',
        startDate: '2026-11-01',
        remark: '投30w，每次结6个点利息，一月3次',
        createdAt: now,
      },
      {
        id: genId(),
        name: '项目2-月结1次',
        principal: 100000,
        interestRate: 6,
        settlementFrequency: 1,
        returnedPrincipal: 0,
        returnedInterest: 0,
        remainingPrincipal: 100000,
        settlementType: 'continuous',
        status: 'unsettled',
        startDate: '2026-11-01',
        remark: '投10w，每次结6个点利息，一月1次',
        createdAt: now,
      },
      {
        id: genId(),
        name: '项目3-75w本金',
        principal: 750000,
        interestRate: 11,
        settlementFrequency: 1,
        returnedPrincipal: 0,
        returnedInterest: 0,
        remainingPrincipal: 750000,
        settlementType: 'lump_sum',
        status: 'unsettled',
        startDate: '2026-10-14',
        endDate: '2026-11-01',
        remark: '75万本金，11个点利息',
        createdAt: now,
      },
      {
        id: genId(),
        name: '项目4-12w本金',
        principal: 120000,
        interestRate: 25,
        settlementFrequency: 1,
        returnedPrincipal: 0,
        returnedInterest: 0,
        remainingPrincipal: 120000,
        settlementType: 'lump_sum',
        status: 'unsettled',
        startDate: '2026-10-14',
        endDate: '2026-11-01',
        remark: '12万本金，25个点利息',
        createdAt: now,
      },
    ];

    setCapitalRecords(capitals);
    setRepaymentRecords(repayments);
    setInvestmentRecords(investments);
    setInitialized(true);
  }, [setCapitalRecords, setRepaymentRecords, setInvestmentRecords, setInitialized, initialized]);

  return {
    capitalRecords,
    repaymentRecords,
    investmentRecords,
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
    initializeData,
  };
}
