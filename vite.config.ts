// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'path';

export default defineConfig({
  base: './', // חובה להפצה
  plugins: [
    react(),
    // @ts-ignore
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              // This tells Vite: Don't bundle better-sqlite3, leave it for native Node.js
              external: ['better-sqlite3'],
            },
          },
        },
      },
      {
        entry: 'electron/preload.ts',
      },
    ]),
    // @ts-ignore
    renderer(),
  ],
  build: {
    outDir: 'dist',
  }
})

// export default defineConfig({
  // plugins: [
  //   react(),
  //   // @ts-ignore
  //   electron([
  //     {
  //       entry: 'electron/main.ts',
  //       vite: {
  //         build: {
  //           rollupOptions: {
  //             // This tells Vite: Don't bundle better-sqlite3, leave it for native Node.js
  //             external: ['better-sqlite3'],
  //           },
  //         },
  //       },
  //     },
  //     {
  //       entry: 'electron/preload.ts',
  //     },
  //   ]),
  //   // @ts-ignore
  //   renderer(),
  // ],
//   base: './', // ◄--- CRITICAL: Forces Vite to use relative paths for production assets
//   resolve: {
//     alias: {
//       '@': path.resolve(__dirname, './src'),
//     },
//   },
// });