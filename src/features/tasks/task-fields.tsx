import { format } from "date-fns";
import {
  Blocks,
  Bug,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Minus,
  SquareCheck,
  Zap,
} from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { Avatar } from "../../components/ui";
import { api } from "../../lib/api";
import { useClickOutside } from "../../hooks/use-click-outside";
import { priorities, types } from "./task-filters";
import { initials, personName } from "../../lib/utils";
import type {
  Member,
  Milestone,
  TaskPriority,
  TaskType,
} from "../../lib/types";
import {
  findMilestoneById,
  findUserById,
  humanizeConstant,
} from "./task-utils";

export function DatePickerField({
  value,
  disabled,
  ariaLabel,
  invalid,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  ariaLabel: string;
  invalid?: boolean;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const label = value
    ? format(new Date(`${value}T00:00:00`), "MMM d, yyyy")
    : "None";
  return (
    <button
      className={[
        "date-picker-field",
        value ? "" : "empty",
        invalid ? "invalid" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      type="button"
      disabled={disabled}
      onClick={() => inputRef.current?.showPicker?.()}
    >
      <span>{label}</span>
      <input
        ref={inputRef}
        type="date"
        aria-label={ariaLabel}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </button>
  );
}
export function PriorityIcon({ priority }: { priority: TaskPriority }) {
  if (priority === "HIGH")
    return <ChevronUp className="priority-icon priority-icon-high" size={15} />;
  if (priority === "LOW")
    return (
      <ChevronDown className="priority-icon priority-icon-low" size={15} />
    );
  return <Minus className="priority-icon priority-icon-medium" size={15} />;
}
export function PriorityDropdown({
  value,
  disabled,
  onChange,
}: {
  value: TaskPriority;
  disabled?: boolean;
  onChange: (priority: TaskPriority) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => {
    setOpen(false);
  });
  return (
    <div className="priority-dropdown" ref={ref}>
      <button
        className="priority-dropdown-button"
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span>
          <PriorityIcon priority={value} />
          {humanizeConstant(value)}
        </span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="priority-dropdown-menu">
          {priorities.map((priority) => (
            <button
              className={priority === value ? "active" : ""}
              type="button"
              key={priority}
              onClick={() => {
                setOpen(false);
                if (priority !== value) onChange(priority);
              }}
            >
              <PriorityIcon priority={priority} />
              {humanizeConstant(priority)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
export function TypeIcon({ type }: { type: TaskType }) {
  if (type === "BUG")
    return <Bug className="type-icon type-icon-bug" size={15} />;
  if (type === "FEATURE")
    return <Zap className="type-icon type-icon-feature" size={15} />;
  if (type === "IMPROVEMENT")
    return <Blocks className="type-icon type-icon-improvement" size={15} />;
  return <SquareCheck className="type-icon type-icon-task" size={15} />;
}
export function TypeDropdown({
  value,
  disabled,
  onChange,
}: {
  value: TaskType;
  disabled?: boolean;
  onChange: (type: TaskType) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => {
    setOpen(false);
  });
  return (
    <div className="type-dropdown" ref={ref}>
      <button
        className="type-dropdown-button"
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span>
          <TypeIcon type={value} />
          {humanizeConstant(value)}
        </span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="type-dropdown-menu">
          {types.map((type) => (
            <button
              className={type === value ? "active" : ""}
              type="button"
              key={type}
              onClick={() => {
                setOpen(false);
                if (type !== value) onChange(type);
              }}
            >
              <TypeIcon type={type} />
              {humanizeConstant(type)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
export function UserDropdown({
  value,
  members,
  disabled,
  allowUnassigned = false,
  onChange,
}: {
  value?: string | null;
  members?: Member[];
  disabled?: boolean;
  allowUnassigned?: boolean;
  onChange: (userId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = findUserById(members, value);
  useClickOutside(ref, () => {
    setOpen(false);
  });
  return (
    <div className="user-dropdown" ref={ref}>
      <button
        className={
          value ? "user-dropdown-button" : "user-dropdown-button empty"
        }
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        {value ? (
          <span className="user-dropdown-selected">
            <Avatar
              label={selected ? initials(selected) : "?"}
              src={api.avatarUrl(value)}
            />
            <span>{selected ? personName(selected) : value}</span>
          </span>
        ) : (
          <span className="user-dropdown-selected">Unassigned</span>
        )}
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="user-dropdown-menu">
          {allowUnassigned && (
            <button
              className={!value ? "active" : ""}
              type="button"
              onClick={() => {
                setOpen(false);
                if (value) onChange(null);
              }}
            >
              <span className="user-dropdown-empty-avatar">-</span>
              <span>Unassigned</span>
            </button>
          )}
          {members?.map((member) => (
            <button
              className={member.user.id === value ? "active" : ""}
              type="button"
              key={member.id}
              onClick={() => {
                setOpen(false);
                if (member.user.id !== value) onChange(member.user.id);
              }}
            >
              <Avatar
                label={initials(member.user)}
                src={api.avatarUrl(member.user.id)}
              />
              <span>{personName(member.user)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
export function MilestoneDropdown({
  value,
  milestones,
  disabled,
  onChange,
}: {
  value?: string | null;
  milestones?: Milestone[];
  disabled?: boolean;
  onChange: (milestoneId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = findMilestoneById(milestones, value);
  useClickOutside(ref, () => {
    setOpen(false);
  });
  return (
    <div className="user-dropdown milestone-dropdown" ref={ref}>
      <button
        className={
          value ? "user-dropdown-button" : "user-dropdown-button empty"
        }
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="user-dropdown-selected milestone-dropdown-selected">
          <CalendarDays size={15} />
          <span>{selected?.name || (value ? value : "None")}</span>
        </span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="user-dropdown-menu">
          <button
            className={!value ? "active" : ""}
            type="button"
            onClick={() => {
              setOpen(false);
              if (value) onChange(null);
            }}
          >
            <CalendarDays size={15} />
            <span>None</span>
          </button>
          {milestones?.length ? (
            milestones.map((milestone) => (
              <button
                className={milestone.id === value ? "active" : ""}
                type="button"
                key={milestone.id}
                onClick={() => {
                  setOpen(false);
                  if (milestone.id !== value) onChange(milestone.id);
                }}
              >
                <CalendarDays size={15} />
                <span>{milestone.name}</span>
              </button>
            ))
          ) : (
            <div className="user-dropdown-empty-option">No milestones yet</div>
          )}
        </div>
      )}
    </div>
  );
}
export function CollapsibleTaskSection({
  title,
  children,
  className,
  actions,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section
      className={["task-details-panel", className].filter(Boolean).join(" ")}
    >
      <div className="collapsible-section-header">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          <span>{title}</span>
        </button>
        {actions}
      </div>
      {open && <div className="collapsible-section-body">{children}</div>}
    </section>
  );
}
