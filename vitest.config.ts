import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Extra Vitest settings for `ng test` (angular.json `runnerConfig`): the coverage thresholds, which the builder's
 * own options cannot set per folder. What is measured comes from angular.json (`coverageInclude`: every `.ts` file
 * under src/app, also the ones no test imports, at 0 %; `coverageExclude`: specs, test doubles and the prototype's
 * legacy folders `rutas/`, `servicios/` and `componentes/` until they are removed). They apply when coverage is on
 * (`npm run test:coverage`, part of `npm run verify`); each threshold is the aggregate of the files its glob matches.
 */
const root = fileURLToPath(new URL('.', import.meta.url));
const featuresDir = join(root, 'src/app/features');

const atLeast = (percent: number) => ({
  statements: percent,
  branches: percent,
  functions: percent,
  lines: percent,
});

/**
 * Route entry files that a lane has not replaced yet: they still start with the base's mark ("a placeholder until
 * the lane builds the screen" or "the prototype screen until the lane replaces it"). They do not count; once the lane
 * writes the real screen in the entry file (and the mark goes away), it does.
 */
const PLACEHOLDER_MARK =
  /^\/\/ Entry of the route \(owned by [^)]+\): (a placeholder|the prototype screen)\b/;

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? listFiles(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

const placeholders = listFiles(featuresDir)
  .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
  .filter((file) => PLACEHOLDER_MARK.test(readFileSync(file, 'utf8')))
  .map((file) => relative(root, file).split('\\').join('/'));

/** One threshold per area folder (one lane each), so a lane's gap never fails another lane's gate. */
const areas = readdirSync(featuresDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => [`src/app/features/${entry.name}/**`, atLeast(80)] as const);

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      exclude: placeholders,
      thresholds: {
        // Every measured file (core, features, shared and the app shell), like the backend's 80 % global gate.
        ...atLeast(80),
        // Interceptor, session, guards, configuration, navigation and the API client.
        'src/app/core/**': atLeast(90),
        ...Object.fromEntries(areas),
      },
    },
  },
});
