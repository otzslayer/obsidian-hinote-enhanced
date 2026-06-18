import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { execFileSync } from "child_process";

const VAULT = "/mnt/d/Documents/Vault";
const PLUGIN_ID = "hi-note-enhanced";
const DEST = join(VAULT, ".obsidian", "plugins", PLUGIN_ID);

const FILES = ["main.js", "manifest.json", "styles.css"];

if (!existsSync(VAULT)) {
	console.error(`볼트 경로를 찾을 수 없습니다: ${VAULT}`);
	process.exit(1);
}

mkdirSync(DEST, { recursive: true });

for (const file of FILES) {
	if (!existsSync(file)) continue;
	execFileSync("cp", [file, join(DEST, file)]);
	console.log(`복사 완료: ${file} → ${DEST}`);
}

console.log("배포 완료. Obsidian에서 플러그인을 리로드하세요.");
