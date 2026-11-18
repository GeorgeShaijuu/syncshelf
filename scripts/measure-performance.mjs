import http from 'http';
import { fork } from 'child_process';
import fs from 'fs';
import path from 'path';

function analyzeBundleSizes() {
  const manifestPath = path.join(process.cwd(), '.next', 'app-build-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    return { error: 'app-build-manifest.json not found' };
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const pages = manifest.pages || {};
  const results = {};

  for (const [pageKey, files] of Object.entries(pages)) {
    let totalBytes = 0;
    const fileStats = [];
    for (const file of files) {
      const filePath = path.join(process.cwd(), '.next', file);
      if (fs.existsSync(filePath)) {
        const size = fs.statSync(filePath).size;
        totalBytes += size;
        fileStats.push({ file, size });
      }
    }

    // Clean up display name
    let cleanName = pageKey.replace('/(dashboard)', '').replace('/(auth)', '').replace('/page', '');
    if (!cleanName) cleanName = '/';

    results[cleanName] = {
      rawKey: pageKey,
      totalBytes,
      totalKB: Number((totalBytes / 1024).toFixed(2)),
      fileCount: files.length,
    };
  }

  return results;
}

async function measureRoute(port, routePath) {
  const timings = [];
  const ttfbTimings = [];
  const runs = 4;
  let statusCode = 0;
  let bodySize = 0;

  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    let ttfb = 0;

    await new Promise((resolve, reject) => {
      const req = http.get(`http://127.0.0.1:${port}${routePath}`, (res) => {
        ttfb = performance.now() - t0;
        statusCode = res.statusCode;
        let bytes = 0;
        res.on('data', (chunk) => {
          bytes += chunk.length;
        });
        res.on('end', () => {
          const t1 = performance.now();
          bodySize = bytes;
          ttfbTimings.push(ttfb);
          timings.push(t1 - t0);
          resolve(true);
        });
      });
      req.on('error', reject);
    });

    // Small cool-down between requests
    await new Promise((r) => setTimeout(r, 50));
  }

  // Drop first run as warmup, average remaining
  const measuredTotal = timings.slice(1);
  const measuredTTFB = ttfbTimings.slice(1);

  const avgTotal = measuredTotal.reduce((a, b) => a + b, 0) / measuredTotal.length;
  const avgTTFB = measuredTTFB.reduce((a, b) => a + b, 0) / measuredTTFB.length;
  const minTotal = Math.min(...measuredTotal);

  return {
    route: routePath,
    status: statusCode,
    sizeKB: Number((bodySize / 1024).toFixed(2)),
    avgTTFBMs: Number(avgTTFB.toFixed(2)),
    avgTotalMs: Number(avgTotal.toFixed(2)),
    minTotalMs: Number(minTotal.toFixed(2)),
  };
}

async function run() {
  console.log('================================================================');
  console.log('       SyncShelf Performance & Navigation Benchmark             ');
  console.log('================================================================\n');

  console.log('--- 1. Client-Side JavaScript Bundle Breakdown (.next) ---');
  const bundles = analyzeBundleSizes();
  const routesToReport = ['/', '/calendar', '/shared', '/members', '/settings', '/pinned', '/login'];

  console.table(
    routesToReport.map((r) => ({
      'Route View': r,
      'JS Bundle (KB)': bundles[r]?.totalKB || 'N/A',
      'Chunk Count': bundles[r]?.fileCount || 0,
    }))
  );

  console.log('\n--- 2. Starting Next.js Production Server for Route Latency ---');
  const port = 3009;
  const server = fork('./node_modules/next/dist/bin/next', ['start', '-p', String(port)], {
    stdio: 'pipe',
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Server start timed out after 15s'));
    }, 15000);

    server.stdout.on('data', (data) => {
      const msg = data.toString();
      if (msg.includes('Ready in') || msg.includes('http://localhost:')) {
        clearTimeout(timeout);
        resolve(true);
      }
    });

    server.stderr.on('data', () => {});
    server.on('error', reject);
  });

  console.log(`Server started successfully on http://127.0.0.1:${port}.`);
  console.log('Measuring Route TTFB and Total Latency (3 production runs)...\n');

  try {
    const routes = [
      '/',
      '/calendar',
      '/shared',
      '/members',
      '/settings',
      '/login',
      '/api/workspaces',
    ];

    const results = [];
    for (const r of routes) {
      const res = await measureRoute(port, r);
      results.push(res);
    }

    console.table(
      results.map((r) => ({
        Route: r.route,
        Status: r.status,
        'Payload (KB)': r.sizeKB,
        'Avg TTFB (ms)': r.avgTTFBMs,
        'Avg Total (ms)': r.avgTotalMs,
        'Fastest (ms)': r.minTotalMs,
      }))
    );

    console.log('\n--- 3. Architectural Bottleneck Diagnosis Summary ---');
    console.log(`
[Bottleneck 1: Firestore onSnapshot Teardown on Route Change]
  - When switching between '/' and '/calendar', BoardHomePage unmounts and calls unsubscribe().
  - CalendarPage mounts, calls useWorkspaceItems(), sets loading=true, and reconnects onSnapshot.
  - Causes redundant network roundtrips to Firestore on every tab switch.
  - Solution: Lift useWorkspaceItems to (dashboard) layout via a WorkspaceItemsContext provider.

[Bottleneck 2: Sub-route Layout Data Fetching (Members/Shared/Settings)]
  - Members, Shared, and Settings pages have NO client cache; each sets loading=true on mount.
  - Navigating to /members triggers 3 sequential/blocking API requests (/members, /invites, /audit-logs).
  - Navigating to /shared triggers /api/workspaces/[id]/shares with full-page spinner.
  - Navigating to /settings triggers /api/workspaces/[id] with full-page spinner.
  - Solution: In-memory SWR (stale-while-revalidate) cache with instant initial render from cache.

[Bottleneck 3: Shiki Syntax Highlighter in Dependencies]
  - Shiki syntax highlighter bundled in /pinned (314 KB JS).
  - Solution: Ensure Board and Calendar keep lightweight pre-formatted syntax rendering without Shiki runtime overhead.

[Bottleneck 4: Search Input Context Churn]
  - BoardTopNav directly mutates searchQuery on every single keystroke.
  - Solution: Local input state with debounced propagation to BoardContext (150ms).
`);

  } finally {
    server.kill();
  }
}

run().catch((err) => {
  console.error('Benchmark Error:', err);
  process.exit(1);
});
