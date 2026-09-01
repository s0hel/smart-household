"use client";

import { Button, PersonBadge, type EventView } from "@household/ui";

function formatDateTime(event: EventView) {
  const dateFmt = (d: Date) => d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  if (event.allDay) return dateFmt(event.startAt);

  const timeFmt = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const sameDay = event.startAt.toDateString() === event.endAt.toDateString();
  if (sameDay) return `${dateFmt(event.startAt)} · ${timeFmt(event.startAt)} – ${timeFmt(event.endAt)}`;
  return `${dateFmt(event.startAt)} ${timeFmt(event.startAt)} – ${dateFmt(event.endAt)} ${timeFmt(event.endAt)}`;
}

export function EventDetailsDialog({
  event,
  canManage,
  onEdit,
  onClose,
}: {
  event: EventView;
  canManage: boolean;
  onEdit: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
      <div
        className="w-full max-w-md rounded-2xl border-t-4 bg-white p-6 shadow-xl"
        style={{ borderTopColor: event.colorHex }}
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-display text-lg italic text-sapphire-800">{event.title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 text-ink-400 hover:text-ink-700"
          >
            ✕
          </button>
        </div>
        <p className="mt-1 text-sm text-ink-600">{formatDateTime(event)}</p>

        {(event.location || event.travelTimeMinutes != null) && (
          <div className="mt-3 text-sm">
            {event.location && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sapphire-700 underline-offset-2 hover:underline"
              >
                📍 {event.location}
              </a>
            )}
            {event.travelTimeMinutes != null && (
              <p className="mt-1 text-ink-500">🚗 {event.travelTimeMinutes} min drive</p>
            )}
          </div>
        )}

        {event.assignees.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {event.assignees.map((person) => (
              <PersonBadge key={person.id} person={person} size="sm" />
            ))}
          </div>
        )}

        {event.checklist.length > 0 && (
          <ul className="mt-4 space-y-1 text-sm text-ink-700">
            {event.checklist.map((item) => (
              <li key={item.id} className={item.checked ? "text-ink-400 line-through" : undefined}>
                ☑ {item.label}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
          {canManage && (
            <Button type="button" size="sm" onClick={onEdit}>
              Edit
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
