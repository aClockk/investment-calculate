import { useState, useMemo } from 'react';
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
import { Plus, Edit2, Trash2, TrendingUp, Calculator } from 'lucide-react';
import type { InvestmentRecord } from '@/types';
import { formatCurrency, formatDate, getInvestmentStatusLabel, getSettlementTypeLabel, getStatusColorClass } from '@/lib/utils';

interface InvestmentSectionProps {
  records: InvestmentRecord[];
  unsettledPool: number;
  onAdd: (record: Omit<InvestmentRecord, 'id' | 'createdAt'>) => void;
  onUpdate: (id: string, updates: Partial<Omit<InvestmentRecord, 'id' | 'createdAt'>>) => void;
  onDelete: (id: string) => void;
}

export function InvestmentSection({ records, unsettledPool, onAdd, onUpdate, onDelete }: InvestmentSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<InvestmentRecord | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    principal: '',
    interestRate: '',
    settlementFrequency: '1',
    returnedPrincipal: '',
    returnedInterest: '',
    settlementType: 'lump_sum' as 'lump_sum' | 'continuous',
    status: 'unsettled' as InvestmentRecord['status'],
    startDate: '2026-11-01',
    endDate: '2026-11-01',
    remark: '',
  });

  const resetForm = () => {
    setFormData({
      name: '',
      principal: '',
      interestRate: '',
      settlementFrequency: '1',
      returnedPrincipal: '',
      returnedInterest: '',
      settlementType: 'lump_sum',
      status: 'unsettled',
      startDate: '2026-11-01',
      endDate: '2026-11-01',
      remark: '',
    });
    setEditingRecord(null);
  };

  const expectedProfit = useMemo(() => {
    const principal = Number(formData.principal) || 0;
    const rate = Number(formData.interestRate) || 0;
    const freq = Number(formData.settlementFrequency) || 1;
    if (formData.settlementType === 'lump_sum') {
      return principal * (rate / 100);
    }
    return principal * (rate / 100) * freq;
  }, [formData.principal, formData.interestRate, formData.settlementFrequency, formData.settlementType]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const principal = Number(formData.principal) || 0;
    const returnedPrincipal = Number(formData.returnedPrincipal) || 0;
    const returnedInterest = Number(formData.returnedInterest) || 0;
    const remainingPrincipal = principal - returnedPrincipal;

    const data: Omit<InvestmentRecord, 'id' | 'createdAt'> = {
      name: formData.name,
      principal,
      interestRate: Number(formData.interestRate) || 0,
      settlementFrequency: Number(formData.settlementFrequency) || 1,
      returnedPrincipal,
      returnedInterest,
      remainingPrincipal: remainingPrincipal > 0 ? remainingPrincipal : 0,
      settlementType: formData.settlementType,
      status: formData.status,
      startDate: formData.startDate,
      endDate: formData.settlementType === 'lump_sum' ? formData.endDate : undefined,
      remark: formData.remark,
    };

    if (editingRecord) {
      onUpdate(editingRecord.id, data);
    } else {
      onAdd(data);
    }
    setDialogOpen(false);
    resetForm();
  };

  const handleEdit = (record: InvestmentRecord) => {
    setEditingRecord(record);
    setFormData({
      name: record.name,
      principal: String(record.principal),
      interestRate: String(record.interestRate),
      settlementFrequency: String(record.settlementFrequency),
      returnedPrincipal: String(record.returnedPrincipal),
      returnedInterest: String(record.returnedInterest),
      settlementType: record.settlementType,
      status: record.status,
      startDate: record.startDate,
      endDate: record.endDate || '2026-11-01',
      remark: record.remark,
    });
    setDialogOpen(true);
  };

  const stats = {
    totalPrincipal: records.reduce((s, r) => s + r.principal, 0),
    totalReturnedPrincipal: records.reduce((s, r) => s + r.returnedPrincipal, 0),
    totalReturnedInterest: records.reduce((s, r) => s + r.returnedInterest, 0),
  };

  const sortedRecords = [...records].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="space-y-4">
      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <p className="text-xs text-muted-foreground mb-1">总投入本金</p>
          <p className="text-lg font-bold">{formatCurrency(stats.totalPrincipal)}</p>
        </div>
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <p className="text-xs text-muted-foreground mb-1">已收回本金</p>
          <p className="text-lg font-bold text-blue-600">{formatCurrency(stats.totalReturnedPrincipal)}</p>
        </div>
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <p className="text-xs text-muted-foreground mb-1">已收利息(利润)</p>
          <p className="text-lg font-bold text-green-600">{formatCurrency(stats.totalReturnedInterest)}</p>
        </div>
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <p className="text-xs text-muted-foreground mb-1">未结清本金</p>
          <p className="text-lg font-bold text-red-600">{formatCurrency(unsettledPool)}</p>
        </div>
      </div>

      {/* 操作栏 */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">投资分成</h3>
        </div>
        <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" />
          新增投资
        </Button>
      </div>

      {/* 投资表格 */}
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>项目名称</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>结清方式</TableHead>
              <TableHead className="text-right">投入本金</TableHead>
              <TableHead className="text-right">利息点数</TableHead>
              <TableHead className="text-right">已回本金</TableHead>
              <TableHead className="text-right">已收利息</TableHead>
              <TableHead className="hidden sm:table-cell">日期</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRecords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  暂无投资记录
                </TableCell>
              </TableRow>
            ) : (
              sortedRecords.map(record => (
                <TableRow key={record.id}>
                  <TableCell className="font-medium">{record.name}</TableCell>
                  <TableCell>
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${getStatusColorClass(record.status)}`}>
                      {getInvestmentStatusLabel(record.status)}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{getSettlementTypeLabel(record.settlementType)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(record.principal)}</TableCell>
                  <TableCell className="text-right text-purple-600 font-medium">{record.interestRate}%</TableCell>
                  <TableCell className="text-right text-blue-600">{formatCurrency(record.returnedPrincipal)}</TableCell>
                  <TableCell className="text-right text-green-600 font-medium">{formatCurrency(record.returnedInterest)}</TableCell>
                  <TableCell className="text-sm hidden sm:table-cell">
                    {formatDate(record.startDate)}
                    {record.endDate && ` ~ ${formatDate(record.endDate)}`}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(record)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(record.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 新增/编辑投资弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRecord ? '编辑投资' : '新增投资'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>项目名称</Label>
              <Input placeholder="请输入项目名称" value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>结清方式</Label>
                <Select value={formData.settlementType} onValueChange={(v: 'lump_sum' | 'continuous') => {
                  setFormData(prev => ({ ...prev, settlementType: v }));
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lump_sum">一次性结</SelectItem>
                    <SelectItem value="continuous">一直结</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>状态</Label>
                <Select value={formData.status} onValueChange={(v: InvestmentRecord['status']) => setFormData(prev => ({ ...prev, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="settled">结清</SelectItem>
                    <SelectItem value="unsettled">未结清</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>投入本金</Label>
              <Input type="number" step="0.01" placeholder="本金总额" value={formData.principal} onChange={e => setFormData(prev => ({ ...prev, principal: e.target.value }))} required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>利息点数 (%)</Label>
                <Input type="number" step="0.01" placeholder="如：6" value={formData.interestRate} onChange={e => setFormData(prev => ({ ...prev, interestRate: e.target.value }))} required />
              </div>
              {formData.settlementType === 'continuous' && (
                <div className="space-y-2">
                  <Label>每月结算次数</Label>
                  <Input type="number" min="1" placeholder="如：3" value={formData.settlementFrequency} onChange={e => setFormData(prev => ({ ...prev, settlementFrequency: e.target.value }))} required />
                </div>
              )}
            </div>

            {/* 预计利息显示 */}
            {Number(formData.principal) > 0 && Number(formData.interestRate) > 0 && (
              <div className="border rounded-lg p-3 bg-blue-50 flex items-center gap-2">
                <Calculator className="h-4 w-4 text-blue-600" />
                <p className="text-sm text-blue-800">
                  {formData.settlementType === 'lump_sum' ? (
                    <>预计应收利息：<span className="font-bold">{formatCurrency(expectedProfit)}</span></>
                  ) : (
                    <>每月应收利息：<span className="font-bold">{formatCurrency(expectedProfit)}</span>（{formData.settlementFrequency}次/月）</>
                  )}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>已收回本金</Label>
                <Input type="number" step="0.01" placeholder="已回本金" value={formData.returnedPrincipal} onChange={e => setFormData(prev => ({ ...prev, returnedPrincipal: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>已收利息（利润）</Label>
                <Input type="number" step="0.01" placeholder="已收利息" value={formData.returnedInterest} onChange={e => setFormData(prev => ({ ...prev, returnedInterest: e.target.value }))} />
              </div>
            </div>

            <div className="border rounded-lg p-3 bg-gray-50">
              <p className="text-sm text-muted-foreground">
                剩余未回本金：<span className="font-medium text-orange-600">
                  {formatCurrency((Number(formData.principal) || 0) - (Number(formData.returnedPrincipal) || 0))}
                </span>
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>开始日期</Label>
                <Input type="date" value={formData.startDate} onChange={e => setFormData(prev => ({ ...prev, startDate: e.target.value }))} required />
              </div>
              {formData.settlementType === 'lump_sum' && (
                <div className="space-y-2">
                  <Label>结束日期 <span className="text-red-500">*</span></Label>
                  <Input type="date" value={formData.endDate} onChange={e => setFormData(prev => ({ ...prev, endDate: e.target.value }))} required />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>备注</Label>
              <Textarea placeholder="可选填" value={formData.remark} onChange={e => setFormData(prev => ({ ...prev, remark: e.target.value }))} />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
              <Button type="submit">{editingRecord ? '保存' : '添加'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={open => !open && setDeleteId(null)}
        title="确认删除"
        description="删除后无法恢复，是否确认删除该项目？"
        onConfirm={() => { if (deleteId) { onDelete(deleteId); setDeleteId(null); } }}
      />
    </div>
  );
}
