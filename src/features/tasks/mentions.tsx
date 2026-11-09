import { useRef, useState } from "react";
import { Avatar } from "../../components/ui";
import { api } from "../../lib/api";
import { initials, personName } from "../../lib/utils";
import type { Member } from "../../lib/types";

const mentionLabel = (member: Member) => personName(member.user);
export const displayMentionText = (value: string, members?: Member[]) =>
  value.replace(/@\[([^\]]+)\]/g, (match, userId: string) => {
    const member = members?.find(
      (item) => item.user.id === userId || item.userId === userId,
    );
    return member ? `@${mentionLabel(member)}` : match;
  });
export const renderMentionText = (value: string, members?: Member[]) => {
  const parts = [];
  let lastIndex = 0;
  value.replace(/@\[([^\]]+)\]/g, (match, userId: string, index: number) => {
    if (index > lastIndex) parts.push(value.slice(lastIndex, index));
    const member = members?.find(
      (item) => item.user.id === userId || item.userId === userId,
    );
    parts.push(
      <span className="mention-chip" key={`${userId}-${index}`}>
        @{member ? mentionLabel(member) : userId}
      </span>,
    );
    lastIndex = index + match.length;
    return match;
  });
  if (lastIndex < value.length) parts.push(value.slice(lastIndex));
  return parts.length ? parts : value;
};
export const serializeMentionText = (value: string, members?: Member[]) =>
  [...(members ?? [])]
    .sort((a, b) => mentionLabel(b).length - mentionLabel(a).length)
    .reduce(
      (text, member) =>
        text.replaceAll(`@${mentionLabel(member)}`, `@[${member.user.id}]`),
      value,
    );
export function MentionTextarea({
  value,
  members,
  placeholder,
  autoFocus,
  onChange,
}: {
  value: string;
  members?: Member[];
  placeholder?: string;
  autoFocus?: boolean;
  onChange: (value: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mention, setMention] = useState<{
    query: string;
    start: number;
    end: number;
  } | null>(null);
  const updateMention = (nextValue: string, cursor: number | null) => {
    if (cursor === null) {
      setMention(null);
      return;
    }
    const beforeCursor = nextValue.slice(0, cursor);
    const match = beforeCursor.match(/(?:^|\s)@([^\s@]*)$/);
    if (!match) {
      setMention(null);
      return;
    }
    setMention({
      query: match[1],
      start: cursor - match[1].length - 1,
      end: cursor,
    });
  };
  const filteredMembers = mention
    ? (members ?? [])
        .filter((member) => {
          const query = mention.query.toLowerCase();
          return (
            mentionLabel(member).toLowerCase().includes(query) ||
            member.user.email.toLowerCase().includes(query)
          );
        })
        .slice(0, 6)
    : [];
  const selectMember = (member: Member) => {
    if (!mention) return;
    const inserted = `@${mentionLabel(member)} `;
    const nextValue =
      value.slice(0, mention.start) + inserted + value.slice(mention.end);
    onChange(nextValue);
    setMention(null);
    requestAnimationFrame(() => {
      const cursor = mention.start + inserted.length;
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(cursor, cursor);
    });
  };
  return (
    <div className="mention-textarea">
      <textarea
        ref={textareaRef}
        className="input textarea"
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(event) => {
          onChange(event.target.value);
          updateMention(event.target.value, event.target.selectionStart);
        }}
        onKeyUp={(event) =>
          updateMention(
            event.currentTarget.value,
            event.currentTarget.selectionStart,
          )
        }
        onBlur={() => window.setTimeout(() => setMention(null), 120)}
      />
      {!!filteredMembers.length && (
        <div className="mention-menu">
          {filteredMembers.map((member) => (
            <button
              type="button"
              key={member.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectMember(member)}
            >
              <Avatar
                label={initials(member.user)}
                src={api.avatarUrl(member.user.id)}
              />
              <span>
                <strong>{mentionLabel(member)}</strong>
                <small>{member.user.email}</small>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
