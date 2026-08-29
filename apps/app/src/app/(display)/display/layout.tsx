import { ProfileSwitcher } from "@/components/ProfileSwitcher";

export default function DisplayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <main>{children}</main>
      <div className="fixed bottom-4 right-4">
        <ProfileSwitcher />
      </div>
    </div>
  );
}
