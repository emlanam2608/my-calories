import { LoaderCircle, Trash2 } from 'lucide-react';
import { type SyntheticEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getCopy, type Locale } from '@/lib/copy';

/** Typed-confirmation boundary for permanent private-data deletion. */
export function AccountDeletionPanel({
  locale,
  onDelete,
}: {
  locale: Locale;
  onDelete: () => Promise<void>;
}) {
  const c = getCopy(locale);
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirmation !== 'DELETE MY DATA') return;
    setDeleting(true);
    setError('');
    try {
      await onDelete();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : c.settings.deleteDataError,
      );
    } finally {
      setDeleting(false);
    }
  }
  return (
    <Card className="mt-7 border-rose-200 bg-rose-50/40 shadow-sm">
      <CardHeader>
        <CardTitle className="text-rose-950">{c.settings.deleteData}</CardTitle>
        <CardDescription>{c.settings.deleteDataDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-sm font-medium text-rose-950">
            {c.settings.deleteDataPrompt}
            <Input
              className="mt-2 border-rose-200 bg-white"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
            />
          </label>
          {error ? (
            <p role="alert" className="rounded-xl bg-rose-100 p-3 text-sm text-rose-950">
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            variant="destructive"
            disabled={deleting || confirmation !== 'DELETE MY DATA'}
          >
            {deleting ? (
              <>
                <LoaderCircle className="animate-spin" />{' '}
                {c.settings.deletingData}
              </>
            ) : (
              <>
                <Trash2 /> {c.settings.deleteData}
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
