'use client';

import {
  type ReactNode,
  type SyntheticEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Camera,
  Check,
  ClipboardCheck,
  LoaderCircle,
  Plus,
  ScanLine,
  Trash2,
  Utensils,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type {
  FoodAnalysis,
  FoodExtractionProposal,
  UploadRecord,
} from '@/lib/contracts';
import { getCopy } from '@/lib/copy';
import {
  dashboardTargets,
  type DashboardTargetKey,
} from '@/lib/dashboard-model';
import type { CaptureSurfaceProps } from './capture-contract';

export function CaptureSurface(props: CaptureSurfaceProps) {
  const {
    captureMode,
    setCaptureMode,
    vietnamCatalog,
    setVietnamCatalog,
    draft,
    setDraft,
    analysis,
    analysing,
    saving,
    savingPersonalFood,
    onAnalyse,
    onNutrientChange,
    onReviewDetailsChange,
    onDiscard,
    onConfirm,
    onSavePersonalFood,
    savedFoods,
    onUseSavedFood,
    onDeleteSavedFood,
    deletingSavedFoodId,
    locale,
  } = props;
  const c = getCopy(locale);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoKind, setPhotoKind] = useState<'meal_photo' | 'nutrition_label'>(
    'meal_photo',
  );
  const [uploadedPhoto, setUploadedPhoto] = useState<UploadRecord | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [extractingPhoto, setExtractingPhoto] = useState(false);
  const [extractionProposal, setExtractionProposal] =
    useState<FoodExtractionProposal | null>(null);
  const [photoExtractionUsed, setPhotoExtractionUsed] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!scannerOpen) return;
    let stream: MediaStream | null = null;
    let timer: number | null = null;
    let detecting = false;
    let cancelled = false;
    const Detector = (
      window as Window & {
        BarcodeDetector?: new (options?: { formats?: string[] }) => {
          detect: (
            source: HTMLVideoElement,
          ) => Promise<Array<{ rawValue?: string }>>;
        };
      }
    ).BarcodeDetector;
    async function start() {
      if (!Detector) {
        setScannerError(c.mealCapture.scannerUnavailable);
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        const video = videoRef.current;
        if (!video || cancelled) return;
        video.srcObject = stream;
        await video.play();
        const detector = new Detector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'],
        });
        timer = window.setInterval(() => {
          if (detecting || !video.readyState) return;
          detecting = true;
          void detector
            .detect(video)
            .then((codes) => {
              const barcode = codes[0]?.rawValue?.replace(/\D/g, '');
              if (barcode && /^\d{8,14}$/.test(barcode)) {
                setDraft(barcode);
                setScannerOpen(false);
              }
            })
            .catch(() => undefined)
            .finally(() => {
              detecting = false;
            });
        }, 650);
      } catch {
        setScannerError(c.mealCapture.scannerPermissionError);
      }
    }
    void start();
    return () => {
      cancelled = true;
      if (timer !== null) window.clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [
    c.mealCapture.scannerPermissionError,
    c.mealCapture.scannerUnavailable,
    scannerOpen,
    setDraft,
  ]);

  const isValid =
    captureMode === 'barcode'
      ? /^\d{8,14}$/.test(draft.trim())
      : captureMode === 'vietnam_database' || captureMode === 'usda'
        ? draft.trim().length >= 2
        : captureMode === 'photo'
          ? Boolean(photoFile)
          : draft.trim().length >= 3;
  const providerNote =
    captureMode === 'text'
      ? c.mealCapture.typedProviderNote
      : captureMode === 'barcode'
        ? c.mealCapture.barcodeProviderNote
        : captureMode === 'vietnam_database'
          ? c.mealCapture.vietnamProviderNote
          : captureMode === 'photo'
            ? c.mealCapture.photoProviderNote
            : c.mealCapture.usdaProviderNote;

  async function uploadPhoto(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!photoFile) return;
    setUploadingPhoto(true);
    setPhotoError('');
    try {
      const form = new FormData();
      form.set('file', photoFile);
      form.set('kind', photoKind);
      const response = await fetch('/api/uploads', {
        method: 'POST',
        body: form,
      });
      const body = (await response.json()) as {
        error?: string;
      } & Partial<UploadRecord>;
      if (!response.ok || !body.id || !body.expiresAt)
        throw new Error(body.error || c.feedback.photoStoreError);
      setUploadedPhoto(body as UploadRecord);
      setExtractionProposal(null);
      setPhotoExtractionUsed(false);
    } catch (error) {
      setPhotoError(
        error instanceof Error ? error.message : c.feedback.photoStoreError,
      );
    } finally {
      setUploadingPhoto(false);
    }
  }
  async function removeUploadedPhoto() {
    if (!uploadedPhoto) return;
    setPhotoError('');
    const response = await fetch(`/api/uploads/${uploadedPhoto.id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      setPhotoError(c.feedback.photoDeleteError);
      return;
    }
    setUploadedPhoto(null);
    setPhotoFile(null);
    setExtractionProposal(null);
    setPhotoExtractionUsed(false);
  }
  async function extractUploadedPhoto() {
    if (!uploadedPhoto) return;
    setExtractingPhoto(true);
    setPhotoError('');
    try {
      const response = await fetch('/api/meals/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId: uploadedPhoto.id }),
      });
      const body = (await response.json()) as {
        error?: string;
        proposal?: FoodExtractionProposal;
      };
      if (!response.ok || !body.proposal)
        throw new Error(body.error || c.feedback.photoExtractError);
      setExtractionProposal(body.proposal);
    } catch (error) {
      setPhotoError(
        error instanceof Error ? error.message : c.feedback.photoExtractError,
      );
    } finally {
      setExtractingPhoto(false);
    }
  }
  function selectExtractedFood(name: string) {
    setPhotoExtractionUsed(true);
    setDraft(name);
    setCaptureMode('text');
  }
  async function confirmMealAndRemoveSource() {
    const saved = await onConfirm();
    if (saved && photoExtractionUsed && uploadedPhoto)
      await removeUploadedPhoto();
    return saved;
  }
  function chooseMode(mode: CaptureSurfaceProps['captureMode']) {
    setCaptureMode(mode);
    setDraft('');
  }

  return (
    <section>
      <div>
        <p className="text-sm font-medium text-slate-500">
          {c.mealCapture.eyebrow}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          {c.mealCapture.title}
        </h1>
      </div>
      <div className="mt-7 grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>{c.mealCapture.title}</CardTitle>
            <CardDescription>{c.mealCapture.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 sm:grid-cols-5">
              <ModeButton
                active={captureMode === 'text'}
                onClick={() => chooseMode('text')}
              >
                {c.mealCapture.text}
              </ModeButton>
              <ModeButton
                active={captureMode === 'barcode'}
                onClick={() => chooseMode('barcode')}
              >
                <ScanLine /> {c.mealCapture.barcode}
              </ModeButton>
              <ModeButton
                active={captureMode === 'vietnam_database'}
                onClick={() => chooseMode('vietnam_database')}
              >
                {c.mealCapture.vietnamData}
              </ModeButton>
              <ModeButton
                active={captureMode === 'usda'}
                onClick={() => chooseMode('usda')}
              >
                USDA
              </ModeButton>
              <ModeButton
                active={captureMode === 'photo'}
                onClick={() => chooseMode('photo')}
              >
                <Camera /> {c.mealCapture.photo}
              </ModeButton>
            </div>
            <form
              onSubmit={captureMode === 'photo' ? uploadPhoto : onAnalyse}
              className="mt-5"
            >
              {captureMode === 'text' ? (
                <Textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={c.mealCapture.mealPlaceholder}
                  className="min-h-40"
                />
              ) : null}
              {captureMode === 'barcode' ? (
                <div className="space-y-3">
                  <Input
                    inputMode="numeric"
                    value={draft}
                    onChange={(event) =>
                      setDraft(event.target.value.replace(/\D/g, ''))
                    }
                    placeholder={c.mealCapture.barcodePlaceholder}
                    aria-label={c.mealCapture.barcode}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setScannerError('');
                      setScannerOpen((value) => !value);
                    }}
                  >
                    <ScanLine />{' '}
                    {scannerOpen
                      ? c.mealCapture.stopScanner
                      : c.mealCapture.startScanner}
                  </Button>
                  {scannerOpen ? (
                    <div className="overflow-hidden rounded-xl border bg-slate-950 p-1">
                      <video
                        ref={videoRef}
                        muted
                        playsInline
                        className="aspect-video w-full rounded-lg object-cover"
                      />
                      <p className="p-2 text-center text-xs text-white">
                        {c.mealCapture.scannerHelp}
                      </p>
                    </div>
                  ) : null}
                  {scannerError ? (
                    <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
                      {scannerError}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {captureMode === 'vietnam_database' ? (
                <>
                  <div className="mb-3 grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        vietnamCatalog === 'dish' ? 'secondary' : 'outline'
                      }
                      onClick={() => setVietnamCatalog('dish')}
                    >
                      {c.mealCapture.vietnamDish}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        vietnamCatalog === 'ingredient'
                          ? 'secondary'
                          : 'outline'
                      }
                      onClick={() => setVietnamCatalog('ingredient')}
                    >
                      {c.mealCapture.vietnamIngredient}
                    </Button>
                  </div>
                  <Input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={
                      vietnamCatalog === 'dish'
                        ? c.mealCapture.vietnamDishPlaceholder
                        : c.mealCapture.vietnamIngredientPlaceholder
                    }
                    aria-label={c.mealCapture.vietnamSearchLabel}
                  />
                </>
              ) : null}
              {captureMode === 'usda' ? (
                <Input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={c.mealCapture.usdaPlaceholder}
                  aria-label={c.mealCapture.usdaSearchLabel}
                />
              ) : null}
              {captureMode === 'photo' ? (
                <div className="space-y-3">
                  <label className="block text-sm font-medium">
                    {c.mealCapture.photoType}
                    <select
                      value={photoKind}
                      onChange={(event) =>
                        setPhotoKind(event.target.value as typeof photoKind)
                      }
                      className="mt-2 flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
                    >
                      <option value="meal_photo">
                        {c.mealCapture.mealPhoto}
                      </option>
                      <option value="nutrition_label">
                        {c.mealCapture.labelPhoto}
                      </option>
                    </select>
                  </label>
                  <label className="block text-sm font-medium">
                    {c.mealCapture.selectPhoto}
                    <Input
                      className="mt-2 bg-white"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      capture="environment"
                      onChange={(event) =>
                        setPhotoFile(event.target.files?.[0] ?? null)
                      }
                    />
                  </label>
                  {uploadedPhoto ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
                      <p className="font-semibold">
                        {c.mealCapture.photoStored}
                      </p>
                      <p className="mt-1">
                        {c.mealCapture.photoExtractionPending}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void extractUploadedPhoto()}
                          disabled={extractingPhoto}
                        >
                          {extractingPhoto ? (
                            <LoaderCircle className="animate-spin" />
                          ) : (
                            <Camera />
                          )}{' '}
                          {extractingPhoto
                            ? c.mealCapture.extractingPhoto
                            : c.mealCapture.extractPhoto}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void removeUploadedPhoto()}
                        >
                          <Trash2 /> {c.mealCapture.deletePhoto}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  {photoError ? (
                    <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900">
                      {photoError}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <p className="mt-3 text-xs leading-5 text-slate-500">
                {providerNote}
              </p>
              <Button
                type="submit"
                disabled={
                  captureMode === 'photo'
                    ? uploadingPhoto || !isValid || Boolean(uploadedPhoto)
                    : analysing || !isValid
                }
                className="mt-5 w-full bg-emerald-800 hover:bg-emerald-900"
              >
                {captureMode === 'photo' ? (
                  uploadingPhoto ? (
                    <>
                      <LoaderCircle className="animate-spin" />{' '}
                      {c.mealCapture.uploadingPhoto}
                    </>
                  ) : (
                    <>
                      <Camera /> {c.mealCapture.storePhoto}
                    </>
                  )
                ) : analysing ? (
                  <>
                    <LoaderCircle className="animate-spin" />{' '}
                    {c.mealCapture.analysing}
                  </>
                ) : (
                  <>
                    <ClipboardCheck /> {c.mealCapture.analyse}
                  </>
                )}
              </Button>
            </form>
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="text-sm font-semibold">
                {c.mealCapture.libraryTitle}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {c.mealCapture.libraryDescription}
              </p>
              {savedFoods.length ? (
                <div className="mt-3 space-y-2">
                  {savedFoods.slice(0, 6).map((food) => (
                    <div key={food.id} className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-auto min-w-0 flex-1 justify-between whitespace-normal py-2 text-left"
                        onClick={() => onUseSavedFood(food)}
                      >
                        <span>
                          <span className="block font-medium">
                            {locale === 'vi' ? food.nameVi : food.name}
                          </span>
                          <span className="block text-xs text-slate-500">
                            {food.kind === 'recipe'
                              ? c.mealCapture.recipe
                              : c.mealCapture.food}{' '}
                            ·{' '}
                            {Math.round(food.nutritionSnapshot.totals.calories)}{' '}
                            kcal
                          </span>
                        </span>
                        <Plus />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="text-rose-700"
                        disabled={deletingSavedFoodId === food.id}
                        aria-label={c.mealCapture.deleteSavedFood}
                        onClick={() => {
                          if (window.confirm(c.mealCapture.deleteSavedConfirm))
                            void onDeleteSavedFood(food);
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">
                  {c.mealCapture.libraryEmpty}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardHeader>
            <div>
              <CardDescription>{c.mealCapture.reviewTitle}</CardDescription>
              <CardTitle className="mt-1">
                {analysis ? analysis.name : c.mealCapture.reviewPlaceholder}
              </CardTitle>
            </div>
            {captureMode !== 'photo' && analysis ? (
              <span
                className={`rounded-full px-2 py-1 text-xs font-semibold ${analysis.confidence < 70 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}
              >
                {analysis.confidence}% {c.mealCapture.confidence}
              </span>
            ) : null}
          </CardHeader>
          <CardContent>
            {captureMode === 'photo' ? (
              <div className="grid min-h-80 place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                <div>
                  <Camera className="mx-auto size-8 text-slate-300" />
                  <p className="mt-3 font-semibold text-slate-600">
                    {c.mealCapture.photoReviewTitle}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {uploadedPhoto
                      ? c.mealCapture.photoExtractionPending
                      : c.mealCapture.photoReviewDescription}
                  </p>
                  {extractionProposal ? (
                    <div className="mt-4 space-y-2 text-left">
                      {extractionProposal.items.map((item, index) => (
                        <button
                          key={`${item.name}-${index}`}
                          type="button"
                          onClick={() => selectExtractedFood(item.name)}
                          className="w-full rounded-lg border border-emerald-200 bg-white p-3 text-left text-sm"
                        >
                          <span className="font-semibold">{item.name}</span>
                          <span className="block text-slate-500">
                            {item.nameVi} · {item.servingDescription} ·{' '}
                            {item.confidence}%
                          </span>
                        </button>
                      ))}
                      <p className="text-xs text-slate-500">
                        {c.mealCapture.extractionReviewNote}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : analysis ? (
              <Review
                analysis={analysis}
                onNutrientChange={onNutrientChange}
                onReviewDetailsChange={onReviewDetailsChange}
                onDiscard={onDiscard}
                onConfirm={confirmMealAndRemoveSource}
                onSavePersonalFood={onSavePersonalFood}
                saving={saving}
                savingPersonalFood={savingPersonalFood}
                locale={locale}
              />
            ) : (
              <div className="grid min-h-80 place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                <div>
                  <Utensils className="mx-auto size-8 text-slate-300" />
                  <p className="mt-3 font-semibold text-slate-600">
                    {c.mealCapture.emptyReviewTitle}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {c.mealCapture.emptyReviewDescription}
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

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? 'secondary' : 'ghost'}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function Review({
  analysis,
  onNutrientChange,
  onReviewDetailsChange,
  onDiscard,
  onConfirm,
  onSavePersonalFood,
  saving,
  savingPersonalFood,
  locale,
}: {
  analysis: FoodAnalysis;
  onNutrientChange: CaptureSurfaceProps['onNutrientChange'];
  onReviewDetailsChange: CaptureSurfaceProps['onReviewDetailsChange'];
  onDiscard: () => void;
  onConfirm: () => Promise<boolean>;
  onSavePersonalFood: CaptureSurfaceProps['onSavePersonalFood'];
  saving: boolean;
  savingPersonalFood: boolean;
  locale: CaptureSurfaceProps['locale'];
}) {
  const c = getCopy(locale);
  const labels: Record<DashboardTargetKey, string> = {
    calories: c.today.calories,
    protein: c.today.protein,
    fiber: c.today.fiber,
    sodium: c.today.sodium,
  };
  const extraLabels: Record<string, string> = {
    carbohydrates: c.mealCapture.carbohydrates,
    totalSugar: c.mealCapture.totalSugar,
    addedSugar: c.mealCapture.addedSugar,
    totalFat: c.mealCapture.totalFat,
    saturatedFat: c.mealCapture.saturatedFat,
    cholesterol: c.mealCapture.cholesterol,
    potassium: c.mealCapture.potassium,
    calcium: c.mealCapture.calcium,
    iron: c.mealCapture.iron,
    alcohol: c.mealCapture.alcohol,
    water: c.mealCapture.water,
  };
  const extras = Object.entries(
    analysis.snapshot.additionalNutrients ?? {},
  ).filter(([, nutrient]) => nutrient?.value !== null);
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {dashboardTargets.map((target) => (
          <label className="rounded-xl bg-slate-50 p-3" key={target.key}>
            <span className="text-[11px] font-semibold text-slate-500">
              {labels[target.key]}
            </span>
            <Input
              type="number"
              min="0"
              value={analysis.snapshot.totals[target.key]}
              onChange={(event) =>
                onNutrientChange(target.key, event.target.value)
              }
              className="mt-2 h-8 border-0 bg-white px-2 font-semibold shadow-none"
            />
            <span className="mt-1 block text-[11px] text-slate-500">
              {target.unit}
            </span>
          </label>
        ))}
      </div>
      {extras.length ? (
        <div className="mt-5 rounded-xl bg-slate-50 p-4">
          <p className="text-sm font-semibold">
            {c.mealCapture.additionalNutrients}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {extras.map(([key, nutrient]) => (
              <div key={key} className="rounded-lg bg-white p-3 text-sm">
                <p className="text-xs text-slate-500">
                  {extraLabels[key] ?? key}
                </p>
                <p className="mt-1 font-semibold">
                  {nutrient!.value!.toLocaleString(locale)} {nutrient!.unit}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {c.mealCapture.additionalNutrientsSource}
          </p>
        </div>
      ) : null}
      <div className="mt-5">
        <label className="block text-sm font-semibold">
          {c.mealCapture.servingAssumption}
          <Input
            className="mt-2"
            maxLength={160}
            value={analysis.snapshot.servingDescription}
            onChange={(event) =>
              onReviewDetailsChange(
                event.target.value,
                analysis.snapshot.ingredients.join(', '),
              )
            }
          />
        </label>
        <label className="mt-4 block text-sm font-semibold">
          {c.mealCapture.detectedIngredients}
          <Textarea
            className="mt-2 min-h-20"
            maxLength={2000}
            value={analysis.snapshot.ingredients.join(', ')}
            onChange={(event) =>
              onReviewDetailsChange(
                analysis.snapshot.servingDescription,
                event.target.value,
              )
            }
            placeholder={c.mealCapture.ingredientsPlaceholder}
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">
            {c.mealCapture.ingredientsHelp}
          </span>
        </label>
      </div>
      <div
        className={`mt-5 rounded-xl p-4 text-sm leading-6 ${analysis.finding.severity === 'attention' ? 'bg-amber-50 text-amber-950' : 'bg-emerald-50 text-emerald-950'}`}
      >
        <p className="font-semibold">{c.mealCapture.sourceAndReview}</p>
        <p className="mt-1">{analysis.finding.text}</p>
      </div>
      {analysis.healthFindings?.map((finding) => (
        <div
          key={finding.ruleCode}
          className={`mt-3 rounded-xl border p-4 text-sm ${finding.severity === 'attention' ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}
        >
          <p className="font-semibold">
            {finding.condition.replace('_', ' ')} ·{' '}
            {finding.observedValue.toLocaleString(locale)}{' '}
            {finding.observedUnit}
          </p>
          <p className="mt-1">{finding.text}</p>
          <ul className="mt-2 list-disc pl-5">
            {finding.suggestedActions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs opacity-75">
            {c.mealCapture.ruleLabel} {finding.ruleCode} · {finding.ruleVersion}
          </p>
        </div>
      ))}
      {analysis.unresolvedQuestions.map((question) => (
        <p className="mt-3 text-sm text-slate-600" key={question}>
          {question}
        </p>
      ))}
      <div className="mt-6 flex flex-wrap gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={onDiscard}
          disabled={saving}
        >
          {c.mealCapture.discard}
        </Button>
        <Button
          variant="outline"
          onClick={() => void onSavePersonalFood('food')}
          disabled={saving || savingPersonalFood}
        >
          {savingPersonalFood ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <Plus />
          )}{' '}
          {c.mealCapture.saveFood}
        </Button>
        <Button
          variant="outline"
          onClick={() => void onSavePersonalFood('recipe')}
          disabled={saving || savingPersonalFood}
        >
          {savingPersonalFood ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <Plus />
          )}{' '}
          {c.mealCapture.saveRecipe}
        </Button>
        <Button
          className="flex-1 bg-emerald-800 hover:bg-emerald-900"
          onClick={onConfirm}
          disabled={saving}
        >
          {saving ? <LoaderCircle className="animate-spin" /> : <Check />}{' '}
          {saving ? c.common.saving : c.mealCapture.confirmAndSave}
        </Button>
      </div>
    </>
  );
}
