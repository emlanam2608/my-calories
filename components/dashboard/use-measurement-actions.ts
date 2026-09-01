import { useCallback } from 'react';
import type { MeasurementCreateRequest } from '@/lib/contracts';
import { getCopy, type Locale } from '@/lib/copy';

type Options = {
  locale: Locale;
  reload: () => Promise<void>;
  setError: (message: string) => void;
  setNotice: (message: string) => void;
};

/** Owns confirmed measurement writes while the dashboard remains the state composition shell. */
export function useMeasurementActions({
  locale,
  reload,
  setError,
  setNotice,
}: Options) {
  const c = getCopy(locale);

  const saveMeasurement = useCallback(
    async (measurement: MeasurementCreateRequest) => {
      setError('');
      setNotice('');
      const response = await fetch('/api/measurements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(measurement),
      });
      const body = (await response.json()) as {
        error?: string;
        replayed?: boolean;
      };
      if (!response.ok)
        throw new Error(body.error || c.feedback.measurementSaveError);
      setNotice(
        body.replayed
          ? c.feedback.measurementReplayed
          : c.feedback.measurementSaved,
      );
      await reload();
    },
    [c.feedback, reload, setError, setNotice],
  );

  const deleteMeasurementSourceImage = useCallback(
    async (uploadId: string) => {
      setError('');
      setNotice('');
      const response = await fetch(`/api/uploads/${uploadId}`, {
        method: 'DELETE',
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok)
        throw new Error(body.error || c.feedback.measurementDeleteImageError);
      setNotice(c.feedback.reportImageDeleted);
      await reload();
    },
    [c.feedback, reload, setError, setNotice],
  );

  return { saveMeasurement, deleteMeasurementSourceImage };
}
