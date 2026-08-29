"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, PersonBadge } from "@household/ui";
import { can, type Role } from "@household/domain";
import { trpc } from "@/lib/trpc";
import { toFamilyMemberView } from "@/lib/viewModels";

const PRESET_COLORS = ["#3B82F6", "#22C55E", "#A855F7", "#F97316", "#EC4899", "#14B8A6", "#EF4444", "#EAB308"];

export function FamilyPage() {
  const { data: session } = useSession();
  const utils = trpc.useUtils();
  const membersQuery = trpc.familyMember.list.useQuery();
  const createMember = trpc.familyMember.create.useMutation({ onSuccess: () => utils.familyMember.list.invalidate() });
  const deleteMember = trpc.familyMember.delete.useMutation({ onSuccess: () => utils.familyMember.list.invalidate() });

  const members = membersQuery.data ?? [];
  const activeRole = (members.find((m) => m.id === session?.user.activeProfileId)?.role ?? "READONLY") as Role;
  const canCreate = can(activeRole, "familyMember", "create");
  const canDelete = can(activeRole, "familyMember", "delete");

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
      <h1 className="text-2xl font-bold text-gray-900">Family</h1>

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
              <p className="text-xs uppercase text-gray-400">{member.role}</p>
              {member.email && <p className="text-sm text-gray-600">{member.email}</p>}
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
                    className="h-10 w-full rounded-lg border border-gray-300 px-2 text-sm"
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
    </div>
  );
}
