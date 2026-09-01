import type {
  HealthFocus,
  OnboardingDraft,
  Reminder,
  SensitiveNotes,
} from '@/lib/contracts';
import { getCopy, type Locale } from '@/lib/copy';
import type { DashboardTargetKey } from '@/lib/dashboard-model';
import type { ReminderAction } from './use-reminder-actions';
import { SettingsPageFrame } from './settings-page-frame';
import { AccountDeletionPanel } from './account-deletion-panel';
import { ExportPanel } from './export-panel';
import { SensitiveNotesPanel } from './sensitive-notes-panel';
import { RemindersPanel } from './reminders-panel';
import { HealthTargetsPanel } from './health-targets-panel';
import { OnboardingPanel } from './onboarding-panel';

export type SettingsSurfaceProps = {
  targets: Record<DashboardTargetKey, number>;
  saving: boolean;
  onSave: (values: Record<DashboardTargetKey, number>) => void;
  healthFocuses: HealthFocus[];
  savingFocuses: boolean;
  onSaveFocuses: (focuses: HealthFocus[]) => void;
  onboarding: OnboardingDraft;
  onboardingStatus: 'in_progress' | 'complete';
  savingOnboarding: boolean;
  onSaveOnboarding: (draft: OnboardingDraft) => void;
  sensitiveNotes: SensitiveNotes;
  sensitiveNotesAvailable: boolean;
  savingSensitiveNotes: boolean;
  onSaveSensitiveNotes: (notes: SensitiveNotes) => void;
  reminders: Reminder[];
  onCreateReminder: (
    reminder: Omit<Reminder, 'id' | 'nextDeliveryAt' | 'status'>,
  ) => Promise<void>;
  onActOnReminder: (
    reminder: Reminder,
    action: ReminderAction,
  ) => Promise<void>;
  onDeleteAccountData: () => Promise<void>;
  locale: Locale;
};

export function SettingsSurface(props: SettingsSurfaceProps) {
  const c = getCopy(props.locale);
  return (
    <SettingsPageFrame locale={props.locale}>
      <OnboardingPanel
        initialDraft={props.onboarding}
        status={props.onboardingStatus}
        saving={props.savingOnboarding}
        onSave={props.onSaveOnboarding}
        locale={props.locale}
      />
      <SensitiveNotesPanel
        initialNotes={props.sensitiveNotes}
        available={props.sensitiveNotesAvailable}
        saving={props.savingSensitiveNotes}
        onSave={props.onSaveSensitiveNotes}
        locale={props.locale}
      />
      <RemindersPanel
        reminders={props.reminders}
        onCreate={props.onCreateReminder}
        onAction={props.onActOnReminder}
        locale={props.locale}
      />
      <ExportPanel locale={props.locale} />
      <AccountDeletionPanel
        onDelete={props.onDeleteAccountData}
        locale={props.locale}
      />
      <HealthTargetsPanel
        targets={props.targets}
        saving={props.saving}
        onSave={props.onSave}
        healthFocuses={props.healthFocuses}
        savingFocuses={props.savingFocuses}
        onSaveFocuses={props.onSaveFocuses}
        locale={props.locale}
      />
      <p className="mt-4 text-xs leading-5 text-slate-500">
        {c.settings.sensitiveDataNotice}
      </p>
    </SettingsPageFrame>
  );
}
