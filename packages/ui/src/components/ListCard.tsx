import * as React from "react";
import { cn } from "../cn";
import type { ListView } from "../types";
import { Checkbox } from "./Checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "./Card";

export function ListCard({
  list,
  onToggleItem,
  onDelete,
  className,
}: {
  list: ListView;
  onToggleItem?: (itemId: string, checked: boolean) => void;
  onDelete?: () => void;
  className?: string;
}) {
  const categories = Array.from(new Set(list.items.map((i) => i.category ?? "Other")));

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{list.name}</CardTitle>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            {list.items.filter((i) => i.checked).length}/{list.items.length}
          </span>
          {onDelete && (
            <button onClick={onDelete} className="text-xs text-red-500 hover:underline">
              Delete
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {categories.map((category) => (
          <div key={category}>
            {list.type === "GROCERY" && <p className="mb-1 text-xs font-semibold uppercase text-gray-400">{category}</p>}
            <ul className="space-y-1.5">
              {list.items
                .filter((item) => (item.category ?? "Other") === category)
                .map((item) => (
                  <li key={item.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={item.checked}
                      onChange={(e) => onToggleItem?.(item.id, e.target.checked)}
                    />
                    <span className={cn("text-sm text-gray-800", item.checked && "text-gray-400 line-through")}>
                      {item.label}
                      {item.quantity && <span className="text-gray-400"> · {item.quantity}</span>}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        ))}
        {list.items.length === 0 && <p className="text-sm text-gray-400">No items yet.</p>}
      </CardContent>
    </Card>
  );
}
