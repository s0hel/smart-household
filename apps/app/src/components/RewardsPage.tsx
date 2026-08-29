"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, PersonBadge } from "@household/ui";
import { can, type Role } from "@household/domain";
import { trpc } from "@/lib/trpc";
import { toFamilyMemberView } from "@/lib/viewModels";

function RewardForm({ onClose }: { onClose: () => void }) {
  const utils = trpc.useUtils();
  const createReward = trpc.reward.create.useMutation({
    onSuccess: () => {
      utils.reward.list.invalidate();
      onClose();
    },
  });

  const [name, setName] = React.useState("");
  const [costPoints, setCostPoints] = React.useState(50);
  const [requiresApproval, setRequiresApproval] = React.useState(true);

  return (
    <form
      className="space-y-3 rounded-2xl border border-ink-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        createReward.mutate({ name, costPoints, requiresApproval });
        setName("");
      }}
    >
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Label htmlFor="reward-name">Name</Label>
          <Input id="reward-name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="reward-cost">Points</Label>
          <Input
            id="reward-cost"
            type="number"
            min={1}
            value={costPoints}
            onChange={(e) => setCostPoints(Number(e.target.value))}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-ink-600">
        <input
          type="checkbox"
          checked={requiresApproval}
          onChange={(e) => setRequiresApproval(e.target.checked)}
          className="h-4 w-4 rounded border-ink-300"
        />
        Requires parent approval
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" size="sm">
          Add reward
        </Button>
      </div>
    </form>
  );
}

export function RewardsPage() {
  const { data: session } = useSession();
  const utils = trpc.useUtils();
  const { data: members } = trpc.familyMember.list.useQuery();
  const rewardsQuery = trpc.reward.list.useQuery();
  const balancesQuery = trpc.rewardRedemption.balances.useQuery();
  const redemptionsQuery = trpc.rewardRedemption.list.useQuery();

  const redeem = trpc.rewardRedemption.create.useMutation({
    onSuccess: () => {
      utils.rewardRedemption.list.invalidate();
      utils.rewardRedemption.balances.invalidate();
    },
  });
  const decide = trpc.rewardRedemption.decide.useMutation({
    onSuccess: () => {
      utils.rewardRedemption.list.invalidate();
      utils.rewardRedemption.balances.invalidate();
    },
  });
  const deleteReward = trpc.reward.delete.useMutation({ onSuccess: () => utils.reward.list.invalidate() });

  const [showRewardForm, setShowRewardForm] = React.useState(false);

  const activeProfileId = session?.user.activeProfileId;
  const activeRole = (members?.find((m) => m.id === activeProfileId)?.role ?? "READONLY") as Role;
  const canManageRewards = can(activeRole, "reward", "create");
  const canApprove = can(activeRole, "rewardRedemption", "approve");

  const rewards = rewardsQuery.data ?? [];
  const balances = balancesQuery.data ?? [];
  const redemptions = redemptionsQuery.data ?? [];
  const myBalance = balances.find((b) => b.userId === activeProfileId)?.balance ?? 0;
  const pending = redemptions.filter((r) => r.status === "PENDING");
  const decided = redemptions.filter((r) => r.status !== "PENDING").slice(0, 10);

  function balanceFor(userId: string) {
    return balances.find((b) => b.userId === userId)?.balance ?? 0;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl italic text-sapphire-800">Rewards</h1>
        <div className="rounded-full bg-gold-50 px-4 py-1.5 text-sm font-semibold text-gold-700">
          {myBalance} points
        </div>
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-400">Catalog</h2>
          {canManageRewards && !showRewardForm && (
            <Button size="sm" variant="secondary" onClick={() => setShowRewardForm(true)}>
              + Add reward
            </Button>
          )}
        </div>
        {showRewardForm && <RewardForm onClose={() => setShowRewardForm(false)} />}

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rewards.map((reward) => {
            const affordable = myBalance >= reward.costPoints;
            return (
              <Card key={reward.id}>
                <CardHeader>
                  <CardTitle>{reward.name}</CardTitle>
                  {canManageRewards && (
                    <button
                      onClick={() => deleteReward.mutate({ id: reward.id })}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm font-medium text-ink-700">{reward.costPoints} points</p>
                  {reward.description && <p className="text-sm text-ink-500">{reward.description}</p>}
                  <Button
                    size="sm"
                    disabled={!affordable || redeem.isPending}
                    onClick={() => redeem.mutate({ rewardId: reward.id })}
                  >
                    {affordable ? "Redeem" : "Not enough points"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
          {rewards.length === 0 && <p className="text-sm text-ink-400">No rewards set up yet.</p>}
        </div>
      </section>

      {canApprove && pending.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-400">Pending approval</h2>
          <div className="space-y-2">
            {pending.map((redemption) => (
              <Card key={redemption.id}>
                <CardContent className="flex items-center justify-between pt-4">
                  <div className="flex items-center gap-3">
                    <PersonBadge person={toFamilyMemberView(redemption.user)} size="sm" />
                    <span className="text-sm text-ink-700">
                      wants <strong>{redemption.reward.name}</strong> ({redemption.reward.costPoints} pts · has{" "}
                      {balanceFor(redemption.userId)})
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="danger" onClick={() => decide.mutate({ id: redemption.id, approve: false })}>
                      Deny
                    </Button>
                    <Button size="sm" onClick={() => decide.mutate({ id: redemption.id, approve: true })}>
                      Approve
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {decided.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-400">Recent activity</h2>
          <div className="space-y-1.5">
            {decided.map((redemption) => (
              <div key={redemption.id} className="flex items-center gap-2 text-sm text-ink-500">
                <PersonBadge person={toFamilyMemberView(redemption.user)} size="sm" showName={false} />
                <span>
                  <span style={{ color: redemption.user.colorHex }}>{redemption.user.name}</span> —{" "}
                  {redemption.reward.name} —{" "}
                  <span className={redemption.status === "APPROVED" ? "text-green-600" : "text-red-500"}>
                    {redemption.status.toLowerCase()}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
