import { defineConfig } from 'vitest/config';

// The deploy workflow sets GITHUB_RUN_NUMBER. It becomes the build number
// shown on screen, so a stale cached build is easy to spot on a phone.
const buildNumber = process.env.GITHUB_RUN_NUMBER ?? 'dev';

export default defineConfig({
  // Relative paths, so the game works from any sub-folder URL on GitHub Pages.
  base: './',
  define: {
    __BUILD_NUMBER__: JSON.stringify(buildNumber),
  },
  build: {
    // Phaser is a large library; this only silences the size warning.
    chunkSizeWarningLimit: 2000,
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
