# Native512 Production Integration Status

Date: 2026-09-24

## Scope

This integration lives in the Mac NewHu main project only. Windows remains the research/model-validation workspace.

On 2026-09-24, **B / Native512 RelevanceMax was promoted as the sole production recommendation backend**. Product V1 128D, A Compat128, B MicroBalanced, and screenBalanced remain research history only and are no longer selectable or bundled as production recommendation paths.

No real-device latency/battery validation is claimed in this status.

## Shared Semantic V2 encoder and badge path

- B64 INT4 selector: downloaded from Gitee Semantic V2 runtime package v1
  - bytes: 11,602,862
  - SHA-256: `c3c1b1ff80ea0bcfca688b0740823aeb8494f96c1ef2f229cbb7018ff41bb499`
  - Gitee anonymous raw access requires the selector to be split into 3 chunks: 4,000,000 + 4,000,000 + 3,602,862 bytes; the app reassembles and verifies the full SHA-256 before use.
- Badge fallback V32: downloaded from the same Gitee runtime package.
- Tokenizer: B64 mobile64 WordPiece tokenizer with frozen golden contract.
- Badge path: native Zhihu topics are ranked semantically first; no usable native topic falls back to broad/leaf semantic classification.
- Same-broad leaf refinement keeps the frozen gate: global top-1 leaf cosine >= 0.60 and global top1-top2 margin >= 0.02.
- Conservative cross-broad Leaf Rescue V43 is enabled only on broad/leaf disagreement: global top-1 leaf cosine >= 0.60 and margin >= 0.05. Historical426 improved 79.11% -> 88.73% with 0 harmful flips; independent strict716 improved 73.32% -> 88.97% with 1 adjacent-boundary harmful flip.

## Production recommendation backend

### Native512 · RelevanceMax

Production policy: `Native512ProductionPolicyV1`.

- article embedding: raw normalized 512D B64
- semantic relevance: raw normalized 512D
- interest assignment: raw normalized 512D
- profile update/similarity: raw normalized 512D
- seed routing: raw normalized 512D
- topic-graph routing: raw normalized 512D
- production state namespace: `semantic_b_native512_relevanceMax`
- settings migration forcibly maps legacy `product_v1`, `compat128`, and `microBalanced` selections to Native512/RelevanceMax.

Retired production paths are no longer selectable and their bundled assets were removed:

- Product V1 128D runtime backend
- A Compat128 and its fused 512→128 ONNX
- 128D Seed / Topic Graph routing vectors
- B MicroBalanced assignment mean
- screenBalanced list-level experiment

Legacy persisted state is not destructively deleted; it remains untouched for forensic/rollback history but is never loaded by the production runtime.

## Routing assets

- Native512 seed512: SHA-256 `91ec944276353bcaa2516c65a41d65710ee00ccf6a5e07fdf7fe9dc8b3e636ba`
- Native512 topic graph512: SHA-256 `ffc59f7fb2a5bec6116196a642eec552fbaa2b84afba3a94481c1291703067c7`
- int8 routing dequant scale: `1/127`
- 2706 fixed Seed rows, all in the 512D B64 semantic space.

The production runtime package is hosted at `https://gitee.com/lcaluckily/NewHuRecommend/tree/master/semantic-v2/v1` (Gitee HEAD `f57408834d10fe6c9e380801b27bb6fabcf3e44d`). It contains the 11.6 MB B64 selector, 1.48 MB badge fallback model, 1.28 MB Seed Bank JSON, 1.39 MB 512D Seed vectors, 1.33 MB Topic Graph JSON, and 1.65 MB 512D Topic Graph vectors: 18,723,692 bytes total. Every file is pinned by exact size + SHA-256 in the app.

## State and feedback

Production reads and writes only the `semantic_b_native512_relevanceMax` namespace for:

- profile
- reward stats
- exposure history
- used candidates
- active/reserve candidate inventory
- ratio/controller state
- in-memory exposure de-duplication

Feedback payloads record `native512`, the RelevanceMax geometry version, and embedding dimension `512`. Old A/V1 namespaces are left untouched and are not merged into the 512D profile.

## Developer UI

`app/product-v1.tsx` now exposes a single production status:

- **Native512 · RelevanceMax**
- 512D Encoder / Profile / Seed / Topic Graph / Search Routing
- no V1/A/B backend selector
- no MicroBalanced selector
- explicit Gitee v1 download/status control for the 18.7 MB Semantic V2 runtime package
- automatic ensure/download when recommendation or badge inference first needs the runtime

Storage Management counts both legacy 128D files and downloaded Native512 runtime files. Deleting recommendation runtime files preserves the 512D profile/history and causes Native512 resources to be downloaded again on next use.

## Validation completed on Mac

- TypeScript: `npx tsc --noEmit` PASS
- Unit tests: **141/141 PASS**
  - includes frozen Semantic V2 tokenizer golden test
  - includes recommendation geometry regression tests
  - includes three policy-level Leaf Rescue regression tests
