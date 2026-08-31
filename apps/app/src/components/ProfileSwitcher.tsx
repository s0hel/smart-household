"use client";

import * as React from "react";
import { signOut, useSession } from "next-auth/react";
import { Button, Input, PersonBadge, cn } from "@household/ui";
import { trpc } from "@/lib/trpc";
import { toFamilyMemberView } from "@/lib/viewModels";

export function ProfileSwitcher({
  dropDirection = "up",
  triggerClassName,
}: {
  dropDirection?: "up" | "down";
  triggerClassName?: string;
} = {}) {
  const { data: session, update } = useSession();
  const { data: members } = trpc.familyMember.list.useQuery(undefined, { enabled: !!session });
  const verifyPin = trpc.familyMember.verifyPin.useMutation();
  const utils = trpc.useUtils();

  const [open, setOpen] = React.useState(false);
  const [pinTarget, setPinTarget] = React.useState<string | null>(null);
  const [pin, setPin] = React.useState("");
  const [pinError, setPinError] = React.useState<string | null>(null);

  if (!session || !members) return null;

  const activeProfile = members.find((m) => m.id === session.user.activeProfileId);

  async function selectMember(memberId: string, role: string) {
    if (memberId === session!.user.id) {
      await update({ activeProfileId: memberId });
      await utils.invalidate();
      setOpen(false);
      return;
    }
    if (role === "CHILD") {
      setPinTarget(memberId);
      setPinError(null);
      return;
    }
    // Switching to another adult requires their own password — not supported
    // from the profile switcher by design.
  }

  async function submitPin(e: React.FormEvent) {
    e.preventDefault();
    if (!pinTarget) return;
    try {
      await verifyPin.mutateAsync({ userId: pinTarget, pin });
      await update({ activeProfileId: pinTarget });
      await utils.invalidate();
      setPinTarget(null);
      setPin("");
      setOpen(false);
    } catch {
      setPinError("Incorrect PIN");
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 rounded-xl p-2 text-left hover:bg-ink-100",
          triggerClassName ?? "w-full",
        )}
      >
        {activeProfile && <PersonBadge person={toFamilyMemberView(activeProfile)} />}
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-10 w-64 rounded-xl border border-ink-200 bg-white p-2 shadow-lg",
            dropDirection === "up" ? "bottom-full left-0 mb-2" : "right-0 top-full mt-2",
          )}
        >
          {pinTarget ? (
            <form onSubmit={submitPin} className="space-y-2 p-2">
              <p className="text-sm font-medium text-ink-700">Enter PIN</p>
              <Input
                autoFocus
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              />
              {pinError && <p className="text-xs text-red-600">{pinError}</p>}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={pin.length !== 4}>
                  Switch
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => setPinTarget(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <>
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
