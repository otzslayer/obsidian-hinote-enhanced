import { TFile } from 'obsidian';

export class ExcludePatternMatcher {
    /**
     * 파일을 제외해야 하는지 확인합니다
     * @param file 확인할 파일
     * @param patterns 제외 패턴 목록
     * @returns 파일을 제외해야 하면 true
     */
    static shouldExclude(file: TFile, patternsStr: string): boolean {
        if (!patternsStr || patternsStr.trim().length === 0) {
            return false;
        }

        // 쉼표로 구분된 문자열을 배열로 분할합니다
        const patterns = patternsStr
            .split(',')
            .map(pattern => pattern.trim())
            .filter(pattern => pattern.length > 0);

        const filePath = file.path;
        const fileName = file.basename;

        return patterns.some(pattern => {
            // 앞뒤 공백을 제거합니다
            pattern = pattern.trim();
            
            // 빈 문자열이면 건너뜁니다
            if (!pattern) {
                return false;
            }

            // 노트 링크 형식 [[note]]을 처리합니다
            if (pattern.startsWith('[[') && pattern.endsWith(']]')) {
                const noteName = pattern.slice(2, -2);
                return fileName === noteName;
            }

            // 파일 확장자 형식 *.extension을 처리합니다
            if (pattern.startsWith('*.')) {
                const extension = pattern.slice(2);
                return file.extension === extension || filePath.endsWith(extension);
            }

            // 폴더 경로를 처리합니다
            // 경로 형식을 일관되게 정규화합니다 (앞의 '/' 제거)
            const normalizedPattern = pattern.replace(/^\/+/, '');
            const normalizedPath = filePath.replace(/^\/+/, '');

            // 파일이 지정된 폴더 안에 있는지 확인합니다
            return normalizedPath.startsWith(normalizedPattern + '/') || 
                   normalizedPath === normalizedPattern;
        });
    }
}
