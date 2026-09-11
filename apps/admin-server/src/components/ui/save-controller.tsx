import useUnsavedChanges from '@/hooks/use-unsaved-changes';
import cloneDeep from 'lodash/cloneDeep';
import isEqual from 'lodash/isEqual';
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

/**
 * Visual state of the persistent save bar.
 * - neutral: nothing to save, bar is hidden
 * - dirty: there are unsaved changes on the page
 * - saving: a save request is in flight
 * - success: the save succeeded (auto-hides after 4s)
 * - error: the save failed (stays visible until dismissed or retried)
 */
export type SaveState = 'neutral' | 'dirty' | 'saving' | 'success' | 'error';

export type SaveRegistration = {
  /** Whether the registered page currently has unsaved changes. */
  isDirty: boolean;
  /** Persist the changes. Must throw / reject when the save fails. */
  save: () => Promise<void>;
  /**
   * `false` keeps a component off the bar. For a form that is shared between an
   * edit page and a create page, where only the edit page is migrated: the
   * create page keeps its own button, so registering there would add a second,
   * permanently disabled save control next to the working one.
   */
  enabled?: boolean;
};

type SaveControllerValue = {
  state: SaveState;
  errorMessage: string | null;
  isRegistered: boolean;
  isDirty: boolean;
  register: (registration: SaveRegistration | null) => void;
  triggerSave: () => void;
  dismissError: () => void;
  /**
   * Mark any save currently in flight as stale without touching the
   * registered page's dirty/success/error state. Call this when a page
   * switches to a different underlying record WITHOUT unmounting (e.g. a
   * widget id changing on the same route) — `register(null)` only bumps the
   * token on unmount, so without this a save started for the old record could
   * still resolve and flash "saved"/blocked on the new one.
   */
  invalidateInFlightSave: () => void;
};

const SaveControllerContext = createContext<SaveControllerValue | null>(null);

const SUCCESS_AUTO_HIDE_MS = 4000;

