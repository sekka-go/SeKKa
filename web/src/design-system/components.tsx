import { useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  loadingLabel?: string;
};

export function Button({ loading = false, loadingLabel, disabled, children, className = "", ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={`sekka-register-submit ${className}`.trim()}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? loadingLabel : children}
    </button>
  );
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  trailing?: ReactNode;
};

export function TextField({ label, trailing, id, name, ...inputProps }: TextFieldProps) {
  const fieldId = id ?? name;
  return (
    <label className="sekka-register-field" htmlFor={fieldId}>
      <span>{label}</span>
      <input {...inputProps} id={fieldId} name={name} />
      {trailing}
    </label>
  );
}

export function InlineAlert({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "success" }) {
  return <p className={tone === "error" ? "sekka-register-error" : "sekka-login-success"} role={tone === "error" ? "alert" : "status"}>{children}</p>;
}

export function LoadingState({ label = "جارٍ التحميل" }: { label?: string }) {
  return <div className="sekka-state sekka-state-loading" role="status" aria-live="polite" aria-busy="true"><span className="sekka-state-spinner" aria-hidden="true" /><span>{label}</span></div>;
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: { label: string; onClick: () => void } }) {
  return <section className="sekka-state sekka-state-empty"><span className="sekka-state-symbol" aria-hidden="true">⌁</span><h2>{title}</h2>{description && <p>{description}</p>}{action && <Button type="button" onClick={action.onClick}>{action.label}</Button>}</section>;
}

export function ErrorState({ title = "تعذر تحميل البيانات", description, onRetry }: { title?: string; description?: string; onRetry?: () => void }) {
  return <section className="sekka-state sekka-state-error" role="alert"><span className="sekka-state-symbol" aria-hidden="true">!</span><h2>{title}</h2>{description && <p>{description}</p>}{onRetry && <Button type="button" onClick={onRetry}>إعادة المحاولة</Button>}</section>;
}

export function OfflineNotice({ isOnline }: { isOnline: boolean }) {
  if (isOnline) return null;
  return <div className="sekka-offline-notice" role="status" aria-live="polite">الاتصال بالإنترنت غير متاح. ستظهر البيانات عند عودة الاتصال.</div>;
}

export function AccessDeniedState({ title = "لا تملك صلاحية الوصول", description = "سجّل الدخول بالحساب المخول أو عُد إلى الصفحة الرئيسية." }: { title?: string; description?: string }) {
  return <section className="sekka-state sekka-state-denied" role="alert"><span className="sekka-state-symbol" aria-hidden="true">⌑</span><h1>{title}</h1><p>{description}</p><a className="sekka-state-link" href="/">العودة إلى الرئيسية</a></section>;
}

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({ open, title, description, confirmLabel, cancelLabel = "رجوع", onCancel, onConfirm }: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <div className="sekka-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <section ref={dialogRef} className="sekka-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="sekka-confirm-title" aria-describedby="sekka-confirm-description" tabIndex={-1} onKeyDown={(event) => { if (event.key === "Escape") onCancel(); }}>
        <h2 id="sekka-confirm-title">{title}</h2>
        <p id="sekka-confirm-description">{description}</p>
        <div className="sekka-confirm-actions"><Button type="button" className="sekka-confirm-primary" onClick={onConfirm}>{confirmLabel}</Button><button type="button" className="sekka-confirm-cancel" onClick={onCancel}>{cancelLabel}</button></div>
      </section>
    </div>
  );
}
