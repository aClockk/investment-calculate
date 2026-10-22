import { useEffect, useRef } from 'react';
import { useInvestData } from '@/hooks/useInvestData';
import { CapitalSection } from '@/sections/CapitalSection';
import { InvestmentSection } from '@/sections/InvestmentSection';
import { ProfitSection } from '@/sections/ProfitSection';
import { MonthlyPaymentSection } from '@/sections/MonthlyPaymentSection';
import { BarChart3, Download, Upload, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function App() {
  const {
    capitalRecords,
    repaymentRecords,
    investmentRecords,
    unsettledPool,
    initialized,
    addCapital,
    updateCapital,
    deleteCapital,
    addRepayment,
    deleteRepayment,
    addInvestment,
    updateInvestment,
    deleteInvestment,
    getTotalCapital,
    getTotalLoan,
    getOwnCapital,
    getLoanBalance,
    getProfitSummary,
    getMonthlyProfits,
    getMonthlyPaymentDetails,
    initializeData,
    exportData,
    importData,
    clearAllData,
  } = useInvestData();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `投资数据_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleClear = () => {
    if (window.confirm('确定要清空所有数据吗？此操作不可恢复，请确保已导出备份。')) {
      clearAllData();
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const ok = importData(String(reader.result));
      alert(ok ? '导入成功' : '导入失败：文件格式不正确');
    };
    reader.readAsText(file);
    e.target.value = ''; // 允许重复导入同一文件
  };

  useEffect(() => {
    if (!initialized) {
      initializeData();
    }
  }, [initialized, initializeData]);

  const totalCapital = getTotalCapital();
  const totalLoan = getTotalLoan();
  const ownCapital = getOwnCapital();
  const loanBalance = getLoanBalance();
  const profitSummary = getProfitSummary();
  const monthlyProfits = getMonthlyProfits();
  const monthlyPayments = getMonthlyPaymentDetails();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-bold">投资统计管理系统</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground hidden sm:inline">数据本地存储</span>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" />
                导出
              </Button>
              <Button variant="outline" size="sm" onClick={handleImportClick}>
                <Upload className="h-4 w-4 mr-1" />
                导入
              </Button>
              <Button variant="outline" size="sm" onClick={handleClear} className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4 mr-1" />
                清空
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={handleImportFile}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-10">
        <section>
          <CapitalSection
            records={capitalRecords}
            repaymentRecords={repaymentRecords}
            totalCapital={totalCapital}
            totalLoan={totalLoan}
            ownCapital={ownCapital}
            loanBalance={loanBalance}
            onAddCapital={addCapital}
            onUpdateCapital={updateCapital}
            onDeleteCapital={deleteCapital}
            onAddRepayment={addRepayment}
            onDeleteRepayment={deleteRepayment}
          />
        </section>

        <hr className="border-gray-200" />

        <section>
          <InvestmentSection
            records={investmentRecords}
            unsettledPool={unsettledPool}
            onAdd={addInvestment}
            onUpdate={updateInvestment}
            onDelete={deleteInvestment}
          />
        </section>

        <hr className="border-gray-200" />

        <section>
          <ProfitSection
            records={investmentRecords}
            profitSummary={profitSummary}
            monthlyProfits={monthlyProfits}
            onUpdateInvestment={updateInvestment}
          />
        </section>

        <hr className="border-gray-200" />

        <section>
          <MonthlyPaymentSection payments={monthlyPayments} />
        </section>
      </main>

      <footer className="border-t bg-white mt-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 text-center text-xs text-muted-foreground">
          投资统计管理系统 · 数据保存在本地浏览器中
        </div>
      </footer>
    </div>
  );
}
