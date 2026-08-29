"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { Button, Input, ListCard } from "@household/ui";
import { can, type Role } from "@household/domain";
import { trpc } from "@/lib/trpc";
import { toListView } from "@/lib/viewModels";

function AddItemRow({ listId }: { listId: string }) {
  const [label, setLabel] = React.useState("");
  const utils = trpc.useUtils();
  const addItem = trpc.list.addItem.useMutation({
    onSuccess: () => {
      utils.list.list.invalidate();
      setLabel("");
    },
  });

  return (
    <form
      className="mt-2 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (label.trim()) addItem.mutate({ listId, label });
      }}
    >
      <Input placeholder="Add item..." value={label} onChange={(e) => setLabel(e.target.value)} />
      <Button type="submit" size="sm">
        Add
      </Button>
    </form>
  );
}

export function ListsPage() {
  const { data: session } = useSession();
  const utils = trpc.useUtils();
  const listsQuery = trpc.list.list.useQuery();
  const { data: members } = trpc.familyMember.list.useQuery();
  const createList = trpc.list.create.useMutation({ onSuccess: () => utils.list.list.invalidate() });
  const toggleItem = trpc.list.toggleItem.useMutation({ onSuccess: () => utils.list.list.invalidate() });
  const deleteList = trpc.list.delete.useMutation({ onSuccess: () => utils.list.list.invalidate() });

  const [newListName, setNewListName] = React.useState("");

  const lists = listsQuery.data ?? [];
  const activeRole = (members?.find((m) => m.id === session?.user.activeProfileId)?.role ?? "READONLY") as Role;
  const canCreateList = can(activeRole, "list", "create");
  const canDeleteList = can(activeRole, "list", "delete");
  const canAddItem = can(activeRole, "listItem", "create");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl italic text-sapphire-800">Lists</h1>
        {canCreateList && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (newListName.trim()) {
                createList.mutate({ name: newListName, type: "CUSTOM" });
                setNewListName("");
              }
            }}
          >
            <Input placeholder="New list name" value={newListName} onChange={(e) => setNewListName(e.target.value)} />
            <Button type="submit">Create list</Button>
          </form>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {lists.map((list) => (
          <div key={list.id}>
            <ListCard
              list={toListView(list)}
              onToggleItem={(itemId, checked) => toggleItem.mutate({ id: itemId, checked })}
              onDelete={canDeleteList ? () => deleteList.mutate({ id: list.id }) : undefined}
            />
            {canAddItem && (
              <div className="px-5 pb-4">
                <AddItemRow listId={list.id} />
              </div>
            )}
          </div>
        ))}
        {lists.length === 0 && <p className="text-sm text-ink-400">No lists yet.</p>}
      </div>
    </div>
  );
}
