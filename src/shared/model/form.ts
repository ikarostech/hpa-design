export type FieldErrors<TValue> = Partial<Record<keyof TValue, string>>;

export interface FormState<TValue, TErrors = FieldErrors<TValue>> {
  value: TValue;
  initialValue: TValue;
  errors: TErrors;
  dirty: boolean;
  valid: boolean;
  submitting: boolean;
}

export interface FormController<TValue, TErrors = FieldErrors<TValue>> {
  state: FormState<TValue, TErrors>;
  update: <TKey extends keyof TValue>(key: TKey, value: TValue[TKey]) => void;
  patch: (value: Partial<TValue>) => void;
  reset: (value?: TValue) => void;
  submit: () => Promise<void>;
}
