/** Compatibility exports for the version-3 intelligence contract. */
export {
  exactFinancialQuestion,
  type IntelligenceOptions,
} from "./intelligence-contracts";
export {
  taskReferences,
  planFacts,
  buildIntelligenceRequest,
} from "./intelligence-context";
export { validateIntelligenceRequest } from "./intelligence-input";
export {
  intelligenceSchemaFor,
  normalizeIntelligence,
  intelligencePreview,
} from "./intelligence-output";
export { INTELLIGENCE_SYSTEM, intelligencePrompt } from "./intelligence-prompt";
export { offlineIntelligence } from "./intelligence-samples";
export {
  intelligenceFingerprint,
  requestIdentity,
} from "./intelligence-identity";
