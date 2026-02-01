"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { Mic } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, accessToken } = useAuthStore();

  useEffect(() => {
    if (accessToken && isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, accessToken, router]);

  return (
    <div className="min-h-screen flex">
      {/* Left side - branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary p-12 flex-col justify-between">
        <div className="flex items-center gap-2 text-white">
          <Mic className="h-8 w-8" />
          <span className="text-2xl font-bold">Creator Studio</span>
        </div>
        <div className="text-white">
          <h1 className="text-4xl font-bold mb-4">
            Record once,
            <br />
            content everywhere.
          </h1>
          <p className="text-lg opacity-90">
            AI-powered content creation for podcasters and creators.
            Turn one recording into weeks of platform-native content.
          </p>
        </div>
        <div className="text-white/60 text-sm">
          Trusted by 1,000+ creators worldwide
        </div>
      </div>

      {/* Right side - form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
