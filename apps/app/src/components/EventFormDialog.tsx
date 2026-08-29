"use client";

import * as React from "react";
import { Button, Input, Label } from "@household/ui";
import { trpc } from "@/lib/trpc";

interface EventFormValues {
  id?: string;
  title: string;
  startAt: string;
  endAt: string;
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

  const start = editing?.startAt ?? new Date(initialDate.setHours(9, 0, 0, 0));
  const end = editing?.endAt ?? new Date(start.getTime() + 60 * 60 * 1000);

  const [values, setValues] = React.useState<EventFormValues>({
    id: editing?.id,
    title: editing?.title ?? "",
    startAt: toLocalInputValue(start),
    endAt: toLocalInputValue(end),
    location: editing?.location ?? "",
    assigneeIds: editing?.assignees.map((a) => a.userId) ?? [],
    colorHex: editing?.colorHex ?? "#3B82F6",
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      title: values.title,
      startAt: new Date(values.startAt),
      endAt: new Date(values.endAt),
      allDay: false,
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
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">{values.id ? "Edit event" : "New event"}</h2>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="startAt">Starts</Label>
              <Input
                id="startAt"
                type="datetime-local"
                required
                value={values.startAt}
                onChange={(e) => setValues((v) => ({ ...v, startAt: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="endAt">Ends</Label>
              <Input
                id="endAt"
                type="datetime-local"
                required
                value={values.endAt}
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
