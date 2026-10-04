import { lazy, Suspense, type ComponentProps } from "react";
import type MapPickerView from "../MapPicker";

const MapPicker = lazy(() => import("../MapPicker"));
type MapPickerProps = ComponentProps<typeof MapPickerView>;

export default function MapPickerLoader(props: MapPickerProps) {
  return <Suspense fallback={<div className="map-canvas map-loading" role="status">جاري تحميل الخريطة…</div>}>
    <MapPicker {...props} />
  </Suspense>;
}
