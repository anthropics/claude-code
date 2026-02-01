import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, Brand, Subscription } from "@/types";

// =============================================================================
// Auth Store
// =============================================================================

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setUser: (user: User | null) => void;
  setTokens: (access: string, refresh: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true,

      setUser: (user) =>
        set({ user, isAuthenticated: !!user, isLoading: false }),

      setTokens: (access, refresh) =>
        set({ accessToken: access, refreshToken: refresh, isAuthenticated: true }),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        }),

      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
);

// =============================================================================
// App Store (current brand, etc.)
// =============================================================================

interface AppState {
  currentBrand: Brand | null;
  subscription: Subscription | null;
  sidebarOpen: boolean;

  setCurrentBrand: (brand: Brand | null) => void;
  setSubscription: (subscription: Subscription | null) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentBrand: null,
      subscription: null,
      sidebarOpen: true,

      setCurrentBrand: (brand) => set({ currentBrand: brand }),
      setSubscription: (subscription) => set({ subscription }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
    }),
    {
      name: "app-storage",
      partialize: (state) => ({
        currentBrand: state.currentBrand,
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
);

// =============================================================================
// Job Tracking Store
// =============================================================================

interface JobState {
  activeJobs: Map<string, { type: string; progress: number; status: string }>;
  addJob: (id: string, type: string) => void;
  updateJob: (id: string, progress: number, status: string) => void;
  removeJob: (id: string) => void;
  clearJobs: () => void;
}

export const useJobStore = create<JobState>((set) => ({
  activeJobs: new Map(),

  addJob: (id, type) =>
    set((state) => {
      const jobs = new Map(state.activeJobs);
      jobs.set(id, { type, progress: 0, status: "queued" });
      return { activeJobs: jobs };
    }),

  updateJob: (id, progress, status) =>
    set((state) => {
      const jobs = new Map(state.activeJobs);
      const job = jobs.get(id);
      if (job) {
        jobs.set(id, { ...job, progress, status });
      }
      return { activeJobs: jobs };
    }),

  removeJob: (id) =>
    set((state) => {
      const jobs = new Map(state.activeJobs);
      jobs.delete(id);
      return { activeJobs: jobs };
    }),

  clearJobs: () => set({ activeJobs: new Map() }),
}));
