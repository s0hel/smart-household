"use client";

import * as React from "react";
import { addDays, addWeeks, format, startOfWeek } from "date-fns";
import { useSession } from "next-auth/react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, cn } from "@household/ui";
import { can, type Role } from "@household/domain";
import { trpc } from "@/lib/trpc";

const MEAL_TYPES = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"] as const;
type MealType = (typeof MEAL_TYPES)[number];

const MEAL_LABELS: Record<MealType, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
  SNACK: "Snack",
};

interface IngredientRow {
  name: string;
  quantity: string;
  category: string;
}

interface MemberOption {
  id: string;
  name: string;
  colorHex: string;
}

function AssignMealPopover({
  date,
  mealType,
  members,
  defaultAssigneeId = "",
  onClose,
  inline = false,
}: {
  date: Date;
  mealType: MealType;
  members: MemberOption[];
  /** Pre-selects who this meal is for; "" means the whole family. */
  defaultAssigneeId?: string;
  onClose: () => void;
  /** Renders in-flow (full width, no floating position) for the mobile day list. */
  inline?: boolean;
}) {
  const { data: recipes } = trpc.recipe.list.useQuery();
  const utils = trpc.useUtils();
  const upsert = trpc.mealPlan.upsert.useMutation({
    onSuccess: () => {
      utils.mealPlan.list.invalidate();
      utils.recipe.list.invalidate();
      onClose();
    },
  });

  const [assigneeId, setAssigneeId] = React.useState(defaultAssigneeId);
  const [recipeId, setRecipeId] = React.useState("");
  const [customTitle, setCustomTitle] = React.useState("");

  return (
    <div
      className={cn(
        "rounded-xl border border-ink-200 bg-surface p-3 shadow-lg",
        inline ? "mt-2 w-full" : "absolute z-10 mt-1 w-56",
      )}
    >
      <p className="mb-2 text-xs font-semibold text-ink-500">
        {MEAL_LABELS[mealType]} · {format(date, "EEE MMM d")}
      </p>
      {members.length > 0 && (
        <select
          className="mb-2 h-9 w-full rounded-lg border border-ink-300 px-2 text-sm"
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
        >
          <option value="">Whole family</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      )}
      <select
        className="mb-2 h-9 w-full rounded-lg border border-ink-300 px-2 text-sm"
        value={recipeId}
        onChange={(e) => {
          setRecipeId(e.target.value);
          if (e.target.value) setCustomTitle("");
        }}
      >
        <option value="">Pick a recipe...</option>
        {(recipes ?? []).map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <Input
        placeholder="...or a custom title"
        value={customTitle}
        onChange={(e) => {
          setCustomTitle(e.target.value);
          if (e.target.value) setRecipeId("");
        }}
        className="mb-2"
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!recipeId && !customTitle.trim()}
          onClick={() =>
            upsert.mutate({
              date,
              mealType,
              assigneeId: assigneeId || null,
              recipeId: recipeId || null,
              customTitle: customTitle.trim() || null,
            })
          }
        >
          Save
        </Button>
      </div>
    </div>
  );
}

