import { getDirection, getLanguage, t } from "../i18n/runtime";
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
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
const timeLabel = (value: string | null) => value
  ? new Intl.DateTimeFormat(getLanguage() === "ar" ? "ar-EG" : "en-EG", { hour: "numeric", minute: "2-digit" }).format(new Date(value))
  : "";
const messageDateLabel = (value: string) => new Intl.DateTimeFormat(getLanguage() === "ar" ? "ar-EG" : "en-EG", {
  weekday: "short", month: "short", day: "numeric",
}).format(new Date(value));

export default function MessagesWorkspace({ session, notify }: { session: Session; notify: (text: string, tone?: Toast["tone"]) => void }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [contacts, setContacts] = useState<Person[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showContacts, setShowContacts] = useState(false);
  const [draft, setDraft] = useState("");
  const [conversationQuery, setConversationQuery] = useState("");
  const [contactQuery, setContactQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
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
      setError("");
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
      const result = await api<{ conversation: { id: number } }>("/messages/conversations", {
        method: "POST", token: session.token, body: { recipient_user_id: person.id },
      });
      await refreshConversations(true);
      setShowContacts(false);
      setContactQuery("");
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

  const submitOnEnter = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  const query = conversationQuery.trim().toLocaleLowerCase();
  const visibleConversations = conversations.filter((conversation) => {
    const matchesUnread = !unreadOnly || conversation.unread_count > 0;
    const haystack = `${conversation.other_user.full_name} ${conversation.last_message_body ?? ""} ${roleName(conversation.other_user.role)}`.toLocaleLowerCase();
    return matchesUnread && (!query || haystack.includes(query));
  });
  const contactSearch = contactQuery.trim().toLocaleLowerCase();
  const visibleContacts = contacts.filter((person) => `${person.full_name} ${roleName(person.role)}`.toLocaleLowerCase().includes(contactSearch));

  return <section className="messages-experience messages-workspace surface" aria-label={t("الرسائل")} dir={getDirection()}>
    <aside className={`messages-inbox ${selected ? "has-selection" : ""}`} aria-label={t("messages.inbox") }>
      <div className="messages-inbox-heading">
        <div className="messages-inbox-title">
          <span className="messages-heading-icon"><AppIcon name="messages" size={20} /></span>
          <div><h2>{t("messages.inboxTitle")}</h2><p>{t("messages.inboxSubtitle")}</p></div>
        </div>
        <button className="button button-primary messages-new-button" type="button" onClick={() => { setShowContacts((value) => !value); setContactQuery(""); }} aria-expanded={showContacts}>
          <AppIcon name={showContacts ? "close" : "plus"} size={17} /><span>{showContacts ? t("messages.closePicker") : t("messages.newMessage")}</span>
        </button>
      </div>

      <label className="messages-search">
        <AppIcon name="search" size={18} />
        <input value={showContacts ? contactQuery : conversationQuery} onChange={(event) => showContacts ? setContactQuery(event.target.value) : setConversationQuery(event.target.value)} placeholder={showContacts ? t("messages.searchPeople") : t("messages.searchConversations")} aria-label={showContacts ? t("messages.searchPeople") : t("messages.searchConversations")} />
        {(showContacts ? contactQuery : conversationQuery) && <button type="button" onClick={() => showContacts ? setContactQuery("") : setConversationQuery("")} aria-label={t("messages.clearSearch")}><AppIcon name="close" size={15} /></button>}
      </label>

      {!showContacts && <div className="messages-filters" role="group" aria-label={t("messages.filterConversations")}>
        <button type="button" className={!unreadOnly ? "is-active" : ""} aria-pressed={!unreadOnly} onClick={() => setUnreadOnly(false)}>{t("messages.all")}</button>
        <button type="button" className={unreadOnly ? "is-active" : ""} aria-pressed={unreadOnly} onClick={() => setUnreadOnly(true)}>{t("messages.unread")}<span>{conversations.reduce((count, item) => count + item.unread_count, 0)}</span></button>
      </div>}

      {showContacts ? <div className="messages-contact-picker">
        <div className="messages-section-label"><strong>{t("messages.rideConnections")}</strong><span>{visibleContacts.length}</span></div>
        {visibleContacts.length ? visibleContacts.map((person) => <button className="messages-contact-row" key={person.id} type="button" onClick={() => void startConversation(person)}>
          <ProfileAvatar userId={person.id} token={session.token} name={person.full_name} className="avatar messages-avatar" />
          <span className="messages-contact-copy"><b>{person.full_name}</b><small>{roleName(person.role)}</small></span>
          <span className="messages-contact-action"><AppIcon name="chevron" size={17} /></span>
        </button>) : <div className="messages-empty messages-picker-empty"><AppIcon name="users" size={26} /><strong>{t(contactSearch ? "messages.noPeopleFound" : "messages.noRideContacts")}</strong><p>{t(contactSearch ? "messages.tryAnotherSearch" : "messages.contactsOnly")}</p></div>}
      </div> : loading ? <div className="messages-empty"><span className="loading-spinner" /><p>{t("loading.conversations")}</p></div>
        : error && !conversations.length ? <div className="messages-empty"><AppIcon name="messages" size={30} /><p>{error}</p><button className="button button-secondary" type="button" onClick={() => void refreshConversations()}>{t("إعادة المحاولة")}</button></div>
          : visibleConversations.length ? <div className="messages-conversation-list" aria-live="polite">{visibleConversations.map((conversation) => <button key={conversation.id} type="button" className={`messages-conversation ${selectedId === conversation.id ? "is-selected" : ""} ${conversation.unread_count ? "has-unread" : ""}`} onClick={() => { setSelectedId(conversation.id); setShowContacts(false); }} aria-current={selectedId === conversation.id ? "true" : undefined}>
            <ProfileAvatar userId={conversation.other_user.id} token={session.token} name={conversation.other_user.full_name} className="avatar messages-avatar" />
            <span className="messages-conversation-copy">
              <span className="messages-conversation-top"><b>{conversation.other_user.full_name}</b><time>{timeLabel(conversation.last_message_at)}</time></span>
              <span className="messages-conversation-bottom"><small>{conversation.last_message_body ?? roleName(conversation.other_user.role)}</small>{conversation.unread_count > 0 && <i aria-label={`${conversation.unread_count} ${t("messages.unreadCount")}`}>{conversation.unread_count}</i>}</span>
            </span>
          </button>)}</div> : <div className="messages-empty messages-inbox-empty"><span className="messages-empty-icon"><AppIcon name="messages" size={27} /></span><strong>{t(unreadOnly ? "messages.noUnread" : query ? "messages.noSearchResults" : "لسه مفيش رسائل")}</strong><p>{t(unreadOnly ? "messages.noUnreadHint" : query ? "messages.tryAnotherSearch" : "ابدأ محادثة مع شخص شاركك مشوارًا أو مجموعة.")}</p>{!unreadOnly && !query && <button type="button" className="button button-primary" onClick={() => setShowContacts(true)}><AppIcon name="plus" size={16} />{t("messages.newMessage")}</button>}</div>}
    </aside>

    <section className={`messages-thread ${selected ? "has-conversation" : ""}`} aria-label={selected ? `${t("messages.conversationWith")} ${selected.other_user.full_name}` : t("messages.conversationPreview")}>
      {selected ? <>
        <header className="messages-thread-heading">
          <button type="button" className="messages-back-button" onClick={() => setSelectedId(null)} aria-label={t("العودة للمحادثات")}><AppIcon name="arrow" size={19} /></button>
          <ProfileAvatar userId={selected.other_user.id} token={session.token} name={selected.other_user.full_name} className="avatar messages-avatar" />
          <span className="messages-recipient"><b>{selected.other_user.full_name}</b><small><i />{roleName(selected.other_user.role)} · {t("messages.inAppConversation")}</small></span>
          <span className="messages-private-note"><AppIcon name="shield" size={16} />{t("messages.privateChat")}</span>
        </header>
        <div className="messages-thread-content" aria-live="polite">
          {error && <div className="messages-inline-error" role="alert"><AppIcon name="inbox" size={17} />{error}<button type="button" onClick={() => void refreshMessages(selected.id)}>{t("إعادة المحاولة")}</button></div>}
          {loadingMessages && !messages.length ? <div className="messages-empty"><span className="loading-spinner" /><p>{t("loading.messages")}</p></div> : messages.length ? messages.map((message, index) => {
            const previous = messages[index - 1];
            const startsDay = !previous || new Date(previous.created_at).toDateString() !== new Date(message.created_at).toDateString();
            const own = message.sender_user_id === session.user.id;
            return <div className={`messages-message-group ${own ? "is-own" : "is-other"}`} key={message.id}>
              {startsDay && <div className="messages-date-divider"><span>{messageDateLabel(message.created_at)}</span></div>}
              <article className={`message-bubble ${own ? "message-mine" : "message-theirs"}`}><p>{message.body}</p><time>{timeLabel(message.created_at)}{own && message.read_at && <span className="message-read-state" aria-label={t("messages.read")}> · <AppIcon name="check" size={12} /></span>}</time></article>
            </div>;
          }) : <div className="messages-empty messages-thread-empty"><span className="messages-empty-icon"><AppIcon name="messages" size={28} /></span><strong>{t("ابدأوا المحادثة")}</strong><p>{t("أرسل أول رسالة للتنسيق حول المشوار.")}</p></div>}
          <div ref={bottomRef} />
        </div>
        <form className="messages-composer" onSubmit={sendMessage}>
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={submitOnEnter} maxLength={2000} rows={1} placeholder={t("اكتب رسالتك…")} aria-label={t("نص الرسالة")} />
          <span className="messages-composer-hint">{t("messages.enterToSend")}</span>
          <button className="button button-primary messages-send-button" type="submit" disabled={!draft.trim() || sending} aria-label={sending ? t("messages.sending") : t("إرسال الرسالة")}><AppIcon name="send" size={18} /><span>{sending ? t("messages.sending") : t("messages.send")}</span></button>
        </form>
      </> : <div className="messages-empty messages-thread-placeholder"><span className="messages-empty-icon"><AppIcon name="messages" size={32} /></span><strong>{t("رسائلك في مكان واحد")}</strong><p>{t("اختار محادثة من القائمة أو ابدأ واحدة جديدة.")}</p><span className="messages-security-note"><AppIcon name="shield" size={15} />{t("messages.privateChat")}</span></div>}
    </section>
  </section>;
}