export function SaveControllerProvider({ children }: { children: ReactNode }) {
  const registrationRef = useRef<SaveRegistration | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'saving' | 'success' | 'error'>(
    'idle'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const registrationToken = useRef(0);

  const clearSuccessTimer = useCallback(() => {
    if (successTimer.current) {
      clearTimeout(successTimer.current);
      successTimer.current = null;
    }
  }, []);

  const register = useCallback(
    (registration: SaveRegistration | null) => {
      registrationRef.current = registration;
      if (!registration) {
        registrationToken.current += 1;
        setIsRegistered(false);
        setIsDirty(false);
        setErrorMessage(null);
        clearSuccessTimer();
        setPhase('idle');
        return;
      }
      setIsRegistered(true);
      setIsDirty(!!registration.isDirty);
      if (registration.isDirty) {
        setPhase((prev) => (prev === 'success' ? 'idle' : prev));
      }
    },
    [clearSuccessTimer]
  );

  const triggerSave = useCallback(() => {
    const registration = registrationRef.current;
    if (!registration) return;

    const token = registrationToken.current;
    const isStale = () => registrationToken.current !== token;

    clearSuccessTimer();
    setErrorMessage(null);
    setPhase('saving');

    registration
      .save()
      .then(() => {
        if (isStale()) return;
        // Dirty state is the registered page's to report, not this callback's.
        // Every consumer clears it after a successful save and re-registers,
        // which lands here as `setIsDirty(false)` through `register`. Forcing
        // it false from here would also hide a field the user typed while the
        // request was in flight: that edit was never sent, so the bar has to
        // keep offering to save it.
        setPhase('success');
        clearSuccessTimer();
        successTimer.current = setTimeout(() => {
          setPhase('idle');
          successTimer.current = null;
        }, SUCCESS_AUTO_HIDE_MS);
      })
      .catch((error: unknown) => {
        if (isStale()) return;
        const message =
          error instanceof Error && error.message
            ? error.message
            : 'Er is iets misgegaan bij het opslaan. Probeer het opnieuw.';
        setErrorMessage(message);
        setPhase('error');
      });
  }, [clearSuccessTimer]);

  const dismissError = useCallback(() => {
    setErrorMessage(null);
    setPhase('idle');
  }, []);

  const invalidateInFlightSave = useCallback(() => {
    registrationToken.current += 1;
    setErrorMessage(null);
    clearSuccessTimer();
    setPhase('idle');
  }, [clearSuccessTimer]);

  useEffect(() => clearSuccessTimer, [clearSuccessTimer]);

  const state: SaveState = useMemo(() => {
    if (phase === 'saving') return 'saving';
    if (phase === 'error') return 'error';
    if (phase === 'success') return 'success';
    if (isRegistered && isDirty) return 'dirty';
    return 'neutral';
  }, [phase, isRegistered, isDirty]);

  const { setSavedState, getCurrentStateRef } = useUnsavedChanges();
  useEffect(() => {
    setSavedState(false);
  }, [setSavedState]);
  getCurrentStateRef.current = () => isRegistered && isDirty;

  const value = useMemo<SaveControllerValue>(
    () => ({
      state,
      errorMessage,
      isRegistered,
      isDirty,
      register,
      triggerSave,
      dismissError,
      invalidateInFlightSave,
    }),
    [
      state,
      errorMessage,
      isRegistered,
      isDirty,
      register,
      triggerSave,
      dismissError,
      invalidateInFlightSave,
    ]
  );

  return (
    <SaveControllerContext.Provider value={value}>
      {children}
    </SaveControllerContext.Provider>
  );
}

export function useSaveController(): SaveControllerValue {
  const context = useContext(SaveControllerContext);
  if (!context) {
    throw new Error(
      'useSaveController must be used within a SaveControllerProvider'
    );
  }
  return context;
}

/**
 * Register a page's save handler + dirty state with the global save bar.
 * The registration is kept up to date on every render and cleared on unmount
 * so the bar never targets a page that is no longer visible.
 */
export function useRegisterSave(registration: SaveRegistration) {
  const { register } = useSaveController();
  const enabled = registration.enabled !== false;

  useEffect(() => {
    if (!enabled) return;
    register(registration);
  }, [register, enabled, registration.isDirty, registration.save]);

  useEffect(() => {
    if (!enabled) return;
    // Only a component that registered may clear the registration: there is one
    // slot, so an unmounting component that never registered would otherwise
    // wipe the registration of the page it shares the route with.
    return () => register(null);
  }, [register, enabled]);
}

/**
 * Re-baseline a form on the values that were just persisted.
 *
 * `sent` must be a deep copy taken *before* the request: `getValues()` hands
 * out the live nested objects, so a keystroke during the request would mutate
 * the snapshot too and the comparison below could never see a difference.
 *
 * Anything typed while the request was in flight was not part of it. Adopting
 * the current values as the saved baseline would mark that edit as saved and
 * silently drop it, so those values are kept as a live, still-dirty edit.
 */
export function rebaselineAfterSave(
  form: {
    getValues: () => any;
    reset: (values?: any, options?: any) => void;
  },
  sent: any
) {
  const editedMeanwhile = !isEqual(form.getValues(), sent);
  form.reset(
    sent,
    editedMeanwhile ? { keepValues: true, keepDirty: true } : undefined
  );
}

/**
 * Register a react-hook-form page with the global save bar.
 *
 * On top of `useRegisterSave` this clears the form's dirty baseline after a
 * successful save, so the bar can switch to its "saved" confirmation instead
 * of keeping the "unsaved changes" warning on screen.
 */
export function useRegisterFormSave(
  form: {
    formState: { isDirty: boolean };
    getValues: () => any;
    reset: (values?: any, options?: any) => void;
  },
  save: () => Promise<void>,
  options?: { enabled?: boolean }
) {
  const saveAndClearDirty = useCallback(async () => {
    const sent = cloneDeep(form.getValues());
    await save();
    rebaselineAfterSave(form, sent);
  }, [form, save]);

  useRegisterSave({
    enabled: options?.enabled,
    isDirty: form.formState.isDirty,
    save: saveAndClearDirty,
  });
}
