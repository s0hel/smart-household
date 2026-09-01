import { ThemeToggle } from "@household/ui";
import { ProfileSwitcher } from "@/components/ProfileSwitcher";

export default function DisplayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <main>{children}</main>
      <div className="fixed bottom-4 right-4 flex items-end gap-2">
        <ThemeToggle collapsed dropDirection="up" />
        <ProfileSwitcher />
      </div>
    </div>
  );
}
