import { t } from "../i18n/runtime";
import SekkaMark from "./SekkaMark";

type BrandLogoProps = {
  compact?: boolean;
  className?: string;
};

export default function BrandLogo({ compact = false, className = "" }: BrandLogoProps) {
  return (
    <span className={`brand-logo ${compact ? "brand-logo-compact" : ""} ${className}`.trim()}>
      <SekkaMark className="brand-logo-mark" />
      {!compact && <span className="brand-logo-copy"><strong>{t("سِكَّة | SeKKa")}</strong><small>{t("معاك في السكة")}</small></span>}
    </span>
  );
}
