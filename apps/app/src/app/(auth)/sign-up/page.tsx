"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button, Input, Label } from "@household/ui";
import { trpc } from "@/lib/trpc";

export default function SignUpPage() {
  const router = useRouter();
  const signUp = trpc.household.signUp.useMutation();
  const [householdName, setHouseholdName] = React.useState("");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await signUp.mutateAsync({ householdName, name, email, password });
    const result = await signIn("credentials", { email, password, redirect: false });
    if (!result?.error) {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="rounded-2xl border-t-4 border-gold-400 bg-surface p-8 shadow-sm">
      <h1 className="mb-6 font-display text-2xl italic text-sapphire-800">Create your household</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="householdName">Household name</Label>
          <Input
            id="householdName"
            required
            placeholder="The Rahman Household"
            value={householdName}
            onChange={(e) => setHouseholdName(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="name">Your name</Label>
          <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {signUp.error && <p className="text-sm text-red-600">{signUp.error.message}</p>}
        <Button type="submit" className="w-full" disabled={signUp.isPending}>
          {signUp.isPending ? "Creating..." : "Create household"}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-ink-500">
        Already have a household?{" "}
        <a href="/sign-in" className="font-medium text-sapphire-600 hover:underline">
          Sign in
        </a>
      </p>
    </div>
  );
}
