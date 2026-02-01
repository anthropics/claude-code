import axios, { AxiosInstance, AxiosError } from "axios";
import { useAuthStore } from "./store";
import type {
  User,
  Brand,
  SourceSample,
  Transcript,
  Clip,
  ContentPlan,
  PlanItem,
  Draft,
  GenerationJob,
  Subscription,
  AuthTokens,
  PaginatedResponse,
  JobResponse,
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor - add auth token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && originalRequest) {
      const refreshToken = useAuthStore.getState().refreshToken;

      if (refreshToken) {
        try {
          const { data } = await axios.post<{ access: string }>(
            `${API_URL}/api/v1/auth/token/refresh/`,
            { refresh: refreshToken }
          );

          useAuthStore.getState().setTokens(data.access, refreshToken);
          originalRequest.headers.Authorization = `Bearer ${data.access}`;
          return api(originalRequest);
        } catch {
          useAuthStore.getState().logout();
        }
      }
    }

    return Promise.reject(error);
  }
);

// =============================================================================
// Auth API
// =============================================================================

export const authApi = {
  register: async (email: string, password: string, fullName?: string) => {
    const { data } = await api.post<User>("/auth/register/", {
      email,
      password,
      password_confirm: password,
      full_name: fullName || "",
    });
    return data;
  },

  login: async (email: string, password: string) => {
    const { data } = await api.post<AuthTokens>("/auth/token/", {
      email,
      password,
    });
    return data;
  },

  refreshToken: async (refresh: string) => {
    const { data } = await api.post<{ access: string }>("/auth/token/refresh/", {
      refresh,
    });
    return data;
  },

  getMe: async () => {
    const { data } = await api.get<User>("/auth/me/");
    return data;
  },

  updateMe: async (updates: Partial<User>) => {
    const { data } = await api.patch<User>("/auth/me/", updates);
    return data;
  },
};

// =============================================================================
// Brand API
// =============================================================================

export const brandApi = {
  list: async () => {
    const { data } = await api.get<PaginatedResponse<Brand>>("/brands/");
    return data;
  },

  get: async (id: string) => {
    const { data } = await api.get<Brand>(`/brands/${id}/`);
    return data;
  },

  create: async (brand: { name: string; niche?: string; target_audience?: string; primary_goal?: string }) => {
    const { data } = await api.post<Brand>("/brands/", brand);
    return data;
  },

  update: async (id: string, updates: Partial<Brand>) => {
    const { data } = await api.patch<Brand>(`/brands/${id}/`, updates);
    return data;
  },

  delete: async (id: string) => {
    await api.delete(`/brands/${id}/`);
  },

  learnVoice: async (id: string) => {
    const { data } = await api.post<JobResponse>(`/brands/${id}/learn_voice/`);
    return data;
  },

  generatePlan: async (
    id: string,
    params: { week_start: string; platforms: string[]; posts_per_day: number }
  ) => {
    const { data } = await api.post<JobResponse>(`/brands/${id}/generate_plan/`, params);
    return data;
  },
};

// =============================================================================
// Source Sample API
// =============================================================================

export const sampleApi = {
  list: async (brandId?: string) => {
    const params = brandId ? { brand: brandId } : {};
    const { data } = await api.get<PaginatedResponse<SourceSample>>("/samples/", { params });
    return data;
  },

  create: async (sample: { brand: string; source_type: string; title?: string; raw_text: string }) => {
    const { data } = await api.post<SourceSample>("/samples/", sample);
    return data;
  },

  delete: async (id: string) => {
    await api.delete(`/samples/${id}/`);
  },
};

// =============================================================================
// Transcript API
// =============================================================================

export const transcriptApi = {
  list: async (brandId?: string) => {
    const params = brandId ? { brand: brandId } : {};
    const { data } = await api.get<PaginatedResponse<Transcript>>("/transcripts/", { params });
    return data;
  },

  get: async (id: string) => {
    const { data } = await api.get<Transcript>(`/transcripts/${id}/`);
    return data;
  },

  create: async (params: {
    brand_id: string;
    title?: string;
    source_type: "upload" | "paste";
    raw_text?: string;
    audio_url?: string;
  }) => {
    const { data } = await api.post<{ transcript: Transcript; job_id?: string; status: string }>(
      "/transcripts/",
      params
    );
    return data;
  },

  detectClips: async (id: string) => {
    const { data } = await api.post<JobResponse>(`/transcripts/${id}/detect_clips/`);
    return data;
  },

  delete: async (id: string) => {
    await api.delete(`/transcripts/${id}/`);
  },
};

// =============================================================================
// Clip API
// =============================================================================

