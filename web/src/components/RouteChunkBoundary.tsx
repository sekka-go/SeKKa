import { Component, type ReactNode } from "react";
import { t } from "../i18n/runtime";

type Props = { children: ReactNode };
type State = { hasError: boolean };

export default class RouteChunkBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return <section className="route-chunk-error" role="alert">
      <p>{t("تعذر تحميل الشاشة. تحقق من اتصالك وحاول مرة أخرى.")}</p>
      <button className="button button-outline button-small" type="button" onClick={() => window.location.reload()}>{t("إعادة المحاولة")}</button>
    </section>;
  }
}
