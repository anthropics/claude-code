"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useDropzone } from "react-dropzone";
import { useAppStore } from "@/lib/store";
import { transcriptApi, uploadApi, jobApi } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  FileText,
  Upload,
  FileAudio,
  X,
  Loader2,
  Check,
  AlertCircle,
} from "lucide-react";
import type { Transcript } from "@/types";
import { getStatusColor, formatDate, formatDuration, truncate } from "@/lib/utils";
import toast from "react-hot-toast";

type UploadMode = "none" | "audio" | "paste";

export default function TranscriptsPage() {
  const { currentBrand } = useAppStore();
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadMode, setUploadMode] = useState<UploadMode>("none");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [title, setTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fetchTranscripts = useCallback(async () => {
    try {
      const res = await transcriptApi.list();
      setTranscripts(res.results);
    } catch (error) {
      console.error("Failed to fetch transcripts:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTranscripts();
  }, [fetchTranscripts]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
      setUploadMode("audio");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "audio/*": [".mp3", ".wav", ".m4a", ".ogg", ".webm"],
    },
    maxFiles: 1,
    disabled: isUploading,
  });

  const handleUploadAudio = async () => {
    if (!selectedFile || !currentBrand) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Upload file to S3/R2
      setUploadProgress(10);
      const fileUrl = await uploadApi.uploadFile(selectedFile, (progress) => {
        setUploadProgress(10 + progress * 0.4); // 10-50%
      });

      setUploadProgress(50);

      // Create transcript with audio URL
      const result = await transcriptApi.create({
        brand_id: currentBrand.id,
        title: title || selectedFile.name,
        source_type: "upload",
        audio_url: fileUrl,
      });

      setUploadProgress(60);

      // Poll for transcription completion
      if (result.job_id) {
        toast.loading("Transcribing audio...", { id: "transcribe" });

        await jobApi.poll(result.job_id, (progress) => {
          setUploadProgress(60 + progress * 0.4); // 60-100%
        });

        toast.success("Transcription complete!", { id: "transcribe" });
      }

      setUploadProgress(100);

      // Reset form and refresh
      setSelectedFile(null);
      setTitle("");
      setUploadMode("none");
      fetchTranscripts();
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error("Failed to upload and transcribe audio");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handlePasteSubmit = async () => {
    if (!pasteText.trim() || !currentBrand) return;

    setIsUploading(true);

    try {
      await transcriptApi.create({
        brand_id: currentBrand.id,
        title: title || "Pasted Text",
        source_type: "paste",
        raw_text: pasteText,
      });

      toast.success("Transcript created!");

      // Reset form and refresh
      setPasteText("");
      setTitle("");
      setUploadMode("none");
      fetchTranscripts();
    } catch (error) {
      console.error("Failed to create transcript:", error);
      toast.error("Failed to create transcript");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDetectClips = async (transcriptId: string) => {
    try {
      const { job_id } = await transcriptApi.detectClips(transcriptId);
      toast.loading("Detecting clips...", { id: `clips-${transcriptId}` });

      await jobApi.poll(job_id);
      toast.success("Clips detected!", { id: `clips-${transcriptId}` });

      fetchTranscripts();
    } catch (error) {
      console.error("Failed to detect clips:", error);
      toast.error("Failed to detect clips", { id: `clips-${transcriptId}` });
    }
  };

  if (!currentBrand) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">No brand selected</h2>
        <p className="text-muted-foreground mb-4">
          Please create a brand first to upload transcripts
        </p>
        <Link href="/brands">
          <Button>Create Brand</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Transcripts</h1>
          <p className="text-muted-foreground">
            Upload audio or paste text to create content from
          </p>
        </div>
      </div>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle>Add New Content</CardTitle>
          <CardDescription>
            Upload an audio file or paste existing text
          </CardDescription>
        </CardHeader>
        <CardContent>
          {uploadMode === "none" ? (
            <div className="grid gap-4 md:grid-cols-2">
              {/* Audio Upload Option */}
              <div
                {...getRootProps()}
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                  transition-colors hover:border-primary hover:bg-primary/5
                  ${isDragActive ? "border-primary bg-primary/5" : "border-muted"}
                `}
              >
                <input {...getInputProps()} />
                <FileAudio className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">Upload Audio</h3>
                <p className="text-sm text-muted-foreground">
                  Drag & drop or click to upload
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  MP3, WAV, M4A, OGG (max 100MB)
                </p>
              </div>

              {/* Paste Text Option */}
              <button
                onClick={() => setUploadMode("paste")}
                className="border-2 border-dashed rounded-lg p-8 text-center transition-colors hover:border-primary hover:bg-primary/5"
              >
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">Paste Text</h3>
                <p className="text-sm text-muted-foreground">
                  Paste transcript or article text
                </p>
              </button>
            </div>
          ) : uploadMode === "audio" && selectedFile ? (
            <div className="space-y-4">
              {/* Selected File */}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <FileAudio className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                {!isUploading && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedFile(null);
                      setUploadMode("none");
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Title Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Title (optional)</label>
                <Input
                  placeholder="Episode title or description"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isUploading}
                />
              </div>

              {/* Progress */}
              {isUploading && (
                <div className="space-y-2">
                  <Progress value={uploadProgress} />
                  <p className="text-sm text-muted-foreground text-center">
                    {uploadProgress < 50
                      ? "Uploading..."
                      : uploadProgress < 100
                      ? "Transcribing..."
                      : "Complete!"}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  onClick={handleUploadAudio}
                  disabled={isUploading}
                  className="flex-1"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload & Transcribe
                    </>
                  )}
                </Button>
                {!isUploading && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedFile(null);
                      setUploadMode("none");
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          ) : uploadMode === "paste" ? (
            <div className="space-y-4">
              {/* Title Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Title (optional)</label>
                <Input
                  placeholder="Content title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isUploading}
                />
              </div>

              {/* Text Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Content</label>
                <Textarea
                  placeholder="Paste your transcript, article, or any text content here..."
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  disabled={isUploading}
                  className="min-h-[200px]"
                />
                <p className="text-xs text-muted-foreground">
                  {pasteText.split(/\s+/).filter(Boolean).length} words
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  onClick={handlePasteSubmit}
                  disabled={isUploading || !pasteText.trim()}
                  className="flex-1"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Create Transcript
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setPasteText("");
                    setTitle("");
                    setUploadMode("none");
                  }}
                  disabled={isUploading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Transcripts List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Transcripts</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : transcripts.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No transcripts yet</h3>
              <p className="text-sm text-muted-foreground">
                Upload audio or paste text to get started
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {transcripts.map((transcript) => (
                <div
                  key={transcript.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium truncate">
                        {transcript.title || "Untitled"}
                      </h3>
                      <Badge className={getStatusColor(transcript.status)}>
                        {transcript.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span>{transcript.word_count} words</span>
                      {transcript.duration_seconds && (
                        <span>{formatDuration(transcript.duration_seconds)}</span>
                      )}
                      <span>{formatDate(transcript.created_at)}</span>
                      {transcript.clips_count > 0 && (
                        <span className="text-primary">
                          {transcript.clips_count} clips
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {transcript.status === "ready" && transcript.clips_count === 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDetectClips(transcript.id)}
                      >
                        Detect Clips
                      </Button>
                    )}
                    {transcript.status === "failed" && (
                      <Badge variant="destructive" className="flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Failed
                      </Badge>
                    )}
                    <Link href={`/transcripts/${transcript.id}`}>
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
