import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Optional slot for page-level actions (rare; most pages own their own toolbars). */
  actions?: ReactNode;
}

// Latin-digit Arabic date (e.g. "الجمعة، 10 يوليو 2026") — matches the currency
// formatting elsewhere in the app so digits read consistently.
const formatArabicDate = (date: Date) =>
  new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);

const PageHeader = ({ title, subtitle, actions }: PageHeaderProps) => {
  const today = formatArabicDate(new Date());

  return (
    <header className="mb-6 border-b border-gray-200 pb-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-[1.75rem]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {actions}
          <div className="hidden text-left text-xs text-gray-500 sm:block">
            <div className="font-medium text-gray-700">{today}</div>
            <div className="mt-0.5">التاريخ النهارده</div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default PageHeader;
