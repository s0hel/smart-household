import * as React from "react";
import { format, isSameDay } from "date-fns";
import type { EventView } from "../../types";
import { EventCard } from "../EventCard";
import { eventDisplayDate } from "./calendarMath";

export function AgendaView({
  events,
  onEventClick,
}: {
  events: EventView[];
  onEventClick?: (event: EventView) => void;
}) {
  const sorted = [...events].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  const groups: { day: Date; events: EventView[] }[] = [];
  for (const event of sorted) {
    const day = eventDisplayDate(event);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && isSameDay(lastGroup.day, day)) {
      lastGroup.events.push(event);
    } else {
      groups.push({ day, events: [event] });
    }
  }

  if (groups.length === 0) {
    return <p className="p-6 text-center text-sm text-ink-400">No upcoming events.</p>;
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.day.toISOString()}>
          <p className="mb-2 text-sm font-semibold text-ink-500">{format(group.day, "EEEE, MMMM d")}</p>
          <div className="space-y-2">
            {group.events.map((event) => (
              <EventCard key={event.id} event={event} onClick={() => onEventClick?.(event)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
