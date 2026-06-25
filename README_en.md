<div align="center">
	<h1>HiNote - Highlight Text with Comments</h1>
	<img src="https://img.shields.io/github/downloads/CatMuse/HiNote/total" alt="GitHub Downloads (all assets, all releases)" />
	<img src="https://img.shields.io/github/v/release/CatMuse/HiNote" alt="GitHub release (latest by date)" />
	<img src="https://img.shields.io/github/last-commit/CatMuse/HiNote" alt="GitHub last commit" />
	<img src="https://img.shields.io/github/issues/CatMuse/HiNote" alt="GitHub issues" />
	<img src="https://img.shields.io/github/stars/CatMuse/HiNote?style=social" alt="GitHub stars" />
</div>

---

[한국어](./README.md) | English

This AI-programmed Obsidian plugin can automatically extract highlighted text from notes, allowing users to add comments, generate AI comments, and engage in dialogue with the highlighted text. Users can highlight text in various formats, export it as knowledge card images or create new notes, while enjoying additional extended features in the main view.

>  This plugin is developed with AI assistance and is currently in Beta testing. Please use it with caution and back up your data regularly.

👇🏻 Click the image to view the video tutorial

[![HiNote Plugin Tutorial](https://img.youtube.com/vi/c1mxMGi1ZEk/maxresdefault.jpg)](https://www.youtube.com/watch?v=c1mxMGi1ZEk)

---

## ✨ Key Features

🎯 Auto-extract highlights in multiple formats | 📝 Add comments and notes to highlights | 🤖 AI-assisted comments and intelligent dialogue | 📸 Export as beautiful knowledge cards | 📝 Generate new notes linked to source | 🧠 Spaced repetition learning system (Pro)

> 💡 **Tip:** [Upgrade to Pro](https://hinote.vip) to unlock the FSRS-powered flashcard system for efficient memorization of your highlights

---

## Highlighted text retrieval

When you open a note with highlighted text, the sidebar automatically displays the highlighted text in card format. The following three formats of highlight tags are supported: `==`, `<mark>`, and `<span>`. Custom formats can also be defined using regular expressions.

![Highlighted text retrieval](./doc/highlighted-text-retrieval.jpg)

---

## Highlighted comments

The highlight comment feature allows you to quickly engage with highlighted text, preventing your ideas from slipping away. Simply click on the Widgets in the editing area or directly click the add comment button on the card to open the input box.

The note comment feature allows you to add your thoughts to the entire document without relying on any highlighted text. Click the add file comment on the right side of the search bar to open the input box at the top of the highlight list.

> **Inline storage & Obsidian Sync**: Comments are stored directly inside your Markdown notes as `{>>comment text ^YYYY-MM-DD HH:mm^<<}` blocks placed immediately after the highlighted text. Because comments live in `.md` files, **Obsidian Sync synchronises them natively** without any extra configuration.
>
> Flashcard data (Pro) continues to be stored in the `.hinote` folder and is unaffected by this change.

---

## Inline comment storage & sync

### How comments are stored

HiNote embeds comments directly in your note's Markdown source as [CriticMarkup](https://criticmarkup.com/) comment blocks:

```
==highlighted text=={>>Your comment ^2024-01-15 10:30^<<}
```

- The block is placed **immediately after** the highlight marker.
- The `^YYYY-MM-DD HH:mm^` token at the end is the timestamp; it is updated each time the comment is edited.
- AI-generated comments are prefixed with `🤖 ` inside the block.
- File-level comments (not tied to a specific highlight) are stored in the note's `frontmatter` under the `comments` key as a list of `{text, ts}` objects.

### Keyboard shortcuts

| Action | Default shortcut |
|--------|-----------------|
| Add comment to selection | `Mod+Shift+C` |
| Toggle text highlight (edit & reading mode) | `Mod+Shift+S` |
| Insert newline in comment | `Shift+Enter` |

The shortcuts can be rebound in **Settings → Hotkeys**.

> **Tip:** Press `Shift+Enter` in the comment input box to insert a newline. It renders as a CommonMark hard break (`<br>`) in the sidebar. Press `Enter` to save the comment.

### Obsidian Sync

Comments travel with the `.md` file — no additional sync setup required. Concurrent offline edits follow the same conflict-resolution flow as any other Markdown note.

### Known limitations

| Situation | Behaviour |
|-----------|-----------|
| **Source mode** | `{>>...<<}` raw syntax is visible. HiNote cannot hide decorations in source mode. |
| **Plugin disabled** | Raw `{>>...<<}` blocks remain in the file but are harmless plain text. |
| **CriticMarkup plugin installed** | Both plugins may apply styling to `{>>...<<}` blocks, resulting in double decoration. |
| **Orphan comments** | A `{>>...<<}` block whose preceding highlight marker has been deleted is tagged as an *orphan*. HiNote never auto-deletes orphans; they appear in the sidebar as a separate group. Remove them manually when no longer needed. |
| **Existing comments with backslash (`\`)** | Backslashes in comment text are encoded as `\\` on disk. If a comment saved before this version contains a `\n` pattern (backslash + `n`, e.g. `C:\nginx`), **the sidebar will immediately show a spurious newline when the note is opened.** Editing and saving the comment will also update the file on disk. |

### Migrating existing comments

If you have comments stored in the legacy `.hinote/highlights/` sidecar format, run the one-shot migration command:

1. Open the **Command Palette** (`Mod+P`).
2. Search for **"Migrate comments to inline storage"**.
3. Review the dry-run report and click **Apply Migration**.

The old `.hinote/highlights/` folder is **never deleted automatically** — it serves as a backup after migration.

---

## Export as image

Export your highlighted text and comments to create beautifully designed knowledge cards for easy sharing.

![Export as image](./doc/export-image.jpg)

---

## Export as note

Export all your highlighted text and comments as a new note, displayed in Callout format. Each highlight and comment can be linked back to the source note through block references (Block ID).

![Export as note](./doc/export-as-file.jpg)

---

## Extended features of the main view

Drag the right sidebar window to the main view to unlock more features, such as a list of notes with highlighted text, all highlighted cards, and HiCard.

- Notes List: Displays all notes in the knowledge base that contain highlighted text, with the number of highlights indicated.
- All Highlights: Shows all highlighted cards in the knowledge base, allowing you to focus more on the highlighted content.
- HiCard: Implements the functionality to generate FlashCards from your highlighted text and comments, assisting you in memorizing and learning (Pro feature)

![Main view](./doc/main-view.jpg)

---

## AI Comment

AI can assist you in thinking and add the generated content as a comment below the highlighted text.

First, you need to configure the AI provider, API Key, and model in the plugin's settings menu. Currently supported providers include OpenAI, Gemini, Anthropic, Deepseek, SiliconFlow, and Ollama.

Next, configure your custom Prompt. Here, you can use two fields to obtain the highlighted text and comment content: `{{highlight}}` and `{{comment}}`.

Finally, you can use your custom Prompt in the AI button on the highlighted card. Or you can input your custom Prompt in the comment input box and directly click the Tab key to trigger the AI service.

![AI Comment](./doc/ai-comment.jpg)

---

## Pro Features

HiNote offers additional premium features that enhance your note-taking and learning experience:

### Flashcard System

The Flashcard feature is available in the Pro version of HiNote. This advanced spaced repetition system helps you memorize your highlighted content more effectively:

- Convert your highlights into flashcards with just one click
- Utilize the FSRS (Free Spaced Repetition Scheduler) algorithm for optimal learning efficiency
- Customize review schedules to match your learning style

To access these premium features, you'll need to [upgrade to Pro](https://hinote.vip).

![HiCard](./doc/hi-card.jpg)

![HiCard Settings](./doc/hicard-setting.jpg)

[![HiNote Pro](./doc/hinote-pro.jpg)](https://www.hinote.vip/en.html)

---

## Support

If you find this plugin useful and would like to support its development:

- [Buy me a coffee on Ko-fi](https://ko-fi.com/catmuse)
- Give the project a ⭐ star to show your support!

---

## License

This plugin is released under the MIT License. The basic features are free and open-source, while some advanced features require a Pro license.
