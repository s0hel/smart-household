import * as React from "react";
import { cn } from "../cn";
import type { FamilyMemberView } from "../types";

export function PersonBadge({
  person,
  size = "md",
  showName = true,
  className,
}: {
  person: FamilyMemberView;
  size?: "sm" | "md";
  showName?: boolean;
  className?: string;
}) {
  const dimension = size === "sm" ? "h-5 w-5 text-[10px]" : "h-7 w-7 text-xs";
  const initial = person.name.charAt(0).toUpperCase();

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className={cn("flex items-center justify-center rounded-full font-semibold text-white", dimension)}
        style={{ backgroundColor: person.colorHex }}
        aria-hidden={showName}
      >
        {person.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={person.avatarUrl} alt={person.name} className="h-full w-full rounded-full object-cover" />
        ) : (
          initial
        )}
      </span>
      {showName && <span className="text-sm font-medium text-gray-700">{person.name}</span>}
    </span>
  );
}
