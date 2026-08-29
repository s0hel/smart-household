import Link from "next/link";

const NAV = [
  { href: "/m", label: "Home", icon: "🏠" },
  { href: "/m/calendar", label: "Calendar", icon: "📅" },
  { href: "/m/tasks", label: "Tasks", icon: "✅" },
  { href: "/m/lists", label: "Lists", icon: "🛒" },
];

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-gray-50">
      <main className="flex-1 overflow-y-auto p-4 pb-20">{children}</main>
      <nav className="fixed bottom-0 left-1/2 flex w-full max-w-md -translate-x-1/2 justify-around border-t border-gray-200 bg-white py-2">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className="flex flex-col items-center text-xs text-gray-600">
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
