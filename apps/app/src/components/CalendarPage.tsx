"use client";

import * as React from "react";
import { addDays, addMonths, addWeeks, format } from "date-fns";
import { useSession } from "next-auth/react";
import { Button, CalendarView, type CalendarMode, type EventView } from "@household/ui";
import { can, type Role } from "@household/domain";
import { trpc } from "@/lib/trpc";
import { toEventView } from "@/lib/viewModels";
import { EventFormDialog } from "./EventFormDialog";

const MODES: CalendarMode[] = ["day", "week", "month", "agenda"];

export function CalendarPage() {
  const { data: session } = useSession();
  const [mode, setMode] = React.useState<CalendarMode>("week");
  const [anchorDate, setAnchorDate] = React.useState(new Date());
  const [dialogState, setDialogState] = React.useState<{ open: boolean; date: Date; editing: EventView | null }>({
    open: false,
    date: new Date(),
    editing: null,
  });

  const eventsQuery = trpc.event.list.useQuery();
  const { data: members } = trpc.familyMember.list.useQuery();
  const events = (eventsQuery.data ?? []).map(toEventView);
  const rawEvents = eventsQuery.data ?? [];

  const activeRole = (members?.find((m) => m.id === session?.user.activeProfileId)?.role ?? "READONLY") as Role;
  const canManage = can(activeRole, "event", "create");

  function navigate(direction: 1 | -1) {
    if (mode === "day") setAnchorDate((d) => addDays(d, direction));
    else if (mode === "week") setAnchorDate((d) => addWeeks(d, direction));
    else if (mode === "month") setAnchorDate((d) => addMonths(d, direction));
  }

  function openCreate(date: Date) {
    setDialogState({ open: true, date, editing: null });
  }

  function openEdit(event: EventView) {
    setDialogState({ open: true, date: event.startAt, editing: event });
  }

  const editingRaw = dialogState.editing ? rawEvents.find((e) => e.id === dialogState.editing!.id) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => navigate(-1)} disabled={mode === "agenda"}>
            ←
          </Button>
          <span className="min-w-[10rem] text-center text-sm font-medium text-gray-700">
            {mode === "month" ? format(anchorDate, "MMMM yyyy") : format(anchorDate, "MMM d, yyyy")}
          </span>
          <Button size="sm" variant="secondary" onClick={() => navigate(1)} disabled={mode === "agenda"}>
            →
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setAnchorDate(new Date())}>
            Today
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 p-0.5">
            {MODES.map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-md px-3 py-1 text-sm font-medium capitalize ${
                  mode === m ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          {canManage && (
            <Button size="sm" onClick={() => openCreate(anchorDate)}>
              + New event
            </Button>
          )}
        </div>
      </div>

      <CalendarView
        mode={mode}
        anchorDate={anchorDate}
        events={events}
        onEventClick={canManage ? openEdit : undefined}
        onDayClick={canManage ? openCreate : undefined}
      />

      {dialogState.open && canManage && (
        <EventFormDialog
          initialDate={dialogState.date}
          editing={editingRaw ?? null}
          onClose={() => setDialogState((s) => ({ ...s, open: false }))}
        />
      )}
    </div>
  );
}
