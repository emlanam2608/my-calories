import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { bangkokCalendarDate } from '@/lib/dashboard-client';
import { getCopy, type Locale } from '@/lib/copy';

export function ExportPanel({ locale }: { locale: Locale }) {
  const c = getCopy(locale);
  const today = bangkokCalendarDate();
  const [from, setFrom] = useState(() =>
    new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10),
  );
  const [to, setTo] = useState(today);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  async function download(format: 'csv' | 'pdf' | 'archive') {
    if (format !== 'archive' && (!from || !to || from > to)) {
      setError(c.feedback.exportDateRange);
      return;
    }
    setExporting(true);
    setError('');
    try {
      const response = await fetch(
        format === 'archive'
          ? '/api/exports/archive'
          : `/api/exports/${format}?start=${encodeURIComponent(from)}&end=${encodeURIComponent(to)}`,
        { cache: 'no-store' },
      );
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error || c.feedback.exportCreateError);
      }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download =
        format === 'archive'
          ? `nourishwell-private-archive-${today}.json`
          : `nourishwell-${from}-to-${to}.${format}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : c.feedback.exportCreateError,
      );
    } finally {
      setExporting(false);
    }
  }
  return (
    <Card className="mt-7 border-none shadow-sm">
      <CardHeader>
        <CardTitle>{c.settings.exportData}</CardTitle>
        <CardDescription>{c.settings.exportDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">
            {c.settings.exportStart}
            <Input
              className="mt-2 bg-white"
              type="date"
              value={from}
              max={to}
              onChange={(event) => setFrom(event.target.value)}
            />
          </label>
          <label className="text-sm font-medium">
            {c.settings.exportEnd}
            <Input
              className="mt-2 bg-white"
              type="date"
              value={to}
              min={from}
              max={today}
              onChange={(event) => setTo(event.target.value)}
            />
          </label>
        </div>
        {error ? (
          <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-900">
            {error}
          </p>
        ) : null}
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <Button
            type="button"
            disabled={exporting}
            onClick={() => void download('csv')}
            className="bg-emerald-800 hover:bg-emerald-900"
          >
            {exporting ? (
              <>
                <LoaderCircle className="animate-spin" /> {c.common.loading}
              </>
            ) : (
              c.settings.exportCsv
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={exporting}
            onClick={() => void download('pdf')}
          >
            {c.settings.exportPdf}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={exporting}
            onClick={() => void download('archive')}
          >
            {c.settings.exportFullArchive}
          </Button>
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">
          {c.settings.exportFullArchiveDescription}
        </p>
      </CardContent>
    </Card>
  );
}
