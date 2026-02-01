"use client";

import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { brandApi, sampleApi, jobApi } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Sparkles,
  Plus,
  Brain,
  Check,
  Loader2,
  X,
} from "lucide-react";
import type { Brand, SourceSample, VoiceFingerprint } from "@/types";
import { formatDate } from "@/lib/utils";
import toast from "react-hot-toast";

const brandSchema = z.object({
  name: z.string().min(1, "Name is required"),
  niche: z.string().optional(),
  target_audience: z.string().optional(),
  primary_goal: z.enum(["growth", "monetize", "authority"]),
});

type BrandForm = z.infer<typeof brandSchema>;

export default function BrandsPage() {
  const { currentBrand, setCurrentBrand } = useAppStore();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [samples, setSamples] = useState<SourceSample[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isLearning, setIsLearning] = useState(false);
  const [newSampleText, setNewSampleText] = useState("");
  const [newSampleTitle, setNewSampleTitle] = useState("");
  const [addingSample, setAddingSample] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BrandForm>({
    resolver: zodResolver(brandSchema),
    defaultValues: {
      primary_goal: "growth",
    },
  });

  const fetchData = useCallback(async () => {
    try {
      const [brandsRes, samplesRes] = await Promise.all([
        brandApi.list(),
        currentBrand ? sampleApi.list(currentBrand.id) : Promise.resolve({ results: [] }),
      ]);
      setBrands(brandsRes.results);
      setSamples(samplesRes.results);

      // Set current brand if not set
      if (!currentBrand && brandsRes.results.length > 0) {
        setCurrentBrand(brandsRes.results[0]);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  }, [currentBrand, setCurrentBrand]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onCreateBrand = async (data: BrandForm) => {
    setIsCreating(true);
    try {
      const brand = await brandApi.create(data);
      setBrands((prev) => [...prev, brand]);
      setCurrentBrand(brand);
      setShowCreateForm(false);
      reset();
      toast.success("Brand created!");
    } catch (error) {
      console.error("Failed to create brand:", error);
      toast.error("Failed to create brand");
    } finally {
      setIsCreating(false);
    }
  };

  const handleAddSample = async () => {
    if (!newSampleText.trim() || !currentBrand) return;

    setAddingSample(true);
    try {
      const sample = await sampleApi.create({
        brand: currentBrand.id,
        source_type: "paste",
        title: newSampleTitle || "Content Sample",
        raw_text: newSampleText,
      });
      setSamples((prev) => [sample, ...prev]);
      setNewSampleText("");
      setNewSampleTitle("");
      toast.success("Sample added!");
    } catch (error) {
      console.error("Failed to add sample:", error);
      toast.error("Failed to add sample");
    } finally {
      setAddingSample(false);
    }
  };

  const handleDeleteSample = async (sampleId: string) => {
    try {
      await sampleApi.delete(sampleId);
      setSamples((prev) => prev.filter((s) => s.id !== sampleId));
      toast.success("Sample removed");
    } catch (error) {
      console.error("Failed to delete sample:", error);
      toast.error("Failed to remove sample");
    }
  };

  const handleLearnVoice = async () => {
    if (!currentBrand) return;

    const unanalyzedCount = samples.filter((s) => !s.analyzed).length;
    if (unanalyzedCount === 0) {
      toast.error("Add content samples first");
      return;
    }

    setIsLearning(true);
    try {
      const { job_id } = await brandApi.learnVoice(currentBrand.id);
      toast.loading("Learning your voice...", { id: "learn-voice" });

      await jobApi.poll(job_id, (progress) => {
        // Update progress if needed
      });

      toast.success("Voice profile updated!", { id: "learn-voice" });

      // Refresh brand to get updated voice
      const updatedBrand = await brandApi.get(currentBrand.id);
      setCurrentBrand(updatedBrand);
      setBrands((prev) =>
        prev.map((b) => (b.id === updatedBrand.id ? updatedBrand : b))
      );

      // Refresh samples to see analyzed status
      const samplesRes = await sampleApi.list(currentBrand.id);
      setSamples(samplesRes.results);
    } catch (error) {
      console.error("Failed to learn voice:", error);
      toast.error("Failed to learn voice", { id: "learn-voice" });
    } finally {
      setIsLearning(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Brand & Voice</h1>
          <p className="text-muted-foreground">
            Set up your brand identity and train your AI voice
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Brand
        </Button>
      </div>

      {/* Create Brand Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Brand</CardTitle>
            <CardDescription>
              Set up a new brand identity for content generation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onCreateBrand)} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Brand Name *</label>
                  <Input
                    placeholder="My Podcast"
                    {...register("name")}
                    error={errors.name?.message}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Primary Goal</label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    {...register("primary_goal")}
                  >
                    <option value="growth">Audience Growth</option>
                    <option value="monetize">Monetization</option>
                    <option value="authority">Authority Building</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Niche</label>
                <Input
                  placeholder="e.g., Personal development, Tech, Business"
                  {...register("niche")}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Target Audience</label>
                <Textarea
                  placeholder="Describe your ideal audience..."
                  {...register("target_audience")}
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={isCreating}>
                  {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Brand
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Brand Selector */}
      {brands.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {brands.map((brand) => (
            <Button
              key={brand.id}
              variant={currentBrand?.id === brand.id ? "default" : "outline"}
              size="sm"
              onClick={() => setCurrentBrand(brand)}
            >
              {brand.name}
            </Button>
          ))}
        </div>
      )}

      {/* Current Brand Details */}
      {currentBrand && (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Brand Info */}
            <Card>
              <CardHeader>
                <CardTitle>{currentBrand.name}</CardTitle>
                <CardDescription>Brand information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-sm font-medium">Goal:</span>
                  <Badge variant="secondary" className="ml-2">
                    {currentBrand.primary_goal}
                  </Badge>
                </div>
                {currentBrand.niche && (
                  <div>
                    <span className="text-sm font-medium">Niche:</span>
                    <p className="text-sm text-muted-foreground mt-1">
                      {currentBrand.niche}
                    </p>
                  </div>
                )}
                {currentBrand.target_audience && (
                  <div>
                    <span className="text-sm font-medium">Target Audience:</span>
                    <p className="text-sm text-muted-foreground mt-1">
                      {currentBrand.target_audience}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Voice Profile */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  Voice Profile
                </CardTitle>
                <CardDescription>
                  AI-learned characteristics of your voice
                </CardDescription>
              </CardHeader>
              <CardContent>
                {currentBrand.voice ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Samples Analyzed</span>
                      <Badge>{currentBrand.voice.samples_analyzed}</Badge>
                    </div>

                    {currentBrand.voice.vocabulary_level && (
                      <div>
                        <span className="text-sm font-medium">Vocabulary Level:</span>
                        <Badge variant="outline" className="ml-2">
                          {currentBrand.voice.vocabulary_level}
                        </Badge>
                      </div>
                    )}

                    {currentBrand.voice.humor_style && (
                      <div>
                        <span className="text-sm font-medium">Humor Style:</span>
                        <p className="text-sm text-muted-foreground">
                          {currentBrand.voice.humor_style}
                        </p>
                      </div>
                    )}

                    {currentBrand.voice.sample_phrases.length > 0 && (
                      <div>
                        <span className="text-sm font-medium">Learned Phrases:</span>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {currentBrand.voice.sample_phrases.slice(0, 5).map((phrase, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {phrase}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {currentBrand.voice.last_learned_at && (
                      <p className="text-xs text-muted-foreground">
                        Last updated: {formatDate(currentBrand.voice.last_learned_at)}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-sm text-muted-foreground">
                      Add content samples and learn your voice
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Content Samples */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Content Samples</CardTitle>
                  <CardDescription>
                    Add examples of your content to train the AI voice
                  </CardDescription>
                </div>
                <Button
                  onClick={handleLearnVoice}
                  disabled={isLearning || samples.filter((s) => !s.analyzed).length === 0}
                >
                  {isLearning ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Learning...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Learn Voice
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Add Sample Form */}
              <div className="space-y-4 p-4 border rounded-lg">
                <h4 className="font-medium">Add New Sample</h4>
                <div className="space-y-2">
                  <Input
                    placeholder="Sample title (optional)"
                    value={newSampleTitle}
                    onChange={(e) => setNewSampleTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Textarea
                    placeholder="Paste your content here... (blog post, newsletter, transcript, etc.)"
                    value={newSampleText}
                    onChange={(e) => setNewSampleText(e.target.value)}
                    className="min-h-[120px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    {newSampleText.split(/\s+/).filter(Boolean).length} words
                  </p>
                </div>
                <Button
                  onClick={handleAddSample}
                  disabled={addingSample || !newSampleText.trim()}
                >
                  {addingSample ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Add Sample
                </Button>
              </div>

              {/* Samples List */}
              {samples.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium">
                    Your Samples ({samples.length})
                  </h4>
                  {samples.map((sample) => (
                    <div
                      key={sample.id}
                      className="flex items-start justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">
                            {sample.title}
                          </span>
                          {sample.analyzed ? (
                            <Badge variant="secondary" className="text-xs">
                              <Check className="mr-1 h-3 w-3" />
                              Analyzed
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              Pending
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {sample.word_count} words
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteSample(sample.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* No Brand State */}
      {brands.length === 0 && !showCreateForm && (
        <Card>
          <CardContent className="py-12 text-center">
            <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">Create your first brand</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Set up a brand to start generating content in your voice
            </p>
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Brand
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
