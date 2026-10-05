import React from "react";
import { Image, Pressable, SectionList, Text, View } from "react-native";

type NoticeType = "ride" | "chat" | "rating" | "alert" | "system";
type Notice = {
  id: number;
  actor_id: number | null;
  type: NoticeType;
  payload: { actor_name?: string; actor_avatar_url?: string; message?: string; title?: string; origin?: string; destination?: string; quote?: string; preview?: string };
  is_read: boolean;
  timestamp: string;
  group_id: number | null;
};
type Props = {
  sections: { title: "الجديد" | "اليوم" | "سابقاً"; data: Notice[] }[];
  onPress: (notice: Notice) => void;
  onAction: (notice: Notice, action: "read" | "delete" | "mute") => void;
};

const palette: Record<NoticeType, string> = { ride: "#42A66A", chat: "#3287D5", rating: "#E8B922", alert: "#E3604B", system: "#718096" };
const badge: Record<NoticeType, string> = { ride: "✓", chat: "●", rating: "★", alert: "!", system: "•" };
const ago = (value: string) => {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "دلوقتي";
  if (minutes < 60) return `${minutes} د`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} س`;
  return new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short" }).format(new Date(value));
};

function NotificationItem({ notice, onPress, onAction }: { notice: Notice } & Pick<Props, "onPress" | "onAction">) {
  const systemActor = notice.actor_id === null && !notice.payload.actor_name;
  const actor = notice.payload.actor_name ?? (systemActor || notice.type === "system" ? "سِكّة" : "عضو في سِكّة");
  const trip = [notice.payload.origin, notice.payload.destination].filter(Boolean).join(" ← ");
  const quote = notice.payload.quote ?? notice.payload.preview;
  return <View className={`mb-2 flex-row-reverse items-start gap-3 rounded-2xl border p-3 ${notice.is_read ? "border-slate-700 bg-transparent" : "border-amber-300/20 bg-amber-300/[0.06]"}`}>
    <Pressable className="flex-1 flex-row-reverse items-start gap-3" accessibilityRole="button" onPress={() => onPress(notice)}>
      <View className="relative h-12 w-12 items-center justify-center rounded-full bg-slate-200">
        {notice.payload.actor_avatar_url ? <Image source={{ uri: notice.payload.actor_avatar_url }} className="h-12 w-12 rounded-full" /> : <Text className="font-bold text-slate-900">{systemActor || notice.type === "system" ? "س" : actor.slice(0, 1)}</Text>}
        <View className="absolute bottom-0 right-0 h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-slate-900" style={{ backgroundColor: palette[notice.type] }}><Text className="text-[9px] font-bold text-white">{badge[notice.type]}</Text></View>
      </View>
      <View className="flex-1 gap-1" accessibilityLanguage="ar-EG">
        <Text className="text-right text-sm leading-6 text-slate-300"><Text className="font-bold text-white">{actor}</Text> {notice.payload.message ?? notice.payload.title ?? "عندك تحديث جديد على مشوارك."}</Text>
        {trip ? <Text className="text-right text-xs font-bold text-amber-300">{trip}</Text> : null}
        {quote ? <Text numberOfLines={1} className="text-right text-xs text-slate-400">“{quote}”</Text> : null}
        <Text className="text-right text-[11px] text-slate-500">{ago(notice.timestamp)}</Text>
      </View>
    </Pressable>
    <View className="items-center gap-2">
      {!notice.is_read && <Pressable accessibilityLabel="تعليم كمقروء" onPress={() => onAction(notice, "read")}><Text className="text-lg text-slate-400">✓</Text></Pressable>}
      <Pressable accessibilityLabel="حذف الإشعار" onPress={() => onAction(notice, "delete")}><Text className="text-lg text-slate-400">⋯</Text></Pressable>
      {notice.group_id !== null && <Pressable accessibilityLabel="كتم إشعارات المشوار" onPress={() => onAction(notice, "mute")}><Text className="text-[10px] text-slate-400">كتم</Text></Pressable>}
    </View>
  </View>;
}

export default function NotificationFeed({ sections, onPress, onAction }: Props) {
  return <SectionList sections={sections} keyExtractor={(item) => String(item.id)} className="bg-slate-950 px-4" contentContainerClassName="py-4" stickySectionHeadersEnabled={false}
    renderSectionHeader={({ section }) => <Text className="mb-2 mt-4 text-right text-xs font-bold text-slate-400">{section.title}</Text>}
    renderItem={({ item }) => <NotificationItem notice={item} onPress={onPress} onAction={onAction} />}
    ListEmptyComponent={<Text className="py-16 text-center text-sm text-slate-400">مفيش إشعارات جديدة دلوقتي.</Text>} />;
}
