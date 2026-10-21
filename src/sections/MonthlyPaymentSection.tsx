import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CalendarDays, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { MonthlyPaymentDetail } from '@/hooks/useInvestData';

interface MonthlyPaymentSectionProps {
  payments: MonthlyPaymentDetail[];
}

export function MonthlyPaymentSection({ payments }: MonthlyPaymentSectionProps) {
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const totalUpcoming = payments.reduce((s, p) => s + p.total, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">每月应还金额</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <p className="text-xs text-muted-foreground mb-1">最近应还月份</p>
          <p className="text-lg font-bold">{payments.length > 0 ? payments[0].month : '-'}</p>
        </div>
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <p className="text-xs text-muted-foreground mb-1">最近应还金额</p>
          <p className="text-lg font-bold text-orange-600">
            {payments.length > 0 ? formatCurrency(payments[0].total) : '-'}
          </p>
        </div>
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <p className="text-xs text-muted-foreground mb-1">未来应还总额</p>
          <p className="text-lg font-bold text-red-600">{formatCurrency(totalUpcoming)}</p>
        </div>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead>月份</TableHead>
              <TableHead className="text-right">应还金额</TableHead>
              <TableHead className="text-right hidden sm:table-cell">笔数</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  暂无待还贷款
                </TableCell>
              </TableRow>
            ) : (
              payments.map(payment => {
                const isExpanded = expandedMonth === payment.month;
                return (
                  <>
                    <TableRow
                      key={payment.month}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => setExpandedMonth(isExpanded ? null : payment.month)}
                    >
                      <TableCell>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{payment.month}</TableCell>
                      <TableCell className="text-right font-bold text-orange-600">
                        {formatCurrency(payment.total)}
                      </TableCell>
                      <TableCell className="text-right hidden sm:table-cell">
                        {payment.items.length} 笔
                      </TableCell>
                    </TableRow>

                    {/* 展开明细 */}
                    {isExpanded && (
                      <TableRow className="bg-gray-50">
                        <TableCell colSpan={4} className="p-0">
                          <div className="p-4">
                            <div className="rounded border bg-white overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-xs">贷款名称</TableHead>
                                    <TableHead className="text-xs">期数</TableHead>
                                    <TableHead className="text-xs text-right">总额</TableHead>
                                    <TableHead className="text-xs text-right">本金</TableHead>
                                    <TableHead className="text-xs text-right">利息</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {payment.items.map((item, idx) => (
                                    <TableRow key={idx}>
                                      <TableCell className="text-sm font-medium">{item.loanName}</TableCell>
                                      <TableCell className="text-sm">{item.note}</TableCell>
                                      <TableCell className="text-sm text-right font-medium">{formatCurrency(item.amount)}</TableCell>
                                      <TableCell className="text-sm text-right">{formatCurrency(item.principal)}</TableCell>
                                      <TableCell className="text-sm text-right text-muted-foreground">{formatCurrency(item.interest)}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
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
    </div>
  );
}
