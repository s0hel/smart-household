"use client";

import * as React from "react";
import { signOut, useSession } from "next-auth/react";
import { Button, PersonBadge, cn } from "@household/ui";
import { trpc } from "@/lib/trpc";
import { toFamilyMemberView } from "@/lib/viewModels";
import { ChevronLeftIcon } from "./NavIcons";

export function ProfileSwitcher({
  dropDirection = "up",
  triggerClassName,
  collapsed = false,
  variant = "nav",
}: {
  dropDirection?: "up" | "down";
  triggerClassName?: string;
  collapsed?: boolean;
  /** "pill" renders a bordered button with an explicit "Switch" label, for placing outside the main nav. */
  variant?: "nav" | "pill";
} = {}) {
  const { data: session, update } = useSession();
  const { data: members } = trpc.familyMember.list.useQuery(undefined, { enabled: !!session });
  const utils = trpc.useUtils();

  const [open, setOpen] = React.useState(false);

  if (!session || !members) return null;

  const activeProfile = members.find((m) => m.id === session.user.activeProfileId);

  async function selectMember(memberId: string, role: string) {
    if (role !== "CHILD" && memberId !== session!.user.id) {
      // Switching to another adult requires their own password — not supported
      // from the profile switcher by design.
      return;
    }
    await update({ activeProfileId: memberId });
    await utils.invalidate();
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={collapsed ? activeProfile?.name : undefined}
        className={cn(
          "flex items-center gap-2 rounded-xl p-2 text-left hover:bg-ink-100",
          collapsed && "justify-center",
          variant === "pill" &&
            "rounded-full border border-ink-200 bg-white py-1.5 pl-1.5 pr-3 shadow-sm hover:bg-ink-50",
          triggerClassName ?? "w-full",
        )}
      >
        {activeProfile && <PersonBadge person={toFamilyMemberView(activeProfile)} showName={!collapsed} />}
        {variant === "pill" && (
          <>
            <span className="text-sm font-medium text-ink-600">Switch</span>
            <ChevronLeftIcon className="h-3.5 w-3.5 -rotate-90 text-ink-400" />
          </>
        )}
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-10 w-64 rounded-xl border border-ink-200 bg-white p-2 shadow-lg",
            dropDirection === "up" ? "bottom-full left-0 mb-2" : "right-0 top-full mt-2",
          )}
        >
          <ul className="space-y-1">
            {members.map((member) => (
              <li key={member.id}>
                <button
                  type="button"
                  onClick={() => selectMember(member.id, member.role)}
                  disabled={member.role !== "CHILD" && member.id !== session.user.id}
                  className="flex w-full items-center justify-between rounded-lg p-2 text-left hover:bg-ink-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <PersonBadge person={toFamilyMemberView(member)} />
                  {member.id === session.user.activeProfileId && (
                    <span className="text-xs text-sapphire-600">Active</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-2 border-t border-ink-100 pt-2">
            <Button size="sm" variant="ghost" className="w-full justify-start" onClick={() => signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
