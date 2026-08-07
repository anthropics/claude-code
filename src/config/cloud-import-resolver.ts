/**
 * Resolves `@cloud:` imports inside cloud-synced instruction content.
 *
 * Security properties:
 * - Rejects non-`@cloud:` imports (e.g. local filesystem paths)
 * - Enforces maximum recursive import depth
 * - Detects circular imports
 */

const DEFAULT_MAX_IMPORT_DEPTH = 8;
const CLOUD_IMPORT_PATTERN = /^@cloud:([A-Za-z0-9][A-Za-z0-9._/-]*)$/;
const ANY_IMPORT_PATTERN = /^@(\S+)$/;

export interface CloudImportResolverOptions {
  readonly maxDepth?: number;
  readonly rejectNonCloudImports?: boolean;
}

export type FetchCloudImport = (cloudPath: string) => Promise<string>;

export class CloudImportDepthError extends Error {
  readonly maxDepth: number;
  readonly chain: ReadonlyArray<string>;

  constructor(maxDepth: number, chain: ReadonlyArray<string>) {
    super(
      `@cloud import depth exceeded maximum (${maxDepth}). ` +
      `Chain: ${chain.join(" -> ")}`,
    );
    this.name = "CloudImportDepthError";
    this.maxDepth = maxDepth;
    this.chain = chain;
  }
}

export class CloudImportCycleError extends Error {
  readonly chain: ReadonlyArray<string>;

  constructor(chain: ReadonlyArray<string>) {
    super(`Circular @cloud import detected: ${chain.join(" -> ")}`);
    this.name = "CloudImportCycleError";
    this.chain = chain;
  }
}

export class CloudImportPathError extends Error {
  readonly importLine: string;

  constructor(importLine: string, message: string) {
    super(`${message}: ${importLine}`);
    this.name = "CloudImportPathError";
    this.importLine = importLine;
  }
}

export async function resolveCloudImports(
  content: string,
  fetchCloudImport: FetchCloudImport,
  options: CloudImportResolverOptions = {},
): Promise<string> {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_IMPORT_DEPTH;
  const rejectNonCloudImports = options.rejectNonCloudImports ?? true;

  return resolveContent(
    content,
    fetchCloudImport,
    maxDepth,
    rejectNonCloudImports,
    0,
    [],
  );
}

async function resolveContent(
  content: string,
  fetchCloudImport: FetchCloudImport,
  maxDepth: number,
  rejectNonCloudImports: boolean,
  depth: number,
  chain: ReadonlyArray<string>,
): Promise<string> {
  const lines = content.split("\n");
  const resolvedLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    const anyImportMatch = ANY_IMPORT_PATTERN.exec(trimmed);
    if (
      anyImportMatch !== null &&
      rejectNonCloudImports &&
      CLOUD_IMPORT_PATTERN.exec(trimmed) === null
    ) {
      throw new CloudImportPathError(
        trimmed,
        "Only @cloud: imports are allowed in cloud instructions",
      );
    }

    const cloudMatch = CLOUD_IMPORT_PATTERN.exec(trimmed);
    if (cloudMatch === null) {
      resolvedLines.push(line);
      continue;
    }

    const cloudPath = cloudMatch[1];
    assertSafeCloudPath(cloudPath, trimmed);

    const nextChain = [...chain, cloudPath];
    if (chain.includes(cloudPath)) {
      throw new CloudImportCycleError([...chain, cloudPath]);
    }
    if (depth >= maxDepth) {
      throw new CloudImportDepthError(maxDepth, nextChain);
    }

    const importedContent = await fetchCloudImport(cloudPath);
    const resolvedImport = await resolveContent(
      importedContent,
      fetchCloudImport,
      maxDepth,
      rejectNonCloudImports,
      depth + 1,
      nextChain,
    );
    resolvedLines.push(resolvedImport);
  }

  return resolvedLines.join("\n");
}

function assertSafeCloudPath(pathValue: string, importLine: string): void {
  if (pathValue.includes("..")) {
    throw new CloudImportPathError(importLine, "Path traversal is not allowed");
  }
  if (pathValue.startsWith("/") || pathValue.includes("\\")) {
    throw new CloudImportPathError(importLine, "Absolute/local filesystem paths are not allowed");
  }
  if (pathValue.includes("//")) {
    throw new CloudImportPathError(importLine, "Repeated path separators are not allowed");
  }
}

