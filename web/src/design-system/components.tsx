import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

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
