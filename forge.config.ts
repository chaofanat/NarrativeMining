import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { resolve, basename } from 'path';
import fs from 'fs-extra';

const root = __dirname;

const nativeModules = [
  'better-sqlite3',
  'bindings',
  'file-uri-to-path',
  'sqlite-vec',
  'sqlite-vec-windows-x64',
];

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    name: 'NarrativeMining',
    executableName: 'narrative-mining',
  },
  hooks: {
    async postPackage(forgeConfig, packageResult) {
      for (const outputDir of packageResult.outputPaths) {
        const resourcesPath = resolve(outputDir, 'resources');
        const nodeModulesPath = resolve(resourcesPath, 'node_modules');
        await fs.ensureDir(nodeModulesPath);
        for (const mod of nativeModules) {
          const src = resolve(root, 'node_modules', mod);
          const dest = resolve(nodeModulesPath, mod);
          if (await fs.pathExists(src)) {
            await fs.copy(src, dest);
          }
        }
      }
    },
  },
  makers: [
    new MakerSquirrel({
      setupIcon: './resources/icon.ico',
    }),
    new MakerZIP({}, ['win32', 'darwin', 'linux']),
    new MakerDeb({
      options: {
        maintainer: 'Developer',
        homepage: 'https://github.com/electron-vue-template',
      },
    }),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      build: [
        {
          entry: 'src/main/index.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload/index.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
        {
          entry: 'src/main/workers/clustering.worker.ts',
          config: 'vite.worker.config.ts',
          target: 'main',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
  ],
};

export default config;
