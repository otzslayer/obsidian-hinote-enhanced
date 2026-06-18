// Minimal CodeMirror view stub for vitest
export class ViewPlugin {
    static fromClass() { return {}; }
}
export class Decoration {
    static none = { map: () => Decoration.none };
    static replace(_spec: unknown) { return new Decoration(); }
    static widget(_spec: unknown) { return new Decoration(); }
    static set(_arr: unknown[]) { return Decoration.none; }
    range(_from: number, _to?: number) { return { from: _from, to: _to }; }
}
export class EditorView {}
export class DecorationSet {}
export class WidgetType {
    toDOM(): HTMLElement { return document.createElement('span'); }
    eq(_other: WidgetType): boolean { return false; }
}
export type ViewUpdate = unknown;
