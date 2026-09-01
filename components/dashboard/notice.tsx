import { CircleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DashboardNotice({
  tone,
  text,
  action,
}: {
  tone: 'success' | 'error';
  text: string;
  action?: { label: string; onClick: () => void; disabled?: boolean };
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className={`mb-5 flex flex-wrap items-center gap-2 rounded-xl border p-3 text-sm ${tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-950' : 'border-rose-200 bg-rose-50 text-rose-950'}`}
    >
      <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">{text}</span>
      {action ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={action.disabled}
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
