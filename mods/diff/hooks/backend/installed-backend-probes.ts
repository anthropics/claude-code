import type { BackendProbe } from './types'

/**
 * Where a host adds backends: probes for version-control systems other than
 * git, asked in insertion order before git (backendOf). Empty as shipped.
 *
 * A host compiling the module in adds a probe once, before the plugin
 * registers: the module runs natively, and there is no other channel (the
 * options are the manifest's userConfig; the scan wants a plain function).
 */
// module-state-allow: module-evaluation code wiring — a compiling host adds its probe functions (code references, not runtime input) once before registration and never removes or rebinds them; tests pass probes to backendOf directly; a per-Host copy would hold the same functions
export const INSTALLED_BACKEND_PROBES = new Set<BackendProbe>()
