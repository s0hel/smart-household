import { AppShell } from "@/components/AppShell";

export default function WebLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
