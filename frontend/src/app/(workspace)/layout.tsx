import { AppShell } from "@/components/layout/AppShell";
import { AuthProvider } from "@/components/layout/AuthProvider";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider area="workspace">
      <AppShell>{children}</AppShell>
    </AuthProvider>
  );
}
