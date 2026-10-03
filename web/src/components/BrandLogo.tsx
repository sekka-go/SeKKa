type BrandLogoProps = {
  compact?: boolean;
  className?: string;
};

export default function BrandLogo({ compact = false, className = "" }: BrandLogoProps) {
  return (
    <span className={`brand-logo ${compact ? "brand-logo-compact" : ""} ${className}`.trim()}>
      <img src="/brand/sekka-icon-dark.png" alt="سِكّة" />
      {!compact && <span className="brand-logo-copy"><strong>سِكّة</strong><small>معاك في السكة</small></span>}
    </span>
  );
}
