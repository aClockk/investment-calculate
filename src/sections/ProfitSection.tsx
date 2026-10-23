import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, CreditCard, PiggyBank, Calculator, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatCurrency, getSettlementTypeLabel, getSettledPeriodLabel } from '@/lib/utils';
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
  startDate: string;
  frequency: number;
  settledPeriods: number;      // 已结算期数（当前进度）
  perPeriodInterest: number;   // 每期利息 = 本金 × 点数/100
  periodsToSettle: string;     // 一直结：本次结算期数
  lumpSumInterest: number;     // 一次性结：应结利息
  settlePrincipal: boolean;
  principalAmount: string;
  settleInterest: boolean;     // 一次性结专用
  interestAmount: string;      // 一次性结专用
}

export function ProfitSection({ records, profitSummary, monthlyProfits, onUpdateInvestment }: ProfitSectionProps) {
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [settlementDialogOpen, setSettlementDialogOpen] = useState(false);
  const [settlementItems, setSettlementItems] = useState<SettlementItem[]>([]);

  const toggleMonth = (month: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  };

  // 打开结算弹窗：列出所有未结清项目，可提前结算
  const openSettlementDialog = () => {
    const items: SettlementItem[] = records
      .filter(r => r.status === 'unsettled')
      .map(inv => {
        const perPeriodInterest = inv.principal * (inv.interestRate / 100);
        const isLump = inv.settlementType === 'lump_sum';
        return {
          projectId: inv.id,
          projectName: inv.name,
          settlementType: inv.settlementType,
          remainingPrincipal: inv.remainingPrincipal,
          startDate: inv.startDate,
          frequency: inv.settlementFrequency || 1,
          settledPeriods: inv.settledPeriods ?? 0,
          perPeriodInterest,
          periodsToSettle: '0',
          lumpSumInterest: isLump ? perPeriodInterest : 0,
          settlePrincipal: false,
          principalAmount: String(inv.remainingPrincipal),
          settleInterest: false,
          interestAmount: isLump ? perPeriodInterest.toFixed(2) : '0',
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
      if (item.settlementType === 'continuous') {
        const n = Math.max(0, Math.floor(Number(item.periodsToSettle) || 0));
        interest += n * item.perPeriodInterest;
      } else if (item.settleInterest) {
        interest += Number(item.interestAmount) || 0;
      }
    });
    return { principal, interest, total: principal + interest };
  }, [settlementItems]);

  // 确认结算
  const handleConfirmSettlement = () => {
    settlementItems.forEach(item => {
      const inv = records.find(r => r.id === item.projectId);
      if (!inv) return;

      const principalAdd = item.settlePrincipal ? (Number(item.principalAmount) || 0) : 0;
      let interestAdd = 0;
      let periodsAdd = 0;
      if (item.settlementType === 'continuous') {
        periodsAdd = Math.max(0, Math.floor(Number(item.periodsToSettle) || 0));
        interestAdd = periodsAdd * item.perPeriodInterest;
      } else if (item.settleInterest) {
        interestAdd = Number(item.interestAmount) || 0;
      }

      // 无任何结算动作则跳过
      if (principalAdd === 0 && interestAdd === 0 && periodsAdd === 0) return;

      const newReturnedPrincipal = inv.returnedPrincipal + principalAdd;
      const newReturnedInterest = inv.returnedInterest + interestAdd;
      const newRemainingPrincipal = Math.max(0, inv.principal - newReturnedPrincipal);

      // 状态不自动变更，仅能手动修改
      onUpdateInvestment(inv.id, {
        returnedPrincipal: newReturnedPrincipal,
        returnedInterest: newReturnedInterest,
        remainingPrincipal: newRemainingPrincipal,
        ...(item.settlementType === 'continuous'
          ? { settledPeriods: (inv.settledPeriods ?? 0) + periodsAdd }
          : {}),
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
          结算
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

      {/* 结算弹窗 */}
      <Dialog open={settlementDialogOpen} onOpenChange={setSettlementDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              项目结算
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 min-w-0">
            <p className="text-sm text-muted-foreground">
              勾选需要结算的项目，可提前结算。「一直结」选择本次结算期数（每期利息 = 本金 × 点数），并可额外退回本金；「一次性结」可分别结清本金/利息。
            </p>

            {settlementItems.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">暂无未结清项目</div>
            ) : (
              <div className="space-y-3">
                {settlementItems.map(item => {
                  const isContinuous = item.settlementType === 'continuous';
                  const periodsNow = Math.max(0, Math.floor(Number(item.periodsToSettle) || 0));
                  const interestNow = isContinuous
                    ? periodsNow * item.perPeriodInterest
                    : (item.settleInterest ? (Number(item.interestAmount) || 0) : 0);
                  const principalNow = item.settlePrincipal ? (Number(item.principalAmount) || 0) : 0;
                  return (
                    <div key={item.projectId} className="rounded-lg border p-3 space-y-3">
                      {/* 项目头部 */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium truncate">{item.projectName}</span>
                          <span className={`shrink-0 text-xs px-2 py-0.5 rounded border ${isContinuous ? 'text-blue-600 bg-blue-50 border-blue-200' : 'text-purple-600 bg-purple-50 border-purple-200'}`}>
                            {getSettlementTypeLabel(item.settlementType)}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">剩余本金 {formatCurrency(item.remainingPrincipal)}</span>
                      </div>

                      {isContinuous ? (
                        <div className="space-y-2">
                          <div className="text-xs text-muted-foreground">
                            当前进度：<span className="font-medium text-foreground">已结算至 {getSettledPeriodLabel(item.startDate, item.frequency, item.settledPeriods)}</span>
                            <span className="ml-2">每期利息 {formatCurrency(item.perPeriodInterest)}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Label className="text-sm">本次结算期数</Label>
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              className="w-24 h-8"
                              value={item.periodsToSettle}
                              onChange={e => updateSettlementItem(item.projectId, { periodsToSettle: e.target.value })}
                            />
                            {periodsNow > 0 && (
                              <span className="text-xs text-green-600">
                                利息 {formatCurrency(periodsNow * item.perPeriodInterest)} · 结算至 {getSettledPeriodLabel(item.startDate, item.frequency, item.settledPeriods + periodsNow)}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          应结利息：<span className="font-medium text-green-600">{formatCurrency(item.lumpSumInterest)}</span>
                        </div>
                      )}

                      {/* 本金 / 利息 勾选 */}
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={item.settlePrincipal}
                            onCheckedChange={(checked) => {
                              updateSettlementItem(item.projectId, {
                                settlePrincipal: checked === true,
                                principalAmount: checked === true ? String(item.remainingPrincipal) : '0',
                              });
                            }}
                          />
                          <span className="text-sm">{isContinuous ? '退回本金' : '结清本金'}</span>
                          {item.settlePrincipal && (
                            <Input
                              type="number"
                              step="0.01"
                              className="w-28 h-7 text-xs"
                              value={item.principalAmount}
                              onChange={e => updateSettlementItem(item.projectId, { principalAmount: e.target.value })}
                            />
                          )}
                        </div>

                        {!isContinuous && (
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={item.settleInterest}
                              onCheckedChange={(checked) => {
                                updateSettlementItem(item.projectId, {
                                  settleInterest: checked === true,
                                  interestAmount: checked === true ? item.lumpSumInterest.toFixed(2) : '0',
                                });
                              }}
                            />
                            <span className="text-sm">结清利息</span>
                            {item.settleInterest && (
                              <Input
                                type="number"
                                step="0.01"
                                className="w-28 h-7 text-xs"
                                value={item.interestAmount}
                                onChange={e => updateSettlementItem(item.projectId, { interestAmount: e.target.value })}
                              />
                            )}
                          </div>
                        )}
                      </div>

                      {/* 本项小计 */}
                      {(principalNow > 0 || interestNow > 0) && (
                        <div className="text-xs text-muted-foreground border-t pt-2">
                          本项小计：本金 {formatCurrency(principalNow)} + 利息 {formatCurrency(interestNow)} = <span className="font-medium text-foreground">{formatCurrency(principalNow + interestNow)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

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
                <span className="font-medium">应结清总额</span>
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