function RecipeForm({ onClose }: { onClose: () => void }) {
  const utils = trpc.useUtils();
  const createRecipe = trpc.recipe.create.useMutation({
    onSuccess: () => {
      utils.recipe.list.invalidate();
      onClose();
    },
  });

  const [name, setName] = React.useState("");
  const [servings, setServings] = React.useState(4);
  const [ingredients, setIngredients] = React.useState<IngredientRow[]>([{ name: "", quantity: "", category: "" }]);

  function updateIngredient(index: number, patch: Partial<IngredientRow>) {
    setIngredients((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await createRecipe.mutateAsync({
      name,
      servings,
      ingredients: ingredients
        .filter((row) => row.name.trim())
        .map((row) => ({
          name: row.name.trim(),
          quantity: row.quantity.trim() || null,
          category: row.category.trim() || null,
        })),
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-ink-200 bg-surface p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="col-span-2">
          <Label htmlFor="recipe-name">Name</Label>
          <Input id="recipe-name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="recipe-servings">Servings</Label>
          <Input
            id="recipe-servings"
            type="number"
            min={1}
            value={servings}
            onChange={(e) => setServings(Number(e.target.value))}
          />
        </div>
      </div>

      <div>
        <Label>Ingredients</Label>
        <div className="space-y-2">
          {ingredients.map((row, i) => (
            <div key={i} className="flex flex-wrap gap-2">
              <Input
                placeholder="Ingredient"
                value={row.name}
                onChange={(e) => updateIngredient(i, { name: e.target.value })}
                className="flex-[2]"
              />
              <Input
                placeholder="Qty"
                value={row.quantity}
                onChange={(e) => updateIngredient(i, { quantity: e.target.value })}
                className="flex-1"
              />
              <Input
                placeholder="Category"
                value={row.category}
                onChange={(e) => updateIngredient(i, { category: e.target.value })}
                className="flex-1"
              />
              <button
                type="button"
                onClick={() => setIngredients((rows) => rows.filter((_, idx) => idx !== i))}
                className="px-1 text-xs text-red-500 hover:underline"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setIngredients((rows) => [...rows, { name: "", quantity: "", category: "" }])}
          className="mt-2 text-xs font-medium text-sapphire-600 hover:underline"
        >
          + Add ingredient
        </button>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" size="sm">
          Save recipe
        </Button>
      </div>
    </form>
  );
}

export function MealPlanPage({ variant = "web" }: { variant?: "web" | "mobile" } = {}) {
  const { data: session } = useSession();
  const { data: members } = trpc.familyMember.list.useQuery();
  const activeRole = (members?.find((m) => m.id === session?.user.activeProfileId)?.role ?? "READONLY") as Role;
  const canManage = can(activeRole, "mealPlanEntry", "create");
  const canGenerateList = can(activeRole, "list", "create");

  const [weekStart, setWeekStart] = React.useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const weekEnd = addDays(weekStart, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const [selectedDay, setSelectedDay] = React.useState(weekStart);
  const [selectedWeekStart, setSelectedWeekStart] = React.useState(weekStart);
  if (weekStart.getTime() !== selectedWeekStart.getTime()) {
    setSelectedWeekStart(weekStart);
    setSelectedDay(weekStart);
  }

  const utils = trpc.useUtils();
  const entriesQuery = trpc.mealPlan.list.useQuery({ from: weekStart, to: weekEnd });
  const deleteEntry = trpc.mealPlan.delete.useMutation({ onSuccess: () => utils.mealPlan.list.invalidate() });
  const generateList = trpc.mealPlan.generateGroceryList.useMutation({
    onSuccess: () => utils.list.list.invalidate(),
  });

  const [showRecipeForm, setShowRecipeForm] = React.useState(false);
  const [editingCell, setEditingCell] = React.useState<{ date: Date; mealType: MealType } | null>(null);

  const entries = entriesQuery.data ?? [];
  const memberOptions: MemberOption[] = members ?? [];

  function entriesFor(date: Date, mealType: MealType) {
    return entries.filter(
      (e) => new Date(e.date).toDateString() === date.toDateString() && e.mealType === mealType,
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl italic text-sapphire-800">Meal Plan</h1>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setWeekStart((d) => addWeeks(d, -1))}>
            ← Prev
          </Button>
          <span className="text-sm text-ink-600">
            {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d")}
          </span>
          <Button variant="secondary" size="sm" onClick={() => setWeekStart((d) => addWeeks(d, 1))}>
            Next →
          </Button>
        </div>
      </div>

      {variant === "mobile" ? (
        <div className="space-y-3">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {days.map((day) => {
              const active = day.toDateString() === selectedDay.toDateString();
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    "flex shrink-0 flex-col items-center rounded-xl px-3 py-2",
                    active ? "bg-sapphire-600 text-white" : "bg-ink-50 text-ink-600",
                  )}
                >
                  <span className="text-[11px] font-medium uppercase">{format(day, "EEE")}</span>
                  <span className="text-sm font-semibold">{format(day, "d")}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-2">
            {MEAL_TYPES.map((mealType) => {
              const mealEntries = entriesFor(selectedDay, mealType);
              const isEditing =
                editingCell?.mealType === mealType && editingCell.date.toDateString() === selectedDay.toDateString();
              return (
                <div key={mealType} className="rounded-xl border border-ink-200 bg-surface p-3">
                  <p className="mb-1 text-xs font-semibold uppercase text-ink-400">{MEAL_LABELS[mealType]}</p>
                  {mealEntries.length > 0 && (
                    <div className="space-y-1">
                      {mealEntries.map((entry) => (
                        <div key={entry.id} className="flex items-center justify-between gap-2">
                          <span className="text-sm text-sapphire-900">
                            {entry.assignee && (
                              <span
                                className="mr-1.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white"
                                style={{ backgroundColor: entry.assignee.colorHex }}
                              >
                                {entry.assignee.name}
                              </span>
                            )}
                            {entry.recipe?.name ?? entry.customTitle}
                          </span>
                          {canManage && (
                            <button
                              onClick={() => deleteEntry.mutate({ id: entry.id })}
                              className="text-xs text-red-500 opacity-70"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {canManage && !isEditing && (
                    <button
                      type="button"
                      onClick={() => setEditingCell({ date: selectedDay, mealType })}
                      className="mt-1 flex h-8 items-center text-sm text-ink-400"
                    >
                      + Add{mealEntries.length > 0 ? " another" : ""}
                    </button>
                  )}
                  {isEditing && (
                    <AssignMealPopover
                      date={selectedDay}
                      mealType={mealType}
                      members={memberOptions}
                      onClose={() => setEditingCell(null)}
                      inline
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto pt-4">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="w-24 text-left text-xs font-semibold uppercase text-ink-400">Meal</th>
                  {days.map((day) => (
                    <th key={day.toISOString()} className="px-1 pb-2 text-center text-xs font-semibold text-ink-600">
                      {format(day, "EEE")}
                      <div className="font-normal text-ink-400">{format(day, "MMM d")}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MEAL_TYPES.map((mealType) => (
                  <tr key={mealType} className="border-t border-ink-100">
                    <td className="py-2 text-xs font-semibold uppercase text-ink-400">{MEAL_LABELS[mealType]}</td>
                    {days.map((day) => {
                      const mealEntries = entriesFor(day, mealType);
                      const isEditing =
                        editingCell?.mealType === mealType && editingCell.date.toDateString() === day.toDateString();
                      return (
                        <td key={day.toISOString()} className="relative px-1 py-1 align-top">
                          {mealEntries.length > 0 && (
                            <div className="space-y-1">
                              {mealEntries.map((entry) => (
                                <div
                                  key={entry.id}
                                  className="group relative rounded-lg bg-sapphire-50 px-2 py-1.5 text-xs text-sapphire-900"
                                >
                                  {entry.assignee && (
                                    <span
                                      className="mr-1 inline-block rounded-full px-1 py-0.5 text-[9px] font-semibold text-white"
                                      style={{ backgroundColor: entry.assignee.colorHex }}
                                    >
                                      {entry.assignee.name}
                                    </span>
                                  )}
                                  {entry.recipe?.name ?? entry.customTitle}
                                  {canManage && (
                                    <button
                                      onClick={() => deleteEntry.mutate({ id: entry.id })}
                                      className="absolute right-1 top-1 text-red-500 opacity-0 group-hover:opacity-100"
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {canManage && !isEditing && (
                            <button
                              onClick={() => setEditingCell({ date: day, mealType })}
                              className="mt-1 flex h-7 w-full items-center justify-center rounded-lg text-ink-300 hover:bg-ink-50 hover:text-ink-500"
                            >
                              +
                            </button>
                          )}
                          {isEditing && (
                            <AssignMealPopover
                              date={day}
                              mealType={mealType}
                              members={memberOptions}
                              onClose={() => setEditingCell(null)}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {canGenerateList && (
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            disabled={generateList.isPending}
            onClick={() => generateList.mutate({ from: weekStart, to: weekEnd })}
          >
            Generate grocery list for this week
          </Button>
          {generateList.isSuccess && (
            <p className="text-sm text-green-700">
              Added &quot;{generateList.data.name}&quot; to <a href="/lists" className="underline">Lists</a>.
            </p>
          )}
          {generateList.isError && <p className="text-sm text-red-600">{generateList.error.message}</p>}
        </div>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-400">Recipes</h2>
          {canManage && !showRecipeForm && (
            <Button size="sm" variant="secondary" onClick={() => setShowRecipeForm(true)}>
              + Add recipe
            </Button>
          )}
        </div>

        {showRecipeForm && <RecipeForm onClose={() => setShowRecipeForm(false)} />}

        <RecipeList />
      </section>
    </div>
  );
}

function RecipeList() {
  const recipesQuery = trpc.recipe.list.useQuery();
  const utils = trpc.useUtils();
  const deleteRecipe = trpc.recipe.delete.useMutation({ onSuccess: () => utils.recipe.list.invalidate() });
  const { data: session } = useSession();
  const { data: members } = trpc.familyMember.list.useQuery();
  const activeRole = (members?.find((m) => m.id === session?.user.activeProfileId)?.role ?? "READONLY") as Role;
  const canDelete = can(activeRole, "recipe", "delete");

  const recipes = recipesQuery.data ?? [];

  return (
    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {recipes.map((recipe) => (
        <Card key={recipe.id}>
          <CardHeader>
            <CardTitle>{recipe.name}</CardTitle>
            {canDelete && (
              <button onClick={() => deleteRecipe.mutate({ id: recipe.id })} className="text-xs text-red-500 hover:underline">
                Delete
              </button>
            )}
          </CardHeader>
          <CardContent>
            {recipe.servings && <p className="mb-1 text-xs text-ink-400">Serves {recipe.servings}</p>}
            <ul className="space-y-0.5 text-sm text-ink-600">
              {recipe.ingredients.map((ing) => (
                <li key={ing.id}>
                  {ing.name}
                  {ing.quantity && <span className="text-ink-400"> · {ing.quantity}</span>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
      {recipes.length === 0 && <p className="text-sm text-ink-400">No recipes yet.</p>}
    </div>
  );
}
