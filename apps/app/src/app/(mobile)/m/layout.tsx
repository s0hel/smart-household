import Link from "next/link";

const NAV = [
  { href: "/m", label: "Home", icon: "🏠" },
  { href: "/m/calendar", label: "Calendar", icon: "📅" },
  { href: "/m/tasks", label: "Tasks", icon: "✅" },
  { href: "/m/lists", label: "Lists", icon: "🛒" },
  { href: "/m/meal-plan", label: "Meals", icon: "🍽️" },
  { href: "/m/rewards", label: "Rewards", icon: "🎁" },
  { href: "/m/family", label: "Family", icon: "👪" },
];

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-paper">
      <main className="flex-1 overflow-y-auto p-4 pb-20">{children}</main>
      <nav className="fixed bottom-0 left-1/2 flex w-full max-w-md -translate-x-1/2 gap-1 overflow-x-auto border-t-2 border-gold-400 bg-white py-2">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-1 shrink-0 basis-0 flex-col items-center whitespace-nowrap text-xs text-ink-600"
          >
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
