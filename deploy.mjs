import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { execFileSync } from "child_process";

// 볼트 경로는 환경마다 다르므로 환경변수 HINOTE_VAULT로 지정합니다.
// 미지정 시 기존 기본 경로로 폴백합니다.
const VAULT = process.env.HINOTE_VAULT ?? "/mnt/d/Documents/Vault";
const PLUGIN_ID = "hi-note-enhanced";
const DEST = join(VAULT, ".obsidian", "plugins", PLUGIN_ID);

const FILES = ["main.js", "manifest.json", "styles.css"];

if (!existsSync(VAULT)) {
	console.error(`볼트 경로를 찾을 수 없습니다: ${VAULT}`);
	console.error(`환경변수 HINOTE_VAULT로 볼트 경로를 지정하세요. 예: HINOTE_VAULT="/path/to/Vault" npm run deploy:dev`);
	process.exit(1);
}

mkdirSync(DEST, { recursive: true });

for (const file of FILES) {
	if (!existsSync(file)) continue;
	execFileSync("cp", [file, join(DEST, file)]);
	console.log(`복사 완료: ${file} → ${DEST}`);
}

console.log("배포 완료. Obsidian에서 플러그인을 리로드하세요.");
