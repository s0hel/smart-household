"use client";

import * as React from "react";
import { allDayAnchor, Button, Input, Label } from "@household/ui";
import { trpc } from "@/lib/trpc";

interface EventFormValues {
  id?: string;
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  location: string;
  assigneeIds: string[];
  colorHex: string;
}

function toLocalInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function EventFormDialog({
  initialDate,
  editing,
  onClose,
}: {
  initialDate: Date;
  editing?: {
    id: string;
    title: string;
    startAt: Date;
    endAt: Date;
    allDay: boolean;
    location?: string | null;
    colorHex: string;
    assignees: { userId: string }[];
  } | null;
  onClose: () => void;
}) {
  const { data: members } = trpc.familyMember.list.useQuery();
  const utils = trpc.useUtils();
  const createEvent = trpc.event.create.useMutation({ onSuccess: () => utils.event.list.invalidate() });
  const updateEvent = trpc.event.update.useMutation({ onSuccess: () => utils.event.list.invalidate() });
  const deleteEvent = trpc.event.delete.useMutation({ onSuccess: () => utils.event.list.invalidate() });

  const initialAllDay = editing?.allDay ?? false;
  const start = editing?.startAt ?? new Date(initialDate.setHours(9, 0, 0, 0));
  const end = editing?.endAt ?? new Date(start.getTime() + 60 * 60 * 1000);
  // An all-day event's startAt/endAt is a UTC-midnight instant representing a bare
  // calendar date (see event.ts's normalizeAllDay), not a real moment in time.
  // Reading it with local Date getters (as toLocalInputValue does) shifts it by the
  // viewer's UTC offset — allDayAnchor rebuilds a local Date with the same Y/M/D so
  // the datetime-local field shows the correct calendar date instead.
  const displayStart = initialAllDay ? allDayAnchor(start) : start;
  const displayEnd = initialAllDay ? allDayAnchor(end) : end;

  const [values, setValues] = React.useState<EventFormValues>({
    id: editing?.id,
    title: editing?.title ?? "",
    startAt: toLocalInputValue(displayStart),
    endAt: toLocalInputValue(displayEnd),
    allDay: initialAllDay,
    location: editing?.location ?? "",
    assigneeIds: editing?.assignees.map((a) => a.userId) ?? [],
    colorHex: editing?.colorHex ?? "#2851A3",
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // For all-day events, build the UTC-midnight instant directly from the
    // date portion (never through a local Date parse) so the saved value
    // can't pick up the browser's timezone offset — same pattern as
    // syncGoogleCalendar's toDate.
    const toEventDate = (v: string) => (values.allDay ? new Date(`${v.slice(0, 10)}T00:00:00Z`) : new Date(v));
    const payload = {
      title: values.title,
      startAt: toEventDate(values.startAt),
      endAt: toEventDate(values.endAt),
      allDay: values.allDay,
      location: values.location || null,
      colorHex: values.colorHex,
      assigneeIds: values.assigneeIds,
      checklist: [],
    };
    if (values.id) {
      await updateEvent.mutateAsync({ id: values.id, ...payload });
    } else {
      await createEvent.mutateAsync(payload);
    }
    onClose();
  }

  async function onDelete() {
    if (!values.id) return;
    await deleteEvent.mutateAsync({ id: values.id });
    onClose();
  }

  function toggleAssignee(id: string) {
    setValues((v) => ({
      ...v,
      assigneeIds: v.assigneeIds.includes(id) ? v.assigneeIds.filter((a) => a !== id) : [...v.assigneeIds, id],
    }));
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-2xl border-t-4 border-gold-400 bg-surface p-6 shadow-xl">
        <h2 className="mb-4 font-display text-lg italic text-sapphire-800">{values.id ? "Edit event" : "New event"}</h2>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              required
              value={values.title}
              onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="allDay"
              type="checkbox"
              checked={values.allDay}
              onChange={(e) => {
                const checked = e.target.checked;
                setValues((v) => ({
                  ...v,
                  allDay: checked,
                  startAt: checked ? v.startAt.slice(0, 10) : v.startAt.length > 10 ? v.startAt : `${v.startAt}T09:00`,
                  endAt: checked ? v.endAt.slice(0, 10) : v.endAt.length > 10 ? v.endAt : `${v.endAt}T09:00`,
                }));
              }}
              className="h-4 w-4 rounded border-ink-300"
            />
            <Label htmlFor="allDay">All day</Label>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="startAt">Starts</Label>
              <Input
                id="startAt"
                type={values.allDay ? "date" : "datetime-local"}
                required
                value={values.allDay ? values.startAt.slice(0, 10) : values.startAt}
                onChange={(e) => setValues((v) => ({ ...v, startAt: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="endAt">Ends</Label>
              <Input
                id="endAt"
                type={values.allDay ? "date" : "datetime-local"}
                required
                value={values.allDay ? values.endAt.slice(0, 10) : values.endAt}
                onChange={(e) => setValues((v) => ({ ...v, endAt: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={values.location}
              onChange={(e) => setValues((v) => ({ ...v, location: e.target.value }))}
            />
          </div>
          <div>
            <Label>Who&apos;s involved</Label>
            <div className="flex flex-wrap gap-2">
              {(members ?? []).map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => toggleAssignee(member.id)}
                  className="rounded-full px-3 py-1 text-xs font-medium text-white"
                  style={{
                    backgroundColor: member.colorHex,
                    opacity: values.assigneeIds.includes(member.id) ? 1 : 0.35,
                  }}
                >
                  {member.name}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between pt-2">
            <div>
              {values.id && (
                <Button type="button" variant="danger" size="sm" onClick={onDelete}>
                  Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" size="sm">
                Save
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
