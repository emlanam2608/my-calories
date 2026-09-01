'use client';

import { type SyntheticEvent, useState } from 'react';
import { Camera, Check, LoaderCircle, Ruler, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type {
  Measurement,
  MeasurementCreateRequest,
  MeasurementExtractionProposal,
  UploadRecord,
} from '@/lib/contracts';
import { getCopy, type Locale } from '@/lib/copy';
import { createDashboardRequestId } from '@/lib/dashboard-client';
import {
  measurementOptions,
  type ConvertibleMeasurementMetric,
  type MeasurementMetric,
} from '@/lib/dashboard-model';
import {
  canonicalMeasurementUnits,
  measurementUnitOptions,
} from '@/lib/measurement-conversions';

const requestId = createDashboardRequestId;

export function MeasurementsSurface({
  entries,
  onSave,
  onDeleteSourceImage,
  locale,
}: {
  entries: Measurement[];
  onSave: (measurement: MeasurementCreateRequest) => Promise<void>;
  onDeleteSourceImage: (uploadId: string) => Promise<void>;
  locale: Locale;
}) {
  const [metric, setMetric] = useState<MeasurementMetric>('weight');
  const [value, setValue] = useState('');
  const [secondaryValue, setSecondaryValue] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [customUnit, setCustomUnit] = useState('');
  const [measurementUnit, setMeasurementUnit] = useState('kg');
  const [occurredAt, setOccurredAt] = useState(() =>
    new Date().toISOString().slice(0, 16),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [reportUpload, setReportUpload] = useState<UploadRecord | null>(null);
  const [reportProposal, setReportProposal] =
    useState<MeasurementExtractionProposal | null>(null);
  const [extractingReport, setExtractingReport] = useState(false);
  const [reportExtractionUsed, setReportExtractionUsed] = useState(false);
  const [retainReportImage, setRetainReportImage] = useState(false);
  const [deletingSourceUploadId, setDeletingSourceUploadId] = useState<
    string | null
  >(null);
  const option = measurementOptions.find((item) => item.metric === metric)!;
  const isConvertibleMetric = metric !== 'custom_lab';
  const supportedUnits = isConvertibleMetric
    ? measurementUnitOptions[metric as ConvertibleMeasurementMetric]
    : [];
  const c = getCopy(locale);
  const metricLabels: Record<MeasurementMetric, string> = {
    weight: c.measurements.metrics.weight,
    blood_pressure: c.measurements.metrics.bloodPressure,
    blood_glucose: c.measurements.metrics.bloodGlucose,
    total_cholesterol: c.measurements.metrics.totalCholesterol,
    uric_acid: c.measurements.metrics.uricAcid,
    custom_lab: c.measurements.metrics.customLab,
  };
  const recent = entries.slice(0, 12);

  async function extractReport() {
    if (!reportFile) return;
    setExtractingReport(true);
    setError('');
    try {
      const form = new FormData();
      form.set('file', reportFile);
      form.set('kind', 'measurement_report');
      const uploaded = await fetch('/api/uploads', {
        method: 'POST',
        body: form,
      });
      const uploadBody = (await uploaded.json()) as {
        error?: string;
      } & Partial<UploadRecord>;
      if (!uploaded.ok || !uploadBody.id)
        throw new Error(uploadBody.error || c.feedback.reportStoreError);
      setReportUpload(uploadBody as UploadRecord);
      const extracted = await fetch('/api/measurements/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId: uploadBody.id }),
      });
      const extractBody = (await extracted.json()) as {
        error?: string;
        proposal?: MeasurementExtractionProposal;
      };
      if (!extracted.ok || !extractBody.proposal)
        throw new Error(extractBody.error || c.feedback.reportExtractError);
      setReportProposal(extractBody.proposal);
    } catch (reportError) {
      setError(
        reportError instanceof Error
          ? reportError.message
          : c.feedback.reportExtractError,
      );
    } finally {
      setExtractingReport(false);
    }
  }

  function applyReportItem(
    item: MeasurementExtractionProposal['measurements'][number],
  ) {
    if (!item.value || !item.unit) return;
    setReportExtractionUsed(true);
    setRetainReportImage(false);
    setMetric(item.metric as MeasurementMetric);
    setValue(String(item.value));
    setSecondaryValue(item.secondaryValue ? String(item.secondaryValue) : '');
    setCustomLabel(item.label ?? '');
    if (item.metric === 'custom_lab') setCustomUnit(item.unit);
    else setMeasurementUnit(item.unit);
    if (item.occurredAt)
      setOccurredAt(new Date(item.occurredAt).toISOString().slice(0, 16));
  }

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const primary = Number(value);
    const secondary = secondaryValue ? Number(secondaryValue) : undefined;
    const measuredAt = new Date(occurredAt);
    if (
      !Number.isFinite(primary) ||
      primary <= 0 ||
      Number.isNaN(measuredAt.getTime()) ||
      (metric === 'custom_lab' &&
        (!customLabel.trim() || !customUnit.trim())) ||
      (metric === 'blood_pressure' &&
        (!Number.isFinite(secondary) ||
          secondary === undefined ||
          secondary <= 0))
    ) {
      setError(
        metric === 'blood_pressure'
          ? c.feedback.measurementBloodPressureError
          : metric === 'custom_lab'
            ? c.feedback.measurementCustomLabError
            : c.feedback.measurementValueError,
      );
      return;
    }
    setSaving(true);
    try {
      await onSave({
        idempotencyKey: requestId(),
        metric,
        value: primary,
        ...(secondary === undefined ? {} : { secondaryValue: secondary }),
        ...(metric === 'custom_lab' ? { label: customLabel.trim() } : {}),
        unit: metric === 'custom_lab' ? customUnit.trim() : measurementUnit,
        occurredAt: measuredAt.toISOString(),
        source:
          reportExtractionUsed && reportUpload ? 'report_photo' : 'manual',
        ...(reportExtractionUsed && reportUpload
          ? {
              sourceUploadId: reportUpload.id,
              retainSourceImage: retainReportImage,
            }
          : {}),
      });
      if (reportExtractionUsed && reportUpload) {
        setReportUpload(null);
        setReportFile(null);
        setReportProposal(null);
        setReportExtractionUsed(false);
        setRetainReportImage(false);
      }
      setValue('');
      setSecondaryValue('');
      setCustomLabel('');
      setCustomUnit('');
      setOccurredAt(new Date().toISOString().slice(0, 16));
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : c.feedback.measurementSaveError,
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeSourceImage(uploadId: string) {
    setDeletingSourceUploadId(uploadId);
    setError('');
    try {
      await onDeleteSourceImage(uploadId);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : c.feedback.measurementDeleteImageError,
      );
    } finally {
      setDeletingSourceUploadId(null);
    }
  }

  return (
    <section className="mx-auto max-w-3xl">
      <div>
        <p className="text-sm font-medium text-slate-500">
          {c.measurements.eyebrow} · {c.common.confirm}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          {c.measurements.title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          {c.measurements.description}
        </p>
      </div>
      <div className="mt-7 grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>{c.measurements.add}</CardTitle>
            <CardDescription>{c.safety.reviewBeforeSaving}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
              <p className="text-sm font-semibold">
                {c.measurements.reportTitle}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {c.measurements.reportDescription}
              </p>
              <Input
                className="mt-3 bg-white"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={(event) => {
                  setReportFile(event.target.files?.[0] ?? null);
                  setReportProposal(null);
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="mt-3 w-full"
                disabled={!reportFile || extractingReport}
                onClick={() => void extractReport()}
              >
                {extractingReport ? (
                  <>
                    <LoaderCircle className="animate-spin" />{' '}
                    {c.measurements.extractingReport}
                  </>
                ) : (
                  <>
                    <Camera /> {c.measurements.extractReport}
                  </>
                )}
              </Button>
              {reportUpload ? (
                <p className="mt-2 text-xs text-slate-500">
                  {c.measurements.reportStored}
                </p>
              ) : null}
              {reportProposal ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-600">
                    {c.measurements.reportReview}
                  </p>
                  {reportProposal.measurements.map((item, index) => (
                    <Button
                      key={`${item.metric}-${index}`}
                      type="button"
                      variant="outline"
                      className="h-auto w-full justify-start whitespace-normal py-2 text-left"
                      disabled={!item.value || !item.unit}
                      onClick={() => applyReportItem(item)}
                    >
                      {item.metric.replace('_', ' ')} · {item.value ?? '?'}{' '}
                      {item.unit ?? '?'} · {item.confidence}%
                    </Button>
                  ))}
                </div>
              ) : null}
              {reportExtractionUsed && reportUpload ? (
                <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={retainReportImage}
                    onChange={(event) =>
                      setRetainReportImage(event.target.checked)
                    }
                  />
                  <span>
                    <strong>{c.measurements.retainReportTitle}</strong>
                    <br />
                    {c.measurements.retainReportDescription}
                  </span>
                </label>
              ) : null}
            </div>
            <form onSubmit={submit} className="space-y-4">
              <label className="block text-sm font-medium">
                {c.measurements.metric}
                <select
                  value={metric}
                  onChange={(event) => {
                    const nextMetric = event.target.value as MeasurementMetric;
                    setMetric(nextMetric);
                    setValue('');
                    setSecondaryValue('');
                    setMeasurementUnit(
                      nextMetric === 'custom_lab'
                        ? ''
                        : canonicalMeasurementUnits[
                            nextMetric as ConvertibleMeasurementMetric
                          ],
                    );
                  }}
                  className="mt-2 flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                >
                  {measurementOptions.map((item) => (
                    <option key={item.metric} value={item.metric}>
                      {metricLabels[item.metric]}
                    </option>
                  ))}
                </select>
              </label>
              {metric === 'custom_lab' ? (
                <label className="block text-sm font-medium">
                  {c.measurements.customLabel}
                  <Input
                    className="mt-2 bg-white"
                    maxLength={80}
                    placeholder={c.measurements.customLabelPlaceholder}
                    value={customLabel}
                    onChange={(event) => setCustomLabel(event.target.value)}
                    required
                  />
                </label>
              ) : null}
              {metric === 'blood_pressure' ? (
                <div className="grid grid-cols-2 gap-3">
                  <label htmlFor="systolic" className="text-sm font-medium">
                    {c.measurements.systolic}
                    <Input
                      id="systolic"
                      className="mt-2 bg-white"
                      type="number"
                      min="1"
                      step="1"
                      inputMode="decimal"
                      value={value}
                      onChange={(event) => setValue(event.target.value)}
                      required
                    />
                  </label>
                  <label htmlFor="diastolic" className="text-sm font-medium">
                    {c.measurements.diastolic}
                    <Input
                      id="diastolic"
                      className="mt-2 bg-white"
                      type="number"
                      min="1"
                      step="1"
                      inputMode="decimal"
                      value={secondaryValue}
                      onChange={(event) =>
                        setSecondaryValue(event.target.value)
                      }
                      required
                    />
                  </label>
                </div>
              ) : (
                <label className="block text-sm font-medium">
                  {c.measurements.value}
                  <Input
                    className="mt-2 bg-white"
                    type="number"
                    min="0.01"
                    step={option.step}
                    inputMode="decimal"
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    required
                  />
                </label>
              )}
              {metric === 'custom_lab' ? (
                <label className="block text-sm font-medium">
                  {c.measurements.unit}
                  <Input
                    className="mt-2 bg-white"
                    maxLength={16}
                    placeholder={c.measurements.unitPlaceholder}
                    value={customUnit}
                    onChange={(event) => setCustomUnit(event.target.value)}
                    required
                  />
                </label>
              ) : (
                <label className="block text-sm font-medium">
                  {c.measurements.unit}
                  <select
                    value={measurementUnit}
                    onChange={(event) => setMeasurementUnit(event.target.value)}
                    className="mt-2 flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm"
                  >
                    {supportedUnits.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                  <span className="mt-2 block text-xs text-slate-500">
                    Stored as{' '}
                    {
                      canonicalMeasurementUnits[
                        metric as ConvertibleMeasurementMetric
                      ]
                    }
                    {metric === 'blood_pressure'
                      ? ' (systolic / diastolic)'
                      : ''}
                  </span>
                </label>
              )}
              <label className="block text-sm font-medium">
                {c.measurements.measuredAt}
                <Input
                  className="mt-2 bg-white"
                  type="datetime-local"
                  value={occurredAt}
                  onChange={(event) => setOccurredAt(event.target.value)}
                  required
                />
              </label>
              {error ? (
                <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900">
                  {error}
                </p>
              ) : null}
              <Button
                type="submit"
                disabled={saving}
                className="w-full bg-emerald-800 hover:bg-emerald-900"
              >
                {saving ? (
                  <>
                    <LoaderCircle className="animate-spin" /> {c.common.saving}
                  </>
                ) : (
                  <>
                    <Check /> {c.measurements.saveMeasurement}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardDescription>{c.common.private}</CardDescription>
            <CardTitle className="mt-1">{c.nav.measurements}</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length ? (
              <div className="space-y-3">
                {recent.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"
                  >
                    <div className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                      <Ruler className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        {entry.label ??
                          metricLabels[entry.metric as MeasurementMetric] ??
                          entry.metric}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Intl.DateTimeFormat(
                          locale === 'vi' ? 'vi-VN' : 'en-GB',
                          {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                            timeZone: 'Asia/Bangkok',
                          },
                        ).format(new Date(entry.occurredAt))}{' '}
                        · {c.common.confirm}
                      </p>
                    </div>
                    <p className="text-right text-sm font-semibold">
                      {entry.value.toLocaleString()}
                      {entry.secondaryValue === null
                        ? ''
                        : ` / ${entry.secondaryValue.toLocaleString()}`}
                      <span className="mt-0.5 block text-xs font-normal text-slate-500">
                        {entry.unit}
                      </span>
                    </p>
                    {entry.sourceImageRetained && entry.sourceUploadId ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={
                          deletingSourceUploadId === entry.sourceUploadId
                        }
                        onClick={() =>
                          void removeSourceImage(entry.sourceUploadId!)
                        }
                      >
                        {deletingSourceUploadId === entry.sourceUploadId ? (
                          <LoaderCircle className="animate-spin" />
                        ) : (
                          <Trash2 />
                        )}
                        <span className="sr-only">
                          {c.measurements.deleteRetainedReport}
                        </span>
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid min-h-52 place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                <div>
                  <Ruler className="mx-auto size-7 text-emerald-300" />
                  <p className="mt-3 font-semibold text-slate-600">
                    {c.measurements.emptyTitle}
                  </p>
                  <p className="mt-1 text-sm leading-5 text-slate-500">
                    {c.measurements.emptyDescription}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
