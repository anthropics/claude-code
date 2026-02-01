"use client";

import { useAuthStore, useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";
import { useRouter } from "next/navigation";

export function Header() {
  const { user, logout } = useAuthStore();
  const { currentBrand, subscription } = useAppStore();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/auth/login");
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-6">
      <div className="flex items-center gap-4">
        {currentBrand && (
          <div className="text-sm">
            <span className="text-muted-foreground">Brand:</span>{" "}
            <span className="font-medium">{currentBrand.name}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        {subscription && (
          <div className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">
            {subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)} Plan
            {subscription.generations_remaining !== -1 && (
              <span className="ml-2 text-muted-foreground">
                {subscription.generations_remaining} generations left
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-md bg-secondary px-3 py-1.5">
            <User className="h-4 w-4" />
            <span className="text-sm">{user?.email}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
