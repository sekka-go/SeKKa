import { useEffect, useState } from "react";
import { fetchProfileAvatar } from "../api";

export default function ProfileAvatar({ userId, token, name, className = "avatar" }: { userId: number; token: string; name: string; className?: string }) {
  const [source, setSource] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;
    setSource(null);
    void fetchProfileAvatar(token, userId, controller.signal).then((url) => {
      if (url) { objectUrl = url; setSource(url); }
    }).catch(() => undefined);
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [token, userId, refresh]);
  useEffect(() => {
    const update = (event: Event) => {
      if ((event as CustomEvent<number>).detail === userId) setRefresh((value) => value + 1);
    };
    window.addEventListener("sekka:profile-updated", update);
    return () => window.removeEventListener("sekka:profile-updated", update);
  }, [userId]);

  return <span className={`${className} profile-avatar`} aria-hidden="true" onContextMenu={(event) => event.preventDefault()} onDragStart={(event) => event.preventDefault()}>
    {source ? <img src={source} alt="" draggable={false} /> : name.trim().slice(0, 1)}
  </span>;
}
