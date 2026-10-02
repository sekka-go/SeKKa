type BrandLogoProps = {
  variant?: "light" | "dark";
  compact?: boolean;
  className?: string;
};

export default function BrandLogo({ variant = "dark", compact = false, className = "" }: BrandLogoProps) {
  return (
    <span className={`brand-logo ${compact ? "brand-logo-compact" : ""} ${className}`.trim()}>
      <img src={`/brand/sekka-icon-${variant}.png`} alt="سِكّة" />
      {!compact && <span className="brand-logo-copy"><strong>سِكّة</strong><small>معاك في السكة</small></span>}
    </span>
  );
}
