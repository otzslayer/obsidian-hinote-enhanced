// Minimal Obsidian API stub for vitest — pure-logic tests only.
// Adapter tests (InlineCommentWriter, InlineMigrationRunner) extend these stubs as needed.

export class TFile {
    path: string;
    basename: string;
    name: string;
    extension: string;
    stat = { mtime: 0, ctime: 0, size: 0 };

    constructor(path: string) {
        this.path = path;
        this.name = path.split('/').pop() ?? path;
        this.extension = this.name.includes('.') ? this.name.split('.').pop()! : '';
        this.basename = this.name.replace(`.${this.extension}`, '');
    }
}

export class TFolder {
    path: string;
    name: string;
    constructor(path: string) {
        this.path = path;
        this.name = path.split('/').pop() ?? path;
    }
}

export class TAbstractFile {
    path = '';
    name = '';
}

export class Vault {
    read = async (_file: TFile): Promise<string> => '';
    modify = async (_file: TFile, _content: string): Promise<void> => undefined;
    adapter = {
        read: async (_path: string): Promise<string> => '',
        write: async (_path: string, _data: string): Promise<void> => undefined,
        exists: async (_path: string): Promise<boolean> => false,
        list: async (_path: string) => ({ files: [] as string[], folders: [] as string[] }),
    };
    getFiles = (): TFile[] => [];
    getAbstractFileByPath = (_path: string): TAbstractFile | null => null;
    on = (_event: string, _callback: (...args: unknown[]) => unknown) => ({ unload: () => {} });
}

export class App {
    vault = new Vault();
    metadataCache = {
        getFileCache: (_file: TFile) => null as null | { frontmatter?: Record<string, unknown> },
        on: (_event: string, _callback: (...args: unknown[]) => unknown) => ({ unload: () => {} }),
    };
    fileManager = {
        processFrontMatter: async (
            _file: TFile,
            fn: (frontmatter: Record<string, unknown>) => void
        ): Promise<void> => {
            const fm: Record<string, unknown> = {};
            fn(fm);
        },
    };
}

export class Notice {
    constructor(public message: string) {}
}

export class Plugin {
    app = new App();
    manifest = { id: 'hi-note', name: 'HiNote', version: '0.5.7' };
    addCommand = (_cmd: unknown) => {};
    registerEvent = (_evt: unknown) => {};
    registerDomEvent = (_el: unknown, _type: string, _handler: unknown) => {};
    loadData = async () => ({});
    saveData = async (_data: unknown) => {};
}

export class Modal {
    app: App;
    constructor(app: App) { this.app = app; }
    open = () => {};
    close = () => {};
    onOpen = () => {};
    onClose = () => {};
}

export class PluginSettingTab {}
export class Setting {}
export class ItemView {}

export function setIcon(_el: unknown, _icon: string): void {}

export const Platform = { isMobile: false, isDesktop: true };
export class Component {
    load = () => {};
    unload = () => {};
    register = (_fn: () => void) => {};
}

export class MarkdownRenderer {
    // 실제 API와 동일한 시그니처. 테스트에서는 마크다운 메타문자를 제거한
    // 텍스트를 el 에 채워 renderPlainText 가 textContent 로 plainText 를 얻게 한다.
    static render = async (
        _app: unknown,
        markdown: string,
        el: HTMLElement,
        _sourcePath: string,
        _component: unknown
    ): Promise<void> => {
        el.textContent = markdown.replace(/[*`[\]~<>$_=]/g, '');
    };
}

export function normalizePath(path: string): string {
    return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}
