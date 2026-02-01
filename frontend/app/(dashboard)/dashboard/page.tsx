"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { transcriptApi, clipApi, draftApi, brandApi } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Scissors,
  Edit3,
  Plus,
  ArrowRight,
  Sparkles,
  Upload,
} from "lucide-react";
import type { Transcript, Clip, Draft } from "@/types";
import { getStatusColor, truncate, formatDate } from "@/lib/utils";

export default function DashboardPage() {
  const { currentBrand, subscription } = useAppStore();
  const [stats, setStats] = useState({
    transcripts: 0,
    clips: 0,
    drafts: 0,
  });
  const [recentTranscripts, setRecentTranscripts] = useState<Transcript[]>([]);
  const [recentClips, setRecentClips] = useState<Clip[]>([]);
  const [pendingDrafts, setPendingDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [transcriptsRes, clipsRes, draftsRes] = await Promise.all([
          transcriptApi.list(),
          clipApi.list(),
          draftApi.list(),
        ]);

        setStats({
          transcripts: transcriptsRes.count,
          clips: clipsRes.count,
          drafts: draftsRes.count,
        });

        setRecentTranscripts(transcriptsRes.results.slice(0, 3));
        setRecentClips(clipsRes.results.filter((c) => c.status === "detected").slice(0, 5));
        setPendingDrafts(draftsRes.results.filter((d) => d.status === "ready_for_review").slice(0, 5));
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here&apos;s your content overview.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/transcripts">
            <Button>
              <Upload className="mr-2 h-4 w-4" />
              Upload Content
            </Button>
          </Link>
        </div>
      </div>

      {/* Brand Setup Prompt */}
      {!currentBrand && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="flex items-center justify-between p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-primary/10 p-3">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Set up your brand</h3>
                <p className="text-sm text-muted-foreground">
                  Create a brand to start generating content in your voice
                </p>
              </div>
            </div>
            <Link href="/brands">
              <Button>
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transcripts</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.transcripts}</div>
            <p className="text-xs text-muted-foreground">
              {recentTranscripts.filter((t) => t.status === "processing").length} processing
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clips Detected</CardTitle>
            <Scissors className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.clips}</div>
            <p className="text-xs text-muted-foreground">
              {recentClips.length} awaiting review
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Drafts</CardTitle>
            <Edit3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.drafts}</div>
            <p className="text-xs text-muted-foreground">
              {pendingDrafts.length} ready for review
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Clips to Review */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Clips to Review
              <Link href="/clips">
                <Button variant="ghost" size="sm">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardTitle>
            <CardDescription>
              AI-detected viral moments from your content
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentClips.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No clips to review. Upload a transcript to get started.
              </p>
            ) : (
              <div className="space-y-3">
                {recentClips.map((clip) => (
                  <div
                    key={clip.id}
                    className="flex items-start justify-between rounded-lg border p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{truncate(clip.text, 100)}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          Score: {clip.viral_score}
                        </Badge>
                        {clip.topic_tags.slice(0, 2).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Drafts to Review */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Drafts to Review
              <Link href="/drafts">
                <Button variant="ghost" size="sm">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardTitle>
            <CardDescription>
              Generated content waiting for your approval
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pendingDrafts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No drafts to review. Generate content from clips or plans.
              </p>
            ) : (
              <div className="space-y-3">
                {pendingDrafts.map((draft) => (
                  <Link
                    key={draft.id}
                    href={`/drafts/${draft.id}`}
                    className="flex items-start justify-between rounded-lg border p-3 hover:bg-accent transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {truncate(draft.current_content || "", 80)}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className={getStatusColor(draft.status)}>
                          {draft.status.replace(/_/g, " ")}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          v{draft.current_version}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Transcripts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Recent Transcripts
            <Link href="/transcripts">
              <Button variant="ghost" size="sm">
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentTranscripts.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No transcripts yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Upload audio or paste text to get started
              </p>
              <Link href="/transcripts">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Transcript
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentTranscripts.map((transcript) => (
                <Link
                  key={transcript.id}
                  href={`/transcripts/${transcript.id}`}
                  className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent transition-colors"
                >
                  <div>
                    <p className="font-medium">{transcript.title || "Untitled"}</p>
                    <p className="text-sm text-muted-foreground">
                      {transcript.word_count} words &middot; {formatDate(transcript.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(transcript.status)}>
                      {transcript.status}
                    </Badge>
                    {transcript.clips_count > 0 && (
                      <Badge variant="outline">
                        {transcript.clips_count} clips
                      </Badge>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
