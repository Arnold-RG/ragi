import { AuthProvider } from "@/components/layout/AuthProvider";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider area="portal">{children}</AuthProvider>;
}
