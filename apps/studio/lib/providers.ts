/**
 * Asset search.
 *
 * Implemented in `glyphforge/catalog` so the Studio and the MCP server search
 * the same five catalogues through one code path. The default Objaverse loader
 * already fetches `/objaverse-index.json`, which is exactly where this app
 * serves it from, so nothing needs configuring here.
 */
export {
  PROVIDERS,
  searchAssets,
  fetchSketchfabMetadata,
  configureCatalog,
  TOTAL_ASSETS,
  type ProviderId,
  type ProviderMeta,
  type AssetResult,
  type SearchOptions,
  type SearchOutcome,
  type ObjaverseIndex,
  type CatalogOptions,
} from "glyphforge/catalog"
