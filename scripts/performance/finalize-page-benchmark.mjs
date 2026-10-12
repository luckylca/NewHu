import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [outputDirectory, page] = process.argv.slice(2);

if (!outputDirectory || !page) {
    console.error('Usage: node finalize-page-benchmark.mjs <output-directory> <page>');
    process.exit(2);
}

const summaryPath = join(outputDirectory, 'summary.md');
const analyzerSummary = readFileSync(summaryPath, 'utf8');
const summaryRow = analyzerSummary.split('\n').find((line) => line.startsWith(`| ${page} |`));

if (!summaryRow) {
    console.error(`Could not find page metrics for ${page} in ${summaryPath}`);
    process.exit(1);
}

const columns = summaryRow.split('|').slice(1, -1).map((column) => column.trim());
const [scene, runs, refreshRate, presentIntervals, surfaceFlingerGaps, frameStats, stageP95, deadlineMisses, gfxInfo, gpu] = columns;
const distanceSamples = readdirSync(join(outputDirectory, `scene-${page}`))
    .filter((runDirectory) => runDirectory.startsWith('run-'))
    .map((runDirectory) => {
        const readyPath = join(outputDirectory, `scene-${page}`, runDirectory, 'ready.txt');
        const readyLog = readFileSync(readyPath, 'utf8');
        const match = readyLog.match(/actualDistanceDp=([\d.]+)/);
        return match ? Number(match[1]) : null;
    })
    .filter((distance) => distance !== null)
    .sort((left, right) => left - right);
const actualDistance = distanceSamples.length
    ? distanceSamples[Math.floor(distanceSamples.length / 2)]
    : null;
const environment = readFileSync(join(outputDirectory, 'environment.txt'), 'utf8');
const device = environment.match(/^device=(.+)$/m)?.[1] ?? 'unknown';
const duration = environment.match(/^scroll_duration_ms=(.+)$/m)?.[1] ?? 'unknown';
const requestedDistance = environment.match(/^requested_scroll_distance_dp=(.+)$/m)?.[1] ?? 'unknown';
const actualDistanceText = actualDistance === null ? 'unavailable' : `${actualDistance.toFixed(1)} dp`;
const hasFrameSamples = !gfxInfo.startsWith('n/a');
const runLogs = readdirSync(join(outputDirectory, `scene-${page}`))
    .filter((runDirectory) => runDirectory.startsWith('run-'))
    .map((runDirectory) => readFileSync(join(outputDirectory, `scene-${page}`, runDirectory, 'logcat.txt'), 'utf8'))
    .join('\n');
const peopleProfileRequestFailed = page === 'people' && /Failed to fetch user info/.test(runLogs);
const scrollState = actualDistance === null || actualDistance <= 0
    ? 'No scrollable range was available. This run is a route-render smoke only; scroll percentiles are not reported as performance evidence.'
    : !hasFrameSamples
        ? `The content can scroll ${actualDistanceText}, but gfxinfo recorded no rendered frames; these values are not valid scroll-performance evidence.`
        : peopleProfileRequestFailed
            ? `Scrollable content moved ${actualDistanceText}, but the People profile request failed; the feed data may be partial and this run is not a valid renderer A/B.`
            : `Scrollable content; actual benchmark travel was ${actualDistanceText}.`;

writeFileSync(join(outputDirectory, 'glass-analysis.md'), analyzerSummary);
writeFileSync(summaryPath, [
    `# Android page runtime benchmark: ${scene}`,
    '',
    `- Device: \`${device}\``,
    `- Runs: ${runs}`,
    `- Scroll driver: synthetic Page Runtime \`scrollToOffset(animated: true)\`; requested ${requestedDistance} dp for ${duration} ms per run.`,
    `- Actual median scroll range: ${actualDistanceText}. ${scrollState}`,
    '- ADB gesture injection was not used; manual touch behavior is not evaluated by this benchmark.',
    '',
    '| Metric | Result |',
    '|---|---:|',
    `| GfxInfo frame P50/P90/P95/P99 (ms) | ${gfxInfo} |`,
    `| GPU P50/P90/P95/P99 (ms) | ${gpu} |`,
    `| FrameStats work P50/P90/P95/P99 (tail window, ms) | ${frameStats} |`,
    `| FrameStats UI/RenderThread/GPU P95 (tail window, ms) | ${stageP95} |`,
    `| HWUI deadline misses (summed across runs) | ${deadlineMisses} |`,
    `| SurfaceFlinger present interval P50/P90/P95/P99 (tail window, ms) | ${presentIntervals} |`,
    `| SurfaceFlinger gaps over 1.5 display periods | ${surfaceFlingerGaps} |`,
    '',
    'Raw `gfxinfo`, `framestats`, logcat, SurfaceFlinger samples, route screenshot, and the original analyzer report are retained in this directory.',
    '',
].join('\n'));
