"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, PersonBadge } from "@household/ui";
import { can, type Role } from "@household/domain";
import { trpc } from "@/lib/trpc";
import { toFamilyMemberView } from "@/lib/viewModels";

const PRESET_COLORS = ["#2851A3", "#1F6F5C", "#6B3FA0", "#B5541F", "#9B2242", "#0E7C86", "#8C2F39", "#A8842A"];

export function FamilyPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const utils = trpc.useUtils();
  const membersQuery = trpc.familyMember.list.useQuery();
  const createMember = trpc.familyMember.create.useMutation({ onSuccess: () => utils.familyMember.list.invalidate() });
  const deleteMember = trpc.familyMember.delete.useMutation({ onSuccess: () => utils.familyMember.list.invalidate() });

  const members = membersQuery.data ?? [];
  const activeRole = (members.find((m) => m.id === session?.user.activeProfileId)?.role ?? "READONLY") as Role;
  const canCreate = can(activeRole, "familyMember", "create");
  const canDelete = can(activeRole, "familyMember", "delete");
  const canManageCalendars = can(activeRole, "calendarAccount", "create");

  const calendarStatus = searchParams.get("calendar");
  const calendarError = searchParams.get("calendarError");

  const calendarAccountsQuery = trpc.calendarAccount.list.useQuery(undefined, { enabled: canManageCalendars });
  const disconnectCalendar = trpc.calendarAccount.disconnect.useMutation({
    onSuccess: () => utils.calendarAccount.list.invalidate(),
  });
  const syncCalendar = trpc.calendarAccount.sync.useMutation({
    onSuccess: () => utils.calendarAccount.list.invalidate(),
  });
  const calendarAccounts = calendarAccountsQuery.data ?? [];

  const [name, setName] = React.useState("");
  const [role, setRole] = React.useState<"PARENT" | "CHILD">("CHILD");
  const [colorHex, setColorHex] = React.useState(PRESET_COLORS[0]);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [pin, setPin] = React.useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await createMember.mutateAsync({
      name,
      role,
      colorHex,
      email: role === "PARENT" ? email : undefined,
      password: role === "PARENT" ? password : undefined,
      pin: role === "CHILD" ? pin : undefined,
    });
    setName("");
    setEmail("");
    setPassword("");
    setPin("");
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-display text-2xl italic text-sapphire-800">Family</h1>

      {calendarStatus === "connected" && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">Google Calendar connected.</p>
      )}
      {calendarStatus === "error" && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          Couldn&apos;t connect Google Calendar{calendarError ? ` (${calendarError})` : ""}. Please try again.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {members.map((member) => (
          <Card key={member.id}>
            <CardHeader>
              <CardTitle>
                <PersonBadge person={toFamilyMemberView(member)} />
              </CardTitle>
              {canDelete && member.id !== session?.user.id && (
                <button
                  onClick={() => deleteMember.mutate({ id: member.id })}
                  className="text-xs text-red-500 hover:underline"
                >
                  Remove
                </button>
              )}
            </CardHeader>
            <CardContent>
              <p className="text-xs uppercase text-ink-400">{member.role}</p>
              {member.email && <p className="text-sm text-ink-600">{member.email}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {canCreate && (
        <Card>
          <CardHeader>
            <CardTitle>Add a family member</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="member-name">Name</Label>
                  <Input id="member-name" required value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="member-role">Role</Label>
                  <select
                    id="member-role"
                    className="h-10 w-full rounded-lg border border-ink-300 px-2 text-sm"
                    value={role}
                    onChange={(e) => setRole(e.target.value as "PARENT" | "CHILD")}
                  >
                    <option value="CHILD">Child</option>
                    <option value="PARENT">Parent</option>
                  </select>
                </div>
              </div>

              <div>
                <Label>Color</Label>
                <div className="flex gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColorHex(c)}
                      className="h-7 w-7 rounded-full ring-offset-2"
                      style={{ backgroundColor: c, boxShadow: colorHex === c ? `0 0 0 2px ${c}` : undefined }}
                    />
                  ))}
                </div>
              </div>

              {role === "PARENT" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="member-email">Email</Label>
                    <Input
                      id="member-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="member-password">Password</Label>
                    <Input
                      id="member-password"
                      type="password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <Label htmlFor="member-pin">4-digit PIN (for switching profiles on shared devices)</Label>
                  <Input
                    id="member-pin"
                    inputMode="numeric"
                    required
                    maxLength={4}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
              )}

              <Button type="submit">Add family member</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {canManageCalendars && (
        <Card>
          <CardHeader>
            <CardTitle>Calendar sync</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {calendarAccounts.length === 0 && (
              <p className="text-sm text-ink-400">No calendars connected yet.</p>
            )}
            {calendarAccounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-ink-200 p-3"
              >
                <div>
                  <p className="text-sm font-medium text-ink-900">{account.provider}</p>
                  <p className="text-xs text-ink-500">
                    {account.status === "connected" ? "Connected" : account.status}
                    {account.lastSyncedAt &&
                      ` · last synced ${new Date(account.lastSyncedAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => syncCalendar.mutate({ id: account.id })}
                    disabled={syncCalendar.isPending}
                    className="text-xs text-sapphire-600 hover:underline disabled:opacity-50"
                  >
                    Sync now
                  </button>
                  <button
                    onClick={() => disconnectCalendar.mutate({ id: account.id })}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            ))}
            <a href="/api/calendar/google/connect">
              <Button type="button" variant="secondary">
                Connect Google Calendar
              </Button>
            </a>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
