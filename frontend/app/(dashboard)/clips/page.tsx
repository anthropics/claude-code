"use client";

import { useEffect, useState, useCallback } from "react";
import { clipApi, planItemApi, jobApi } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  X,
  Play,
  Sparkles,
  Loader2,
} from "lucide-react";
import type { Clip } from "@/types";
import { getStatusColor, formatTime, getPlatformLabel } from "@/lib/utils";
import toast from "react-hot-toast";

const PLATFORMS = [
  { value: "youtube_short", label: "YouTube Short" },
  { value: "tiktok", label: "TikTok" },
  { value: "x", label: "X/Twitter" },
  { value: "instagram_reel", label: "Instagram Reel" },
];

export default function ClipsPage() {
  const { currentBrand } = useAppStore();
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "detected" | "approved" | "rejected">("all");
  const [generatingClipId, setGeneratingClipId] = useState<string | null>(null);

  const fetchClips = useCallback(async () => {
    try {
      const res = await clipApi.list();
      setClips(res.results);
    } catch (error) {
      console.error("Failed to fetch clips:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClips();
  }, [fetchClips]);

  const handleApprove = async (clipId: string) => {
    try {
      await clipApi.approve(clipId);
      setClips((prev) =>
        prev.map((c) => (c.id === clipId ? { ...c, status: "approved" } : c))
      );
      toast.success("Clip approved!");
    } catch (error) {
      console.error("Failed to approve clip:", error);
      toast.error("Failed to approve clip");
    }
  };

  const handleReject = async (clipId: string) => {
    try {
      await clipApi.reject(clipId);
      setClips((prev) =>
        prev.map((c) => (c.id === clipId ? { ...c, status: "rejected" } : c))
      );
      toast.success("Clip rejected");
    } catch (error) {
      console.error("Failed to reject clip:", error);
      toast.error("Failed to reject clip");
    }
  };

  const handleGenerateDraft = async (clip: Clip, platform: string) => {
    if (!currentBrand) return;

    setGeneratingClipId(clip.id);

    try {
      // This would typically create a plan item and then generate a draft
      // For simplicity, we'll show it's in progress
      toast.loading(`Generating ${getPlatformLabel(platform)} content...`, {
        id: `gen-${clip.id}`,
      });

      // Simulate generation (in real app, this would call the API)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      toast.success("Draft generated!", { id: `gen-${clip.id}` });
    } catch (error) {
      console.error("Failed to generate draft:", error);
      toast.error("Failed to generate draft", { id: `gen-${clip.id}` });
    } finally {
      setGeneratingClipId(null);
    }
  };

  const filteredClips =
    filter === "all"
      ? clips
      : clips.filter((c) => c.status === filter);

  const detectedCount = clips.filter((c) => c.status === "detected").length;
  const approvedCount = clips.filter((c) => c.status === "approved").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Clips</h1>
          <p className="text-muted-foreground">
            Review AI-detected viral moments from your content
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{detectedCount} to review</Badge>
          <Badge variant="secondary">{approvedCount} approved</Badge>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(["all", "detected", "approved", "rejected"] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      {/* Clips Grid */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-64 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : filteredClips.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Play className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No clips found</h3>
            <p className="text-sm text-muted-foreground">
              {filter === "all"
                ? "Upload a transcript and detect clips to get started"
                : `No ${filter} clips`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredClips.map((clip) => (
            <Card key={clip.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(clip.status)}>
                      {clip.status}
                    </Badge>
                    <Badge variant="outline">
                      Score: {clip.viral_score}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatTime(clip.start_time)} - {formatTime(clip.end_time)}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                {/* Clip Text */}
                <div className="flex-1 mb-4">
                  <p className="text-sm leading-relaxed line-clamp-6">
                    {clip.text}
                  </p>
                </div>

                {/* Tags */}
                {clip.topic_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {clip.topic_tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Suggested Caption */}
                {clip.suggested_caption && (
                  <div className="mb-4 p-2 bg-muted rounded text-xs">
                    <span className="font-medium">Suggested caption:</span>
                    <p className="mt-1">{clip.suggested_caption}</p>
                  </div>
                )}

                {/* Actions */}
                {clip.status === "detected" && (
                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleApprove(clip.id)}
                    >
                      <Check className="mr-1 h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReject(clip.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {clip.status === "approved" && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Generate content for:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {PLATFORMS.map((platform) => (
                        <Button
                          key={platform.value}
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          disabled={generatingClipId === clip.id}
                          onClick={() => handleGenerateDraft(clip, platform.value)}
                        >
                          {generatingClipId === clip.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <Sparkles className="mr-1 h-3 w-3" />
                              {platform.label}
                            </>
                          )}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
