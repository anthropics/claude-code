import { NextRequest, NextResponse } from "next/server";
import { parseChangelog, filterForFeature } from "@/lib/changelog-parser";
import { generateDiagrams } from "@/lib/mermaid-generator";
import type { FeatureConfig } from "@/lib/types";

/**
 * POST /api/generate
 *
 * Accepts a feature config + changelog content,
 * returns parsed versions + generated mermaid diagrams.
 *
 * Request body:
 *   { changelog: string, config: FeatureConfig }
 *
 * Response:
 *   { versions: VersionBlock[], diagrams: { architecture, sequence, eraSpecs } }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { changelog, config } = body as {
      changelog: string;
      config: FeatureConfig;
    };

    if (!changelog || !config) {
      return NextResponse.json(
        { error: "Missing changelog or config in request body" },
        { status: 400 }
      );
    }

    // Step 1-2: Parse and filter
    const allVersions = parseChangelog(changelog);
    const filtered = filterForFeature(allVersions, config);

    // Step 5: Generate mermaid diagrams
    const diagrams = generateDiagrams(filtered, config);

    return NextResponse.json({
      versions: filtered,
      diagrams: {
        architecture: diagrams.architecture,
        sequence: diagrams.sequence,
        eraSpecs: diagrams.eraSpecs,
      },
      stats: {
        totalVersions: allVersions.length,
        matchedVersions: filtered.length,
        totalChanges: filtered.reduce(
          (n, v) => n + v.changes.length,
          0
        ),
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to generate visualization",
      },
      { status: 500 }
    );
  }
}
