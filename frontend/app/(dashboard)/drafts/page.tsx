"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { draftApi, jobApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Edit3,
  Check,
  RefreshCw,
  X,
  Loader2,
  Copy,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { Draft } from "@/types";
import { getStatusColor, getPlatformLabel, truncate, formatDate } from "@/lib/utils";
import toast from "react-hot-toast";

export default function DraftsPage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "ready_for_review" | "approved">("all");
  const [editingDraft, setEditingDraft] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [regenFeedback, setRegenFeedback] = useState("");
  const [showRegenInput, setShowRegenInput] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [expandedDraft, setExpandedDraft] = useState<string | null>(null);

  const fetchDrafts = useCallback(async () => {
    try {
      const res = await draftApi.list();
      setDrafts(res.results);
    } catch (error) {
      console.error("Failed to fetch drafts:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  const handleEdit = async (draftId: string) => {
    if (!editContent.trim()) return;

    setProcessing(draftId);
    try {
      await draftApi.edit(draftId, editContent);
      toast.success("Draft updated!");
      setEditingDraft(null);
      setEditContent("");
      fetchDrafts();
    } catch (error) {
      console.error("Failed to edit draft:", error);
      toast.error("Failed to update draft");
    } finally {
      setProcessing(null);
    }
  };

  const handleRegenerate = async (draftId: string) => {
    if (!regenFeedback.trim()) {
      toast.error("Please provide feedback for regeneration");
      return;
    }

    setProcessing(draftId);
    try {
      const { job_id } = await draftApi.regenerate(draftId, regenFeedback);
      toast.loading("Regenerating...", { id: `regen-${draftId}` });

      await jobApi.poll(job_id);
      toast.success("Draft regenerated!", { id: `regen-${draftId}` });

      setShowRegenInput(null);
      setRegenFeedback("");
      fetchDrafts();
    } catch (error) {
      console.error("Failed to regenerate draft:", error);
      toast.error("Failed to regenerate", { id: `regen-${draftId}` });
    } finally {
      setProcessing(null);
    }
  };

  const handleApprove = async (draftId: string) => {
    setProcessing(draftId);
    try {
      await draftApi.approve(draftId);
      toast.success("Draft approved!");
      fetchDrafts();
    } catch (error) {
      console.error("Failed to approve draft:", error);
      toast.error("Failed to approve");
    } finally {
      setProcessing(null);
    }
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Copied to clipboard!");
  };

  const startEdit = (draft: Draft) => {
    setEditingDraft(draft.id);
    setEditContent(draft.current_content || "");
    setShowRegenInput(null);
  };

  const startRegen = (draftId: string) => {
    setShowRegenInput(draftId);
    setEditingDraft(null);
    setRegenFeedback("");
  };

  const filteredDrafts =
    filter === "all"
      ? drafts
      : drafts.filter((d) => d.status === filter);

  const reviewCount = drafts.filter((d) => d.status === "ready_for_review").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Drafts</h1>
          <p className="text-muted-foreground">
            Review and edit AI-generated content
          </p>
        </div>
        <Badge variant="outline">{reviewCount} to review</Badge>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(["all", "ready_for_review", "approved"] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f === "ready_for_review" ? "To Review" : f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      {/* Drafts List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : filteredDrafts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Edit3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No drafts found</h3>
            <p className="text-sm text-muted-foreground">
              Generate content from clips or content plans
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredDrafts.map((draft) => (
            <Card key={draft.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(draft.status)}>
                      {draft.status.replace(/_/g, " ")}
                    </Badge>
                    <Badge variant="outline">
                      {getPlatformLabel(draft.platform)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      v{draft.current_version}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {formatDate(draft.created_at)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setExpandedDraft(
                          expandedDraft === draft.id ? null : draft.id
                        )
                      }
                    >
                      {expandedDraft === draft.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Content Preview/Full */}
                {editingDraft === draft.id ? (
                  <div className="space-y-4">
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="min-h-[200px] font-mono text-sm"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleEdit(draft.id)}
                        disabled={processing === draft.id}
                      >
                        {processing === draft.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="mr-2 h-4 w-4" />
                        )}
                        Save
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingDraft(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : showRegenInput === draft.id ? (
                  <div className="space-y-4">
                    <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                      {draft.current_content}
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        What would you like to change?
                      </label>
                      <Textarea
                        placeholder="e.g., Make it more casual, add a stronger hook, shorten it..."
                        value={regenFeedback}
                        onChange={(e) => setRegenFeedback(e.target.value)}
                        className="min-h-[80px]"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleRegenerate(draft.id)}
                        disabled={processing === draft.id || !regenFeedback.trim()}
                      >
                        {processing === draft.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        Regenerate
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowRegenInput(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                      {expandedDraft === draft.id
                        ? draft.current_content
                        : truncate(draft.current_content || "", 300)}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between mt-4">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEdit(draft)}
                        >
                          <Edit3 className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startRegen(draft.id)}
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Regenerate
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(draft.current_content || "")}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Copy
                        </Button>
                      </div>

                      {draft.status === "ready_for_review" && (
                        <Button
                          size="sm"
                          onClick={() => handleApprove(draft.id)}
                          disabled={processing === draft.id}
                        >
                          {processing === draft.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="mr-2 h-4 w-4" />
                          )}
                          Approve
                        </Button>
                      )}
                    </div>
                  </>
                )}

                {/* Version History */}
                {expandedDraft === draft.id && draft.versions.length > 1 && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="text-sm font-medium mb-2">Version History</h4>
                    <div className="space-y-2">
                      {draft.versions.slice(1).map((version) => (
                        <div
                          key={version.id}
                          className="text-xs text-muted-foreground p-2 bg-muted/50 rounded"
                        >
                          <div className="flex justify-between mb-1">
                            <span>
                              v{version.version} ({version.created_by})
                            </span>
                            <span>{formatDate(version.created_at)}</span>
                          </div>
                          {version.regen_feedback && (
                            <p className="italic">
                              Feedback: {version.regen_feedback}
                            </p>
                          )}
                        </div>
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
