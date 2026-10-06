import SikkaMark from "./SikkaMark";

type BrandLogoProps = {
  compact?: boolean;
  className?: string;
};

export default function BrandLogo({ compact = false, className = "" }: BrandLogoProps) {
  return (
    <span className={`brand-logo ${compact ? "brand-logo-compact" : ""} ${className}`.trim()}>
      <SikkaMark className="brand-logo-mark" />
      {!compact && <span className="brand-logo-copy"><strong>سِكَّة | SeKKa</strong><small><span>معاك</span> <span>في</span> <span>السكة</span></small></span>}
    </span>
  );
}
