/// <reference types="vitest" />
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        include: ['test/**/*.test.ts'],
    },
    resolve: {
        alias: {
            obsidian: path.resolve(__dirname, 'test/__mocks__/obsidian.ts'),
        },
    },
});
