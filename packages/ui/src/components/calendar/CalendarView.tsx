import * as React from "react";
import type { EventView } from "../../types";
import { DayView } from "./DayView";
import { WeekView } from "./WeekView";
import { MonthView } from "./MonthView";
import { AgendaView } from "./AgendaView";

export type CalendarMode = "day" | "week" | "month" | "agenda";

export function CalendarView({
  mode,
  anchorDate,
  events,
  onEventClick,
  onDayClick,
}: {
  mode: CalendarMode;
  anchorDate: Date;
  events: EventView[];
  onEventClick?: (event: EventView) => void;
  onDayClick?: (day: Date) => void;
}) {
  switch (mode) {
    case "day":
      return <DayView day={anchorDate} events={events} onEventClick={onEventClick} />;
    case "week":
      return <WeekView weekOf={anchorDate} events={events} onEventClick={onEventClick} />;
    case "month":
      return <MonthView monthOf={anchorDate} events={events} onEventClick={onEventClick} onDayClick={onDayClick} />;
    case "agenda":
      return <AgendaView events={events} onEventClick={onEventClick} />;
  }
}
