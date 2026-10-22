import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ConfirmDialog } from '@/components/custom/ConfirmDialog';
import { Plus, Edit2, Trash2, ChevronDown, ChevronUp, Landmark, Banknote, Zap } from 'lucide-react';
import type { CapitalRecord, CapitalType, RepaymentRecord, RepaymentType } from '@/types';
import { formatCurrency, formatDate, getRepaymentTypeLabel } from '@/lib/utils';

interface CapitalSectionProps {
  records: CapitalRecord[];
  repaymentRecords: RepaymentRecord[];
  totalCapital: number;
  totalLoan: number;
  ownCapital: number;
  loanBalance: number;
  onAddCapital: (record: Omit<CapitalRecord, 'id' | 'createdAt'>) => void;
  onUpdateCapital: (id: string, updates: Partial<Omit<CapitalRecord, 'id' | 'createdAt'>>) => void;
  onDeleteCapital: (id: string) => void;
  onAddRepayment: (record: Omit<RepaymentRecord, 'id' | 'createdAt'>) => void;
  onDeleteRepayment: (id: string) => void;
}

export function CapitalSection({
  records,
  repaymentRecords,
  totalCapital,
  totalLoan,
  ownCapital,
  loanBalance,
  onAddCapital,
  onUpdateCapital,
  onDeleteCapital,
  onAddRepayment,
  onDeleteRepayment,
}: CapitalSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CapitalRecord | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null);
  const [repaymentDialog, setRepaymentDialog] = useState<{ open: boolean; loanId: string; isExtra: boolean }>({ open: false, loanId: '', isExtra: false });

  const [formData, setFormData] = useState({
    type: 'own' as CapitalType,
    name: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    remark: '',
    repaymentType: 'equal_interest' as RepaymentType,
    totalPeriods: '',
    monthlyPayment: '',
    monthlyRate: '',
    loanStartDate: '',
    loanEndDate: '',
  });

  const [repaymentForm, setRepaymentForm] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    principal: '',
    interest: '',
    period: '',
    remark: '',
  });

  const resetForm = () => {
    setFormData({
      type: 'own',
      name: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      remark: '',
      repaymentType: 'equal_interest',
      totalPeriods: '',
      monthlyPayment: '',
      monthlyRate: '',
      loanStartDate: '',
      loanEndDate: '',
    });
    setEditingRecord(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: Omit<CapitalRecord, 'id' | 'createdAt'> = {
      type: formData.type,
      name: formData.name,
      amount: Number(formData.amount) || 0,
      date: formData.date,
      remark: formData.remark,
    };

    if (formData.type === 'loan') {
      data.loanDetails = {
        lender: formData.name,
        repaymentType: formData.repaymentType,
        totalPeriods: Number(formData.totalPeriods) || 0,
        monthlyPayment: Number(formData.monthlyPayment) || 0,
        monthlyRate: Number(formData.monthlyRate) || 0,
        annualRate: (Number(formData.monthlyRate) || 0) * 12,
        startDate: formData.loanStartDate,
        endDate: formData.loanEndDate,
      };
    }

    if (editingRecord) {
      onUpdateCapital(editingRecord.id, data);
    } else {
      onAddCapital(data);
    }
    setDialogOpen(false);
    resetForm();
  };

  const handleEdit = (record: CapitalRecord) => {
    setEditingRecord(record);
    setFormData({
      type: record.type,
      name: record.name,
      amount: String(record.amount),
      date: record.date,
      remark: record.remark,
      repaymentType: record.loanDetails?.repaymentType || 'equal_interest',
      totalPeriods: String(record.loanDetails?.totalPeriods || ''),
      monthlyPayment: String(record.loanDetails?.monthlyPayment || ''),
      monthlyRate: String(record.loanDetails?.monthlyRate || ''),
      loanStartDate: record.loanDetails?.startDate || '',
      loanEndDate: record.loanDetails?.endDate || '',
    });
    setDialogOpen(true);
  };

  const handleAddRepayment = (e: React.FormEvent) => {
    e.preventDefault();
    onAddRepayment({
      loanId: repaymentDialog.loanId,
      date: repaymentForm.date,
      amount: Number(repaymentForm.amount) || 0,
      principal: Number(repaymentForm.principal) || 0,
      interest: Number(repaymentForm.interest) || 0,
      period: Number(repaymentForm.period) || 0,
      isExtra: repaymentDialog.isExtra,
      remark: repaymentForm.remark,
    });
    setRepaymentForm({ date: new Date().toISOString().split('T')[0], amount: '', principal: '', interest: '', period: '', remark: '' });
    setRepaymentDialog({ open: false, loanId: '', isExtra: false });
  };

  const getLoanRepayments = (loanId: string) => {
    return repaymentRecords.filter(r => r.loanId === loanId).sort((a, b) => a.period - b.period);
  };

  const sortedRecords = [...records].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="space-y-4">
      {/* 总本金统计 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-5 text-white shadow-lg">
          <p className="text-blue-100 text-sm mb-1">总本金</p>
          <p className="text-xl font-bold">{formatCurrency(totalCapital)}</p>
          <p className="text-xs text-blue-100 mt-1">项目投入总额</p>
        </div>
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <p className="text-muted-foreground text-sm mb-1">贷款总额</p>
          <p className="text-xl font-bold text-orange-600">{formatCurrency(totalLoan)}</p>
          <p className="text-xs text-muted-foreground mt-1">借入资金</p>
        </div>
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <p className="text-muted-foreground text-sm mb-1">自有本金</p>
          <p className="text-xl font-bold text-green-600">{formatCurrency(ownCapital)}</p>
          <p className="text-xs text-muted-foreground mt-1">初始基数 + 利润 - 还款</p>
        </div>
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <p className="text-muted-foreground text-sm mb-1">贷款剩余应还</p>
          <p className="text-xl font-bold text-red-600">{formatCurrency(loanBalance)}</p>
          <p className="text-xs text-muted-foreground mt-1">未还本金</p>
        </div>
      </div>

      {/* 操作栏 */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">资金明细</h3>
        <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" />
          新增资金
        </Button>
      </div>

      {/* 资金表格 */}
      <div className="rounded-lg border overflow-x-auto">
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead>名称</TableHead>
              <TableHead>类型</TableHead>
              <TableHead className="text-right">金额</TableHead>
              <TableHead>日期</TableHead>
              <TableHead>贷款方式</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRecords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  暂无资金记录
                </TableCell>
              </TableRow>
            ) : (
              sortedRecords.map(record => {
                const isExpanded = expandedLoanId === record.id;
                const loanRepayments = record.type === 'loan' ? getLoanRepayments(record.id) : [];
                const totalRepaid = loanRepayments.reduce((s, r) => s + r.amount, 0);
                const totalRepaidPrincipal = loanRepayments.reduce((s, r) => s + r.principal, 0);
                const remaining = record.amount - totalRepaidPrincipal;

                return (
                  <>
                    <TableRow key={record.id} className={record.type === 'loan' ? 'cursor-pointer hover:bg-gray-50' : ''} onClick={() => {
                      if (record.type === 'loan') setExpandedLoanId(isExpanded ? null : record.id);
                    }}>
                      <TableCell>
                        {record.type === 'loan' && (
                          isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                        {record.type === 'own' && <Banknote className="h-4 w-4 text-green-600" />}
                      </TableCell>
                      <TableCell className="font-medium">{record.name}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                          record.type === 'loan' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {record.type === 'loan' ? <Landmark className="h-3 w-3" /> : <Banknote className="h-3 w-3" />}
                          {record.type === 'loan' ? '贷款' : '自有'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(record.amount)}</TableCell>
                      <TableCell>{formatDate(record.date)}</TableCell>
                      <TableCell>
                        {record.type === 'loan' && record.loanDetails
                          ? getRepaymentTypeLabel(record.loanDetails.repaymentType)
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(record)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(record.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* 贷款展开详情 */}
                    {record.type === 'loan' && isExpanded && (
                      <TableRow className="bg-gray-50">
                        <TableCell colSpan={7} className="p-0">
                          <div className="p-4 space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <p className="text-muted-foreground">还款方式</p>
                                <p className="font-medium">{record.loanDetails ? getRepaymentTypeLabel(record.loanDetails.repaymentType) : '-'}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">总期数</p>
                                <p className="font-medium">{record.loanDetails?.totalPeriods || '-'} 期</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">月利率</p>
                                <p className="font-medium">{(record.loanDetails?.monthlyRate || 0) * 100}%</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">年利率</p>
                                <p className="font-medium">{(record.loanDetails?.annualRate || 0) * 100}%</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <p className="text-muted-foreground">已还总额</p>
                                <p className="font-medium text-green-600">{formatCurrency(totalRepaid)}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">已还本金</p>
                                <p className="font-medium">{formatCurrency(totalRepaidPrincipal)}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">剩余本金</p>
                                <p className="font-medium text-orange-600">{formatCurrency(remaining)}</p>
                              </div>
                            </div>

                            {/* 还款记录 */}
                            <div>
                              <div className="flex justify-between items-center mb-2">
                                <p className="font-medium text-sm">还款记录</p>
                                <div className="flex gap-2">
                                  <Button size="sm" variant="outline" onClick={() => setRepaymentDialog({ open: true, loanId: record.id, isExtra: true })}>
                                    <Zap className="h-3 w-3 mr-1" />
                                    提前还款
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => setRepaymentDialog({ open: true, loanId: record.id, isExtra: false })}>
                                    <Plus className="h-3 w-3 mr-1" />
                                    记还款
                                  </Button>
                                </div>
                              </div>
                              {loanRepayments.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-2">暂无还款记录</p>
                              ) : (
                                <div className="rounded border bg-white overflow-x-auto">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="text-xs">期数</TableHead>
                                        <TableHead className="text-xs">日期</TableHead>
                                        <TableHead className="text-xs text-right">总额</TableHead>
                                        <TableHead className="text-xs text-right">本金</TableHead>
                                        <TableHead className="text-xs text-right">利息</TableHead>
                                        <TableHead className="text-xs hidden sm:table-cell">备注</TableHead>
                                        <TableHead className="text-xs text-right">操作</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {loanRepayments.map(rp => (
                                        <TableRow key={rp.id}>
                                          <TableCell className="text-sm">
                                            {rp.isExtra ? (
                                              <span className="text-orange-600 font-medium">提前还</span>
                                            ) : (
                                              `第 ${rp.period} 期`
                                            )}
                                          </TableCell>
                                          <TableCell className="text-sm">{formatDate(rp.date)}</TableCell>
                                          <TableCell className="text-sm text-right font-medium">{formatCurrency(rp.amount)}</TableCell>
                                          <TableCell className="text-sm text-right">{formatCurrency(rp.principal)}</TableCell>
                                          <TableCell className="text-sm text-right text-muted-foreground">{formatCurrency(rp.interest)}</TableCell>
                                          <TableCell className="text-sm hidden sm:table-cell">{rp.remark || '-'}</TableCell>
                                          <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDeleteRepayment(rp.id)}>
                                              <Trash2 className="h-3 w-3" />
                                            </Button>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* 新增/编辑资金弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRecord ? '编辑资金' : '新增资金'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>类型</Label>
              <Select value={formData.type} onValueChange={(v: CapitalType) => setFormData(prev => ({ ...prev, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="own">自有资金</SelectItem>
                  <SelectItem value="loan">贷款</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>名称</Label>
              <Input placeholder="如：小鱼、杜小满" value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>金额</Label>
              <Input type="number" step="0.01" placeholder="请输入金额" value={formData.amount} onChange={e => setFormData(prev => ({ ...prev, amount: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>日期</Label>
              <Input type="date" value={formData.date} onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))} required />
            </div>

            {formData.type === 'loan' && (
              <div className="space-y-4 border rounded-lg p-4 bg-gray-50">
                <p className="font-medium text-sm">贷款详情</p>
                <div className="space-y-2">
                  <Label>贷款方式</Label>
                  <Select value={formData.repaymentType} onValueChange={(v: RepaymentType) => setFormData(prev => ({ ...prev, repaymentType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equal_interest">等额本息</SelectItem>
                      <SelectItem value="equal_principal">等额本金</SelectItem>
                      <SelectItem value="interest_first">先息后本</SelectItem>
                      <SelectItem value="lump_sum">一次结清</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>总期数</Label>
                    <Input type="number" placeholder="期数" value={formData.totalPeriods} onChange={e => setFormData(prev => ({ ...prev, totalPeriods: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>每期还款额</Label>
                    <Input type="number" step="0.01" placeholder="金额" value={formData.monthlyPayment} onChange={e => setFormData(prev => ({ ...prev, monthlyPayment: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>月利率(%)</Label>
                    <Input type="number" step="0.0001" placeholder="如：0.5" value={formData.monthlyRate} onChange={e => setFormData(prev => ({ ...prev, monthlyRate: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>年利率(%)</Label>
                    <Input type="number" step="0.01" placeholder="自动计算" value={formData.monthlyRate ? (Number(formData.monthlyRate) * 12).toFixed(2) : ''} readOnly className="bg-gray-100" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>开始日期</Label>
                    <Input type="date" value={formData.loanStartDate} onChange={e => setFormData(prev => ({ ...prev, loanStartDate: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>结束日期</Label>
                    <Input type="date" value={formData.loanEndDate} onChange={e => setFormData(prev => ({ ...prev, loanEndDate: e.target.value }))} />
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
              <Button type="submit">{editingRecord ? '保存' : '添加'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 还款弹窗 */}
      <Dialog open={repaymentDialog.open} onOpenChange={open => setRepaymentDialog({ open, loanId: '', isExtra: false })}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{repaymentDialog.isExtra ? '提前还款' : '记录还款'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddRepayment} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>期数</Label>
                <Input type="number" placeholder="第几期" value={repaymentForm.period} onChange={e => setRepaymentForm(prev => ({ ...prev, period: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>还款日期</Label>
                <Input type="date" value={repaymentForm.date} onChange={e => setRepaymentForm(prev => ({ ...prev, date: e.target.value }))} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>还款总额</Label>
              <Input type="number" step="0.01" placeholder="总金额" value={repaymentForm.amount} onChange={e => setRepaymentForm(prev => ({ ...prev, amount: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>本金部分</Label>
                <Input type="number" step="0.01" placeholder="本金" value={repaymentForm.principal} onChange={e => setRepaymentForm(prev => ({ ...prev, principal: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>利息部分</Label>
                <Input type="number" step="0.01" placeholder="利息" value={repaymentForm.interest} onChange={e => setRepaymentForm(prev => ({ ...prev, interest: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>备注</Label>
              <Textarea placeholder="可选填" value={repaymentForm.remark} onChange={e => setRepaymentForm(prev => ({ ...prev, remark: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setRepaymentDialog({ open: false, loanId: '', isExtra: false })}>取消</Button>
              <Button type="submit">添加</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={open => !open && setDeleteId(null)}
        title="确认删除"
        description="删除后无法恢复，是否确认删除该记录？"
        onConfirm={() => { if (deleteId) { onDeleteCapital(deleteId); setDeleteId(null); } }}
      />
    </div>
  );
}
