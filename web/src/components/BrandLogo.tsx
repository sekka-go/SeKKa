type BrandLogoProps = {
  compact?: boolean;
  className?: string;
};

export default function BrandLogo({ compact = false, className = "" }: BrandLogoProps) {
  return (
    <span className={`brand-logo ${compact ? "brand-logo-compact" : ""} ${className}`.trim()}>
      <span className="brand-logo-copy"><strong>سِكَّة | SeKKa</strong>{!compact && <small><span>معاك</span> <span>في</span> <span>السكة</span></small>}</span>
    </span>
  );
}
