import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "icon";
export type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  className?: string;
  children: ReactNode;
};

export default function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  const classes = ["button", `button-${variant}`, `button-size-${size}`, className].filter(Boolean).join(" ");
  return (
    <button {...props} className={classes} disabled={disabled || loading} aria-busy={loading || undefined}>
      {loading && <span className="button-spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}
