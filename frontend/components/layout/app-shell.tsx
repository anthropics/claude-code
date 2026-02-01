"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, useAppStore } from "@/lib/store";
import { authApi, brandApi, subscriptionApi } from "@/lib/api";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading, setUser, setLoading, accessToken } = useAuthStore();
  const { sidebarOpen, setCurrentBrand, setSubscription } = useAppStore();

  useEffect(() => {
    const initAuth = async () => {
      if (!accessToken) {
        setLoading(false);
        router.push("/auth/login");
        return;
      }

      try {
        // Fetch user data
        const user = await authApi.getMe();
        setUser(user);

        // Fetch brands and set current
        const brandsRes = await brandApi.list();
        if (brandsRes.results.length > 0) {
          setCurrentBrand(brandsRes.results[0]);
        }

        // Fetch subscription
        const subscription = await subscriptionApi.getCurrent();
        setSubscription(subscription);
      } catch (error) {
        console.error("Auth init failed:", error);
        router.push("/auth/login");
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, [accessToken, router, setUser, setLoading, setCurrentBrand, setSubscription]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div
        className={cn(
          "transition-all duration-300",
          sidebarOpen ? "ml-64" : "ml-16"
        )}
      >
        <Header />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
