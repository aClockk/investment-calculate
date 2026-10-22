import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, CreditCard, PiggyBank, Calculator, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, getSettlementTypeLabel } from '@/lib/utils';
import type { InvestmentRecord, ProfitSummary, MonthlyProfit } from '@/types';

interface ProfitSectionProps {
  records: InvestmentRecord[];
  profitSummary: ProfitSummary;
  monthlyProfits: MonthlyProfit[];
  onUpdateInvestment: (id: string, updates: Partial<Omit<InvestmentRecord, 'id' | 'createdAt'>>) => void;
}

interface SettlementItem {
  projectId: string;
  projectName: string;
  settlementType: 'lump_sum' | 'continuous';
  remainingPrincipal: number;
  nextMonthInterest: number;
  settlePrincipal: boolean;
  settleInterest: boolean;
  principalAmount: string;
  interestAmount: string;
}

export function ProfitSection({ records, profitSummary, monthlyProfits, onUpdateInvestment }: ProfitSectionProps) {
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [settlementDialogOpen, setSettlementDialogOpen] = useState(false);
  const [settlementItems, setSettlementItems] = useState<SettlementItem[]>([]);
  const [nextMonth, setNextMonth] = useState('');

  const toggleMonth = (month: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  };

  // 计算次月
  const getNextMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 2; // +2 because getMonth() is 0-based, we want next month
    if (month > 12) {
      return `${year + 1}-${String(month - 12).padStart(2, '0')}`;
    }
    return `${year}-${String(month).padStart(2, '0')}`;
  };

  // 计算某项目在某月的应收利息
  const calculateMonthInterest = (inv: InvestmentRecord, monthKey: string) => {
    if (inv.status === 'settled') return 0;
    if (inv.settlementType === 'lump_sum' && inv.endDate) {
      const endMonth = inv.endDate.substring(0, 7);
      return endMonth === monthKey ? inv.principal * (inv.interestRate / 100) : 0;
    } else if (inv.settlementType === 'continuous') {
      return inv.principal * (inv.interestRate / 100) * inv.settlementFrequency;
    }
    return 0;
  };

  // 打开月度结算弹窗
  const openSettlementDialog = () => {
    const nm = getNextMonth();
    setNextMonth(nm);

    const items: SettlementItem[] = records
      .filter(r => r.status === 'unsettled')
      .map(inv => {
        const interest = calculateMonthInterest(inv, nm);
        return {
          projectId: inv.id,
          projectName: inv.name,
          settlementType: inv.settlementType,
          remainingPrincipal: inv.remainingPrincipal,
          nextMonthInterest: interest,
          settlePrincipal: false,
          settleInterest: false,
          principalAmount: String(inv.remainingPrincipal),
          interestAmount: String(interest.toFixed(2)),
        };
      });

    setSettlementItems(items);
    setSettlementDialogOpen(true);
  };

  // 更新结算项
  const updateSettlementItem = (projectId: string, updates: Partial<SettlementItem>) => {
    setSettlementItems(prev => prev.map(item =>
      item.projectId === projectId ? { ...item, ...updates } : item
    ));
  };

  // 计算结算总额
  const settlementTotals = useMemo(() => {
    let principal = 0;
    let interest = 0;
    settlementItems.forEach(item => {
      if (item.settlePrincipal) principal += Number(item.principalAmount) || 0;
      if (item.settleInterest) interest += Number(item.interestAmount) || 0;
    });
    return { principal, interest, total: principal + interest };
  }, [settlementItems]);

  // 确认结算
  const handleConfirmSettlement = () => {
    settlementItems.forEach(item => {
      if (!item.settlePrincipal && !item.settleInterest) return;

      const inv = records.find(r => r.id === item.projectId);
      if (!inv) return;

      const principalAdd = item.settlePrincipal ? (Number(item.principalAmount) || 0) : 0;
      const interestAdd = item.settleInterest ? (Number(item.interestAmount) || 0) : 0;

      const newReturnedPrincipal = inv.returnedPrincipal + principalAdd;
      const newReturnedInterest = inv.returnedInterest + interestAdd;
      const newRemainingPrincipal = Math.max(0, inv.principal - newReturnedPrincipal);

      // 状态不再自动变更，仅能手动修改
      onUpdateInvestment(inv.id, {
        returnedPrincipal: newReturnedPrincipal,
        returnedInterest: newReturnedInterest,
        remainingPrincipal: newRemainingPrincipal,
      });
    });

    setSettlementDialogOpen(false);
    setSettlementItems([]);
  };

  // 按项目统计
  const projectProfits = records.map(r => {
    const profit = r.returnedInterest;
    return { ...r, profit };
  });

  // 待收利润（未结清项目）
  const pendingProfit = records
    .filter(r => r.status !== 'settled')
    .reduce((sum, r) => {
      if (r.settlementType === 'lump_sum' && r.endDate) {
        return sum + r.principal * (r.interestRate / 100);
      } else if (r.settlementType === 'continuous') {
        return sum + r.principal * (r.interestRate / 100) * r.settlementFrequency;
      }
      return sum;
    }, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PiggyBank className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">利润统计</h3>
        </div>
        <Button size="sm" variant="outline" onClick={openSettlementDialog}>
          <Calculator className="h-4 w-4 mr-1" />
          月度结算
        </Button>
      </div>

      {/* 顶部统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-green-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">总利润</p>
              <p className="text-2xl font-bold text-green-700">{formatCurrency(profitSummary.totalProfit)}</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-orange-50 border border-red-200 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-100 rounded-lg">
              <CreditCard className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">已还款金额</p>
              <p className="text-2xl font-bold text-red-700">{formatCurrency(profitSummary.totalRepayment)}</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 rounded-lg">
              <PiggyBank className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">净利润</p>
              <p className="text-2xl font-bold text-blue-700">{formatCurrency(profitSummary.netProfit)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 状态分类 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-muted-foreground">结清项目利润</p>
          <p className="text-lg font-bold text-green-600">{formatCurrency(profitSummary.settledProfit)}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-muted-foreground">未结清项目利润</p>
          <p className="text-lg font-bold text-orange-600">{formatCurrency(profitSummary.unsettledProfit)}</p>
        </div>
      </div>

      {/* 按月利润明细 */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
          <h4 className="font-semibold">按月利润明细</h4>
          <span className="text-xs text-muted-foreground">当前待收利润预估：{formatCurrency(pendingProfit)}</span>
        </div>
        <div className="divide-y">
          {monthlyProfits.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">暂无利润数据</div>
          ) : (
            monthlyProfits.map(mp => (
              <div key={mp.month}>
                <button
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  onClick={() => toggleMonth(mp.month)}
                >
                  <div className="flex items-center gap-2">
                    {expandedMonths.has(mp.month) ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-medium">{mp.month} 月</span>
                    <span className="text-xs text-muted-foreground">({mp.items.length}个项目)</span>
                  </div>
                  <span className="font-bold text-green-600">{formatCurrency(mp.totalProfit)}</span>
                </button>
                {expandedMonths.has(mp.month) && (
                  <div className="bg-gray-50 px-4 py-2 space-y-2">
                    {mp.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${item.settlementType === 'lump_sum' ? 'bg-purple-500' : 'bg-blue-500'}`} />
                          <span>{item.projectName}</span>
                          <span className="text-xs text-muted-foreground">
                            {item.settlementType === 'lump_sum' ? '一次性结' : '一直结'}
                          </span>
                        </div>
                        <span className="font-medium">
                          {item.settlementType === 'continuous' && item.times && item.times > 1 && item.perTimeProfit !== undefined
                            ? `${formatCurrency(item.perTimeProfit)} × ${item.times}次 = ${formatCurrency(item.amount)}`
                            : formatCurrency(item.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 按项目利润明细 */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <h4 className="font-semibold">按项目利润明细</h4>
        </div>
        <div className="divide-y">
          {projectProfits.map(p => (
            <div key={p.id} className="px-4 py-3 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="font-medium">{p.name}</span>
                <span className="text-xs text-muted-foreground">(本金 {formatCurrency(p.principal)})</span>
              </div>
              <span className={`font-bold ${p.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(p.profit)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 月度结算弹窗 */}
      <Dialog open={settlementDialogOpen} onOpenChange={setSettlementDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              {nextMonth} 月度结算
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 min-w-0">
            <p className="text-sm text-muted-foreground">
              根据当前时间，次月为 <span className="font-medium text-foreground">{nextMonth}</span>。请勾选下个月需要结清的项目本金和/或利息。
            </p>

            <div className="rounded-lg border overflow-x-auto">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>项目名称</TableHead>
                    <TableHead>结清方式</TableHead>
                    <TableHead className="text-right">剩余本金</TableHead>
                    <TableHead className="text-right">次月应收利息</TableHead>
                    <TableHead className="text-center">结清本金</TableHead>
                    <TableHead className="text-center">结清利息</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settlementItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        暂无未结清项目
                      </TableCell>
                    </TableRow>
                  ) : (
                    settlementItems.map(item => (
                      <TableRow key={item.projectId}>
                        <TableCell className="font-medium">{item.projectName}</TableCell>
                        <TableCell className="text-sm">{getSettlementTypeLabel(item.settlementType)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.remainingPrincipal)}</TableCell>
                        <TableCell className="text-right text-green-600">{formatCurrency(item.nextMonthInterest)}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Checkbox
                              checked={item.settlePrincipal}
                              onCheckedChange={(checked) => {
                                updateSettlementItem(item.projectId, {
                                  settlePrincipal: checked === true,
                                  principalAmount: checked === true ? String(item.remainingPrincipal) : '0',
                                });
                              }}
                            />
                            {item.settlePrincipal && (
                              <Input
                                type="number"
                                step="0.01"
                                className="w-24 h-7 text-xs"
                                value={item.principalAmount}
                                onChange={e => updateSettlementItem(item.projectId, { principalAmount: e.target.value })}
                              />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Checkbox
                              checked={item.settleInterest}
                              onCheckedChange={(checked) => {
                                updateSettlementItem(item.projectId, {
                                  settleInterest: checked === true,
                                  interestAmount: checked === true ? String(item.nextMonthInterest.toFixed(2)) : '0',
                                });
                              }}
                            />
                            {item.settleInterest && (
                              <Input
                                type="number"
                                step="0.01"
                                className="w-24 h-7 text-xs"
                                value={item.interestAmount}
                                onChange={e => updateSettlementItem(item.projectId, { interestAmount: e.target.value })}
                              />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* 结算汇总 */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">结清本金合计</span>
                <span className="font-medium">{formatCurrency(settlementTotals.principal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">结清利息合计</span>
                <span className="font-medium text-green-600">{formatCurrency(settlementTotals.interest)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between">
                <span className="font-medium">{nextMonth} 应结清总额</span>
                <span className="text-xl font-bold text-blue-700">{formatCurrency(settlementTotals.total)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSettlementDialogOpen(false)}>取消</Button>
              <Button onClick={handleConfirmSettlement} disabled={settlementTotals.total <= 0}>
                确认结算
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
