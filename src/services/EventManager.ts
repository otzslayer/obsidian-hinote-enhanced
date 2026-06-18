import { App, Events, EventRef } from 'obsidian';

export interface HighlightEvents {
    'highlight:update': [filePath: string, oldText: string, newText: string, sourceId: string];
    'highlight:delete': [filePath: string, text: string, sourceId: string];
    'comment:update': [filePath: string, oldComment: string, newComment: string, sourceId: string];
    'comment:delete': [filePath: string, comment: string, sourceId: string];
    'comment-input:open': [highlightId: string, text: string];
    'flashcard:changed': [];
}

export class EventManager {
    private events: Events;

    constructor(private app: App) {
        this.events = new Events();
    }

    /**
     * 하이라이트 업데이트 이벤트를 발생시킵니다
     */
    public emitHighlightUpdate(filePath: string, oldText: string, newText: string, sourceId: string) {
        this.events.trigger('highlight:update', filePath, oldText, newText, sourceId);
    }

    /**
     * 하이라이트 삭제 이벤트를 발생시킵니다
     */
    public emitHighlightDelete(filePath: string, text: string, sourceId: string) {
        this.events.trigger('highlight:delete', filePath, text, sourceId);
    }

    /**
     * 댓글 업데이트 이벤트를 발생시킵니다
     */
    public emitCommentUpdate(filePath: string, oldComment: string, newComment: string, sourceId: string) {
        this.events.trigger('comment:update', filePath, oldComment, newComment, sourceId);
    }

    /**
     * 댓글 삭제 이벤트를 발생시킵니다
     */
    public emitCommentDelete(filePath: string, comment: string, sourceId: string) {
        this.events.trigger('comment:delete', filePath, comment, sourceId);
    }

    /**
     * 댓글 입력창 열기 이벤트를 발생시킵니다
     */
    public emitCommentInputOpen(highlightId: string, text: string) {
        this.events.trigger('comment-input:open', highlightId, text);
    }

    /**
     * 플래시카드 변경 이벤트를 발생시킵니다
     */
    public emitFlashcardChanged() {
        this.events.trigger('flashcard:changed');
    }

    /**
     * 이벤트 리스너를 등록합니다
     */
    public on<K extends keyof HighlightEvents>(
        event: K,
        callback: (...args: HighlightEvents[K]) => unknown
    ): EventRef {
        return this.events.on(event, callback);
    }

    /**
     * 이벤트 리스너를 해제합니다
     */
    public off<K extends keyof HighlightEvents>(
        event: K,
        callback: (...args: HighlightEvents[K]) => unknown
    ) {
        this.events.off(event, callback);
    }
}
