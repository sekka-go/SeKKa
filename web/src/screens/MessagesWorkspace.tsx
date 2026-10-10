import { getLanguage, t } from "../i18n/runtime";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { api, type Role } from "../api";
import { errorText } from "../lib/formatters";
import type { Session, Toast } from "../types";
import AppIcon from "../components/AppIcon";
import ProfileAvatar from "../components/ProfileAvatar";

type Person = { id: number; full_name: string; role: Role; avatar_path?: string | null };
type Message = { id: number; conversation_id: number; sender_user_id: number; body: string; created_at: string; read_at: string | null };
type Conversation = {
  id: number; last_message_at: string | null; last_message_body: string | null; last_message_sender_id: number | null;
  unread_count: number; other_user: Person;
};

const roleName = (role: Role) => t(role === "captain" ? "كابتن" : role === "admin" ? "الإدارة" : "راكب");
const timeLabel = (value: string | null) => value ? new Intl.DateTimeFormat(getLanguage() === "ar" ? "ar-EG" : "en-EG", { hour: "numeric", minute: "2-digit" }).format(new Date(value)) : "";

export default function MessagesWorkspace({ session, notify }: { session: Session; notify: (text: string, tone?: Toast["tone"]) => void }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [contacts, setContacts] = useState<Person[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showContacts, setShowContacts] = useState(false);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const selected = conversations.find((item) => item.id === selectedId) ?? null;

  const refreshConversations = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [inbox, people] = await Promise.all([
        api<{ conversations: Conversation[] }>("/messages/conversations", { token: session.token }),
        api<{ contacts: Person[] }>("/messages/contacts", { token: session.token }),
      ]);
      setConversations(inbox.conversations);
      setContacts(people.contacts);
      setError("");
    } catch (cause) {
      setError(errorText(cause));
    } finally { setLoading(false); }
  }, [session.token]);

  const refreshMessages = useCallback(async (conversationId: number, quiet = false) => {
    if (!quiet) setLoadingMessages(true);
    try {
      const result = await api<{ messages: Message[] }>(`/messages/conversations/${conversationId}/messages`, { token: session.token });
      setMessages(result.messages);
      await api(`/messages/conversations/${conversationId}/read`, { method: "POST", token: session.token });
      setConversations((current) => current.map((item) => item.id === conversationId ? { ...item, unread_count: 0 } : item));
    } catch (cause) {
      setError(errorText(cause));
    } finally { setLoadingMessages(false); }
  }, [session.token]);

  useEffect(() => { void refreshConversations(); }, [refreshConversations]);
  useEffect(() => {
    const timer = window.setInterval(() => { void refreshConversations(true); }, 8000);
    return () => window.clearInterval(timer);
  }, [refreshConversations]);
  useEffect(() => {
    if (selectedId === null) { setMessages([]); return; }
    void refreshMessages(selectedId);
    const timer = window.setInterval(() => { void refreshMessages(selectedId, true); }, 3500);
    return () => window.clearInterval(timer);
  }, [selectedId, refreshMessages]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages.length, selectedId]);

  const startConversation = async (person: Person) => {
    try {
      const result = await api<{ conversation: { id: number } }>("/messages/conversations", { method: "POST", token: session.token, body: { recipient_user_id: person.id } });
      await refreshConversations(true);
      setShowContacts(false);
      setSelectedId(result.conversation.id);
    } catch (cause) { notify(errorText(cause), "error"); }
  };

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!selectedId || !body || sending) return;
    setSending(true);
    try {
      await api(`/messages/conversations/${selectedId}/messages`, { method: "POST", token: session.token, body: { body } });
      setDraft("");
      await Promise.all([refreshMessages(selectedId, true), refreshConversations(true)]);
    } catch (cause) { notify(errorText(cause), "error"); }
    finally { setSending(false); }
  };

  return <section className="messages-workspace surface" aria-label={t("الرسائل")}>
    <div className="messages-inbox">
      <div className="messages-inbox-heading"><div><h2>{t("المحادثات")}</h2><p>{t("رسائلك مع المشاركين في مشاويرك ومجموعاتك")}</p></div><button className="button button-secondary messages-new-button" type="button" onClick={() => setShowContacts((value) => !value)}><AppIcon name="plus" size={17} />  {t("رسالة جديدة")}</button></div>
      {showContacts && <div className="messages-contact-picker"><strong>{t("اختار شخصًا شاركك مشوارًا أو مجموعة")}</strong>{contacts.length ? contacts.map((person) => <button key={person.id} type="button" onClick={() => void startConversation(person)}><ProfileAvatar userId={person.id} token={session.token} name={person.full_name} className="avatar messages-avatar" /><span><b>{person.full_name}</b><small>{roleName(person.role)}</small></span><AppIcon name="chevron" size={17} /></button>) : <p>{t("هتظهر هنا الجهات اللي شاركتك مشوارًا أو مجموعة.")}</p>}</div>}
      {loading ? <div className="messages-empty"><span className="loading-spinner" /><p>{t("جارٍ تحميل المحادثات…")}</p></div> : error && !conversations.length ? <div className="messages-empty"><AppIcon name="messages" size={30} /><p>{error}</p><button className="button button-secondary" type="button" onClick={() => void refreshConversations()}>{t("إعادة المحاولة")}</button></div> : conversations.length ? <div className="messages-conversation-list">{conversations.map((conversation) => <button key={conversation.id} type="button" className={`messages-conversation ${selectedId === conversation.id ? "is-selected" : ""}`} onClick={() => { setSelectedId(conversation.id); setShowContacts(false); }}><ProfileAvatar userId={conversation.other_user.id} token={session.token} name={conversation.other_user.full_name} className="avatar messages-avatar" /><span className="messages-conversation-copy"><span className="messages-conversation-top"><b>{conversation.other_user.full_name}</b><small>{timeLabel(conversation.last_message_at)}</small></span><span className="messages-conversation-bottom"><small>{conversation.last_message_body ?? roleName(conversation.other_user.role)}</small>{conversation.unread_count > 0 && <i>{conversation.unread_count}</i>}</span></span></button>)}</div> : <div className="messages-empty"><AppIcon name="messages" size={32} /><strong>{t("لسه مفيش رسائل")}</strong><p>{t("ابدأ محادثة مع شخص شاركك مشوارًا أو مجموعة.")}</p></div>}
    </div>
    <div className={`messages-thread ${selected ? "has-conversation" : ""}`}>
      {selected ? <>
        <header className="messages-thread-heading"><button type="button" className="messages-back-button" onClick={() => setSelectedId(null)} aria-label={t("العودة للمحادثات")}><AppIcon name="arrow" size={19} /></button><ProfileAvatar userId={selected.other_user.id} token={session.token} name={selected.other_user.full_name} className="avatar messages-avatar" /><span><b>{selected.other_user.full_name}</b><small>{roleName(selected.other_user.role)}</small></span></header>
        <div className="messages-thread-content">{loadingMessages && !messages.length ? <div className="messages-empty"><span className="loading-spinner" /><p>{t("جارٍ تحميل الرسائل…")}</p></div> : messages.length ? messages.map((message) => <article key={message.id} className={`message-bubble ${message.sender_user_id === session.user.id ? "message-mine" : "message-theirs"}`}><p>{message.body}</p><time>{timeLabel(message.created_at)}</time></article>) : <div className="messages-empty messages-thread-empty"><AppIcon name="messages" size={30} /><strong>{t("ابدأوا المحادثة")}</strong><p>{t("أرسل أول رسالة للتنسيق حول المشوار.")}</p></div>}<div ref={bottomRef} /></div>
        <form className="messages-composer" onSubmit={sendMessage}><textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} rows={1} placeholder={t("اكتب رسالتك…")} aria-label={t("نص الرسالة")} /><button className="button button-primary" type="submit" disabled={!draft.trim() || sending} aria-label={t("إرسال الرسالة")}><AppIcon name="send" size={18} /></button></form>
      </> : <div className="messages-empty messages-thread-placeholder"><AppIcon name="messages" size={42} /><strong>{t("رسائلك في مكان واحد")}</strong><p>{t("اختار محادثة من القائمة أو ابدأ واحدة جديدة.")}</p></div>}
    </div>
  </section>;
}