export const clipApi = {
  list: async (transcriptId?: string) => {
    const params = transcriptId ? { transcript: transcriptId } : {};
    const { data } = await api.get<PaginatedResponse<Clip>>("/clips/", { params });
    return data;
  },

  get: async (id: string) => {
    const { data } = await api.get<Clip>(`/clips/${id}/`);
    return data;
  },

  approve: async (id: string) => {
    const { data } = await api.post<{ status: string }>(`/clips/${id}/approve/`);
    return data;
  },

  reject: async (id: string) => {
    const { data } = await api.post<{ status: string }>(`/clips/${id}/reject/`);
    return data;
  },
};

// =============================================================================
// Content Plan API
// =============================================================================

export const planApi = {
  list: async (brandId?: string) => {
    const params = brandId ? { brand: brandId } : {};
    const { data } = await api.get<PaginatedResponse<ContentPlan>>("/plans/", { params });
    return data;
  },

  get: async (id: string) => {
    const { data } = await api.get<ContentPlan>(`/plans/${id}/`);
    return data;
  },

  activate: async (id: string) => {
    const { data } = await api.post<{ status: string }>(`/plans/${id}/activate/`);
    return data;
  },
};

// =============================================================================
// Plan Item API
// =============================================================================

export const planItemApi = {
  list: async (planId?: string) => {
    const params = planId ? { content_plan: planId } : {};
    const { data } = await api.get<PaginatedResponse<PlanItem>>("/plan-items/", { params });
    return data;
  },

  get: async (id: string) => {
    const { data } = await api.get<PlanItem>(`/plan-items/${id}/`);
    return data;
  },

  generateDraft: async (id: string, platform?: string) => {
    const { data } = await api.post<JobResponse>(`/plan-items/${id}/generate_draft/`, {
      platform,
    });
    return data;
  },
};

// =============================================================================
// Draft API
// =============================================================================

export const draftApi = {
  list: async () => {
    const { data } = await api.get<PaginatedResponse<Draft>>("/drafts/");
    return data;
  },

  get: async (id: string) => {
    const { data } = await api.get<Draft>(`/drafts/${id}/`);
    return data;
  },

  edit: async (id: string, content: string) => {
    const { data } = await api.post<{ status: string; version: number }>(`/drafts/${id}/edit/`, {
      content,
    });
    return data;
  },

  regenerate: async (id: string, feedback: string) => {
    const { data } = await api.post<JobResponse>(`/drafts/${id}/regenerate/`, { feedback });
    return data;
  },

  approve: async (id: string) => {
    const { data } = await api.post<{ status: string }>(`/drafts/${id}/approve/`);
    return data;
  },
};

// =============================================================================
// Job API
// =============================================================================

export const jobApi = {
  getStatus: async (id: string) => {
    const { data } = await api.get<GenerationJob>(`/jobs/${id}/status/`);
    return data;
  },

  poll: async (id: string, onProgress?: (progress: number) => void): Promise<GenerationJob> => {
    return new Promise((resolve, reject) => {
      const checkStatus = async () => {
        try {
          const job = await jobApi.getStatus(id);

          if (onProgress) {
            onProgress(job.progress);
          }

          if (job.status === "completed") {
            resolve(job);
          } else if (job.status === "failed") {
            reject(new Error(job.error_message || "Job failed"));
          } else {
            setTimeout(checkStatus, 2000); // Poll every 2 seconds
          }
        } catch (error) {
          reject(error);
        }
      };

      checkStatus();
    });
  },
};

// =============================================================================
// Subscription API
// =============================================================================

export const subscriptionApi = {
  getCurrent: async () => {
    const { data } = await api.get<Subscription>("/subscriptions/current/");
    return data;
  },

  createCheckout: async (plan: string, successUrl: string, cancelUrl: string) => {
    const { data } = await api.post<{ checkout_url: string; session_id: string }>(
      "/billing/checkout/",
      { plan, success_url: successUrl, cancel_url: cancelUrl }
    );
    return data;
  },

  createPortal: async (returnUrl: string) => {
    const { data } = await api.post<{ portal_url: string }>("/billing/portal/", {
      return_url: returnUrl,
    });
    return data;
  },
};

// =============================================================================
// Upload API
// =============================================================================

export const uploadApi = {
  getPresignedUrl: async (filename: string, contentType: string) => {
    const { data } = await api.post<{
      upload_url: string;
      file_url: string;
      fields?: Record<string, string>;
    }>("/media/presigned-upload/", { filename, content_type: contentType });
    return data;
  },

  uploadFile: async (
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<string> => {
    // Get presigned URL
    const { upload_url, file_url, fields } = await uploadApi.getPresignedUrl(
      file.name,
      file.type
    );

    // Upload to S3/R2
    const formData = new FormData();
    if (fields) {
      Object.entries(fields).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }
    formData.append("file", file);

    await axios.post(upload_url, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          onProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
        }
      },
    });

    return file_url;
  },
};

export default api;