- Lint: 0 errors; current tree has 4 warnings (3 historical `src/api/client.ts` warnings plus one existing `app/home.tsx` hook-dependency warning)
- Expo Android export after Gitee runtime migration: PASS
- Android native Debug `arm64-v8a` build after Gitee runtime migration: **BUILD SUCCESSFUL**
- Candidate Acquisition V4 Android Metro export: **PASS** (large Semantic V2 runtime assets remain online-only).
- Candidate Acquisition V4 Android native Debug `arm64-v8a`: **BUILD SUCCESSFUL** (`678` actionable tasks; `46` executed / `632` up-to-date).
- Gitee anonymous-download verification: all 3 selector chunks plus badge/Seed/TopicGraph files match the frozen size and SHA-256; reassembled selector matches the original full SHA exactly.
- Metro/APK inspection confirms selector, badge, Seed Bank, 512D Seed vectors, Topic Graph JSON and 512D Topic Graph vectors are **not bundled in the APK**; only small tokenizer/policy/topic metadata remain bundled.

## Candidate Acquisition V4 (2026-09-24 real-feed follow-up)

A real-device trial exposed two production-integration regressions: Search/Seed acquisition was rarely participating in the feed, and high explicit Crypto ratios were not reachable even though the 2706-seed bank had sufficient Search supply. Windows research reproduced and closed both issues before Mac migration.

Frozen V4 production contract now integrated on Mac:

- Search stopping uses **displayable supply**, not raw Active inventory counts.
- EXPLICIT ratio deficit tolerance is `0`; AUTO keeps tolerance `1`.
- each Search request evaluates the full returned page after semantic/HQ eligibility, retains at most **12** qualified candidates, activates only the current display quota, and sends the remainder to Reserve.
- per-interest Reserve cap is `max(30, 4 * desiredSupply)`; global Reserve cap remains `120`; Reserve TTL remains `168h`.
- an exact Search unit is `seedId@offset`; offsets rotate `0 -> 20 -> 40` with a 24h history TTL.
- seed family is a **soft current-cycle diversity preference only**. It is no longer permanently blocked by historical `memory.records`.
- explicit display quota is normally `2` candidates per Search unit and becomes `3` only for a large explicit display deficit (`>=7`).
- deficit Search request budget is `min(10, ceil(displayDeficit / quota) + 3)` with an overall max of 10 deficit requests/cycle.
- the old global Search-display cap of 6 and blanket no-consecutive-Search rule are removed; normal interest burst protection remains max 3.
- AUTO has a soft Search exploration target of **3/20**, hard minimum 0, at most one proactive request/cycle, and only promotes same-interest Search when quality loss is <=0.12.
- trace now records raw Active supply, displayable supply, per-interest Search quota, Search unit keys, Search displayed count/share, and target-vs-achieved ratio.

Windows closeout evidence:

- Crypto has 60 seed rows / 10 parent families; final B512 historical Search yield is 17 qualified candidates/page with target-best purity 99.03%.
- `加密货币` vs `加密货币 原理`: 16 qualified each, qualified-result Jaccard 0, second query adds 16/16 new qualified results. Across 28 Crypto query pairs, median Jaccard is ~3.03% and the second query adds 15.86 candidates on average.
- exact-order replay: 40/50/60/70% explicit targets are reachable only after V4 removes the mismatched raw-supply/fixed-source caps; full V4 reaches 8/10/12/14 slots respectively.
- 40-cycle normal stress at 70% target reaches the target in 100% of trials at ~1.08 Search requests/cycle on average. Fault stress remains bounded by the 10-request recovery budget.
- extreme four-interest 25/25/25/25 cold start can require a second cycle under the 10-request latency bound; the second cycle converges in 100% of the tested 0–20% fault cases.

Windows reports: `native512_candidate_acquisition_v4_closeout.json` and `native512_candidate_acquisition_v4_supplemental_closeout.json`.

## Search qualification / supply audit

- Final B Search qualification remains `target semantic cosine >= 0.24` with no target-vs-bestOther relative margin.
- Re-scored historical real Search pages under final B512: median qualified/page 16, P05 13, minimum 11; one request filled desired+buffer in 100% of search-eligible page/profile pairs.
- Corrected target-best purity is 95.62%. The earlier ~80% diagnostic used separately accumulated BLAS scores and was numerically wrong; qualification/yield counts were unaffected.
- Cybersecurity target-best purity is 62.68%, but 877/920 non-top1 cases are primarily Programming overlap and Badge V7 still labels 647/920 as Cybersecurity; relative-margin filtering was therefore rejected because it reduced supply for only small purity gain.

## Not yet claimed

- no phone-side latency/battery benchmark after the production promotion
- no **post-V4** real-device feed validation yet; the pre-V4 phone trial is what exposed the Search participation and explicit-ratio regressions
- no release build/release publication
