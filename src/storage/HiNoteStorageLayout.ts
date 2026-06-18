import { App } from 'obsidian';
import { FilePathUtils } from './FilePathUtils';

export async function ensureHiNoteDirectoryStructure(app: App, vaultPath: string): Promise<void> {
    const directories = [
        FilePathUtils.getHiNoteDir(vaultPath),
        FilePathUtils.getHighlightsDir(vaultPath),
        FilePathUtils.getFlashcardsDir(vaultPath),
        FilePathUtils.getMetadataDir(vaultPath)
    ];

    for (const dir of directories) {
        try {
            await app.vault.adapter.mkdir(dir);
        } catch {
            // 디렉토리가 이미 존재할 수 있으므로 오류 무시
        }
    }
}

export async function detectHighlightFilesFromStorage(
    app: App,
    vaultPath: string,
    onMappingDetected: (originalPath: string, safeFileName: string) => void
): Promise<string[]> {
    try {
        const highlightsDir = FilePathUtils.getHighlightsDir(vaultPath);
        const files = await app.vault.adapter.list(highlightsDir);
        const detectedFiles: string[] = [];

        for (const file of files.files) {
            if (!file.endsWith('.json')) continue;

            const baseName = file.replace(/\.json$/, '').replace(highlightsDir + '/', '');
            const originalPath = FilePathUtils.fromSafeFileName(baseName);
            detectedFiles.push(originalPath);
            onMappingDetected(originalPath, baseName);
        }

        return detectedFiles;
    } catch (error) {
        console.warn('하이라이트 디렉토리 스캔 실패:', error);
        return [];
    }
}
