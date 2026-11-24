"use client";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, type ReactNode } from "react";
import useSWR from "swr";
import { ApiError, fetcher } from "@/lib/api";

export interface Me { id: string; email: string; full_name: string; role: string; mfa_enabled: boolean; client_id: string | null }

const Ctx = createContext<Me | null>(null);
export const useMe = () => useContext(Ctx);

export function AuthProvider({ children, area }: { children: ReactNode; area: "workspace" | "portal" }) {
  const router = useRouter();
  const { data, error, isLoading } = useSWR<Me>("/auth/me", fetcher, { shouldRetryOnError: false, revalidateOnFocus: false });
  useEffect(() => {
    if (error instanceof ApiError && error.status === 401) router.replace("/login");
    if (data && area === "workspace" && data.role === "client") router.replace("/portal");
    if (data && area === "portal" && data.role !== "client") router.replace("/dashboard");
  }, [error, data, area, router]);
  if (isLoading || !data || (area === "workspace" && data.role === "client")) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="flex items-center gap-3 text-sm text-muted">
          <span className="h-2 w-2 rounded-full bg-accent" /> Opening RAGI…
        </div>
      </div>
    );
  }
  return <Ctx.Provider value={data}>{children}</Ctx.Provider>;
}
