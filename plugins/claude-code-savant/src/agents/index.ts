export { createRouterAgent, RouterContext } from "./router.js";
export { createEinsteinAgent, EinsteinContext } from "./einstein.js";
export { createShakespeareAgent, ShakespeareContext } from "./shakespeare.js";
export { createSteveJobsAgent, SteveJobsContext } from "./stevejobs.js";
export { createSocratesAgent, SocratesContext } from "./socrates.js";
export { AgentConfig, BaseContext } from "./types.js";

/**
 * Example usage:
 *
 * const einstein = createEinsteinAgent({
 *   language: "kr",
 *   userLevel: "beginner",
 *   includeComplexity: true
 * });
 *
 * const shakespeare = createShakespeareAgent({
 *   language: "en",
 *   includeFlowchart: true,
 *   dramaticLevel: "theatrical"
 * });
 *
 * const stevejobs = createSteveJobsAgent({
 *   language: "en",
 *   brutality: "brutal",
 *   focusArea: "product"
 * });
 *
 * const socrates = createSocratesAgent({
 *   language: "jp",
 *   errorType: "null",
 *   includeEdgeCases: true
 * });
 */
