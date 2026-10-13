import { useState, useMemo } from 'react';
import { HistoryEntry, Product } from '@/types';
import { Search, Filter, FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import * as XLSX from 'xlsx';
import autoTable from 'jspdf-autotable';
import {
  createRavinPdf,
  drawRavinHeader,
  drawRavinSectionTitle,
  drawRavinStatStrip,
  ravinPdfColors,
  ravinTableTheme,
} from '@/lib/pdf-theme';

interface HistoryTabProps {
  history: HistoryEntry[];
  products: Product[];
}

const HistoryTab = ({ history }: HistoryTabProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [operationFilter, setOperationFilter] = useState<
    'all' | 'add' | 'take' | 'remove' | 'return'
  >('all');
  const [locationFilter, setLocationFilter] = useState<'all' | 'store' | 'warehouse'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [reportStartDate, setReportStartDate] = useState<string>('');
  const [reportEndDate, setReportEndDate] = useState<string>('');

  const formatOperationLabel = (operation: HistoryEntry['operation']) => {
    if (operation === 'take') return 'بيع';
    if (operation === 'remove') return 'خصم';
    if (operation === 'return') return 'مرتجع';
    return 'إضافة';
  };

  const formatLocationLabel = (location: HistoryEntry['location']) =>
    location === 'warehouse' ? 'المخزن' : 'المحل';

  const getEntryDateTime = (entry: HistoryEntry) =>
    entry.createdAt ? new Date(entry.createdAt) : new Date(`${entry.date}T${entry.time}`);

  const formatEntryDate = (entry: HistoryEntry) =>
    entry.createdAt ? getEntryDateTime(entry).toLocaleDateString('en-CA') : entry.date;

  const formatEntryTime = (entry: HistoryEntry) =>
    entry.createdAt ? getEntryDateTime(entry).toLocaleTimeString('en-GB') : entry.time;

  const filteredHistory = useMemo(() => {
    return history
      .filter((entry) => {
        const matchesSearch =
          searchQuery === '' ||
          entry.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          entry.barcode.toLowerCase().includes(searchQuery.toLowerCase());

        let matchesDate = true;
        if (dateFilter && !endDateFilter) {
          matchesDate = entry.date === dateFilter;
        } else if (dateFilter && endDateFilter) {
          const entryDate = new Date(entry.date);
          const startDate = new Date(dateFilter);
          const endDate = new Date(endDateFilter);
          matchesDate = entryDate >= startDate && entryDate <= endDate;
        }

        const matchesOperation = operationFilter === 'all' || entry.operation === operationFilter;
        const matchesLocation = locationFilter === 'all' || entry.location === locationFilter;

        return matchesSearch && matchesDate && matchesOperation && matchesLocation;
      })
      .sort((a, b) => {
        const dateA = getEntryDateTime(a);
        const dateB = getEntryDateTime(b);
        return dateB.getTime() - dateA.getTime();
      });
  }, [history, searchQuery, dateFilter, endDateFilter, operationFilter, locationFilter]);

  const getReportData = () => {
    if (!reportStartDate && !reportEndDate) return filteredHistory;

    return filteredHistory.filter((entry) => {
      const entryDate = new Date(entry.date);

      if (reportStartDate && reportEndDate) {
        const startDate = new Date(reportStartDate);
        const endDate = new Date(reportEndDate);
        return entryDate >= startDate && entryDate <= endDate;
      } else if (reportStartDate && !reportEndDate) {
        return entry.date === reportStartDate;
      }
      return true;
    });
  };

  const generateExcelReport = () => {
    try {
      const reportData = getReportData().map((entry) => ({
        'اسم المنتج': entry.productName,
        الباركود: entry.barcode,
        المكان: formatLocationLabel(entry.location),
        'نوع الحركة': formatOperationLabel(entry.operation),
        الكمية: entry.quantity,
        التاريخ: formatEntryDate(entry),
        الوقت: formatEntryTime(entry),
      }));

      const worksheet = XLSX.utils.json_to_sheet(reportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'History');

      let filename = 'Ravin_History_Report_';
      if (operationFilter !== 'all') {
        filename += `${operationFilter}_`;
      }
      if (reportStartDate && reportEndDate) {
        filename += `${reportStartDate}_to_${reportEndDate}_`;
      } else if (reportStartDate) {
        filename += `${reportStartDate}_`;
      }
      filename += `${new Date().toISOString().split('T')[0]}.xlsx`;

      XLSX.writeFile(workbook, filename);
    } catch (error) {
      console.error('Error generating Excel report:', error);
      alert('حصلت مشكلة أثناء إنشاء تقرير Excel. حاول تاني.');
    }
  };

  const generatePDFReport = () => {
    try {
      const reportRows = getReportData();
      const doc = createRavinPdf();
      const subtitle =
        operationFilter !== 'all'
          ? `Filtered by ${operationFilter.toUpperCase()}`
          : 'Store movements overview';
      let yPosition = drawRavinHeader(
        doc,
        'Stock Movement History',
        new Date().toLocaleDateString('en-EG'),
        subtitle
      );
      yPosition = drawRavinStatStrip(
        doc,
        [
          { label: 'Entries', value: String(reportRows.length) },
          {
            label: 'Added',
            value: String(reportRows.filter((entry) => entry.operation === 'add').length),
            tone: 'good',
          },
          {
            label: 'Sold',
            value: String(reportRows.filter((entry) => entry.operation === 'take').length),
            tone: 'warn',
          },
          {
            label: 'Removed / Returned',
            value: String(
              reportRows.filter(
                (entry) => entry.operation === 'remove' || entry.operation === 'return'
              ).length
            ),
            tone: 'accent',
          },
        ],
        yPosition
      );
      yPosition = drawRavinSectionTitle(doc, 'Movement Log', yPosition);

      const tableData = reportRows.map((entry) => [
        entry.productName,
        entry.barcode,
        entry.location === 'warehouse' ? 'Warehouse' : 'Store',
        entry.operation.toUpperCase(),
        entry.quantity.toString(),
        formatEntryDate(entry),
        formatEntryTime(entry),
      ]);

      autoTable(doc, {
        ...ravinTableTheme,
        head: [['Product', 'Barcode', 'Location', 'Operation', 'Qty', 'Date', 'Time']],
        body: tableData,
        startY: yPosition,
        didParseCell: function (data) {
          if (data.section === 'body' && data.row.index >= 0) {
            const entry = reportRows[data.row.index];
            if (entry.operation === 'add') {
              data.cell.styles.fillColor = [236, 253, 245];
              data.cell.styles.textColor = [...ravinPdfColors.emerald];
            } else if (entry.operation === 'take') {
              data.cell.styles.fillColor = [255, 247, 237];
              data.cell.styles.textColor = [...ravinPdfColors.amber];
            } else if (entry.operation === 'remove') {
              data.cell.styles.fillColor = [254, 242, 242];
              data.cell.styles.textColor = [...ravinPdfColors.red];
            } else if (entry.operation === 'return') {
              data.cell.styles.fillColor = [239, 246, 255];
              data.cell.styles.textColor = [...ravinPdfColors.blue];
            }
          }
        },
      });

      let filename = 'Ravin_History_Report_';
      if (operationFilter !== 'all') {
        filename += `${operationFilter}_`;
      }
      if (reportStartDate && reportEndDate) {
        filename += `${reportStartDate}_to_${reportEndDate}_`;
      } else if (reportStartDate) {
        filename += `${reportStartDate}_`;
      }
      filename += `${new Date().toISOString().split('T')[0]}.pdf`;

      doc.save(filename);
    } catch (error) {
      console.error('Error generating PDF report:', error);
      alert('حصلت مشكلة أثناء إنشاء تقرير PDF. حاول تاني.');
    }
  };

  const resetDateRange = () => {
    setReportStartDate('');
    setReportEndDate('');
  };

  const clearDateFilters = () => {
    setDateFilter('');
    setEndDateFilter('');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">سجل حركات المحل</h2>
        <div className="flex gap-4">
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant={showFilters ? 'default' : 'outline'}
            className={`flex items-center gap-2 ${
              showFilters
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'border-blue-200 text-blue-700 hover:bg-blue-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            فلاتر
          </Button>
          <Button
            onClick={generateExcelReport}
            variant="outline"
            className="flex items-center gap-2 border-green-200 text-green-700 hover:bg-green-50"
          >
            <FileText className="w-4 h-4" />
            تقرير Excel
          </Button>
          <Button
            onClick={generatePDFReport}
            variant="outline"
            className="flex items-center gap-2 border-red-200 text-red-700 hover:bg-red-50"
          >
            <Download className="w-4 h-4" />
            تقرير PDF
          </Button>
        </div>
      </div>

      <div className="bg-brand-50 p-4 rounded-lg">
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-brand-800">فترة التقرير</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-brand-700 mb-2">
                من تاريخ (لو يوم واحد بس، اختار البداية فقط)
              </label>
              <Input
                type="date"
                value={reportStartDate}
                onChange={(e) => setReportStartDate(e.target.value)}
                className="border-brand-200 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-700 mb-2">
                إلى تاريخ (اختياري - لفترة)
              </label>
              <Input
                type="date"
                value={reportEndDate}
                onChange={(e) => setReportEndDate(e.target.value)}
                disabled={!reportStartDate}
                min={reportStartDate}
                className="border-brand-200 focus:ring-brand-500 focus:border-brand-500 disabled:bg-gray-100"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={resetDateRange}
                variant="outline"
                className="border-brand-200 text-brand-700 hover:bg-brand-100"
              >
                مسح التواريخ
              </Button>
            </div>
          </div>
          {(reportStartDate || reportEndDate) && (
            <div className="mt-4">
              <p className="text-sm text-brand-600">
                التقرير هيشمل {getReportData().length} حركة
                {reportStartDate && reportEndDate ? (
                  <span>
                    {' '}
                    من {reportStartDate} لغاية {reportEndDate}
                  </span>
                ) : reportStartDate ? (
                  <span> ليوم {reportStartDate}</span>
                ) : null}
              </p>
            </div>
          )}
        </div>
      </div>

      {showFilters && (
        <div className="bg-white p-4 rounded-lg shadow space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">بحث</label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="اسم المنتج أو الباركود..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">فلترة بالتاريخ</label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تاريخ النهاية (اختياري)
              </label>
              <input
                type="date"
                value={endDateFilter}
                onChange={(e) => setEndDateFilter(e.target.value)}
                disabled={!dateFilter}
                min={dateFilter}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">المكان</label>
              <select
                value={locationFilter}
                onChange={(e) =>
                  setLocationFilter(e.target.value as 'all' | 'store' | 'warehouse')
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
              >
                <option value="all">كل الأماكن</option>
                <option value="store">حركات المحل</option>
                <option value="warehouse">حركات المخزن</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">نوع الحركة</label>
              <div className="flex flex-col gap-2">
                <select
                  value={operationFilter}
                  onChange={(e) =>
                    setOperationFilter(
                      e.target.value as 'all' | 'add' | 'take' | 'remove' | 'return'
                    )
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                >
                  <option value="all">كل الحركات</option>
                  <option value="add">إضافة فقط</option>
                  <option value="take">بيع فقط</option>
                  <option value="remove">خصم فقط</option>
                  <option value="return">مرتجعات فقط</option>
                </select>
                {(dateFilter || endDateFilter) && (
                  <Button
                    onClick={clearDateFilters}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    مسح التواريخ
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                المنتج
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                الباركود
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                المكان
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                الحركة
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                الكمية
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                التاريخ
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                الوقت
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredHistory.map((entry) => (
              <tr key={entry.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{entry.productName}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900" dir="ltr">
                  {entry.barcode}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      entry.location === 'warehouse'
                        ? 'text-white bg-neutral-800'
                        : 'text-slate-800 bg-slate-100'
                    }`}
                  >
                    {formatLocationLabel(entry.location)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      entry.operation === 'add'
                        ? 'text-green-800 bg-green-100'
                        : entry.operation === 'remove'
                          ? 'text-red-800 bg-red-100'
                          : entry.operation === 'return'
                            ? 'text-blue-800 bg-blue-100'
                            : 'text-orange-800 bg-orange-100'
                    }`}
                  >
                    {formatOperationLabel(entry.operation)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {entry.quantity}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatEntryDate(entry)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatEntryTime(entry)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredHistory.length === 0 && (
          <div className="text-center py-8 text-gray-500">مفيش حركات مطابقة للبحث.</div>
        )}
      </div>
    </div>
  );
};

export default HistoryTab;
