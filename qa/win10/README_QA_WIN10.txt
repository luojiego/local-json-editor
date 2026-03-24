JSON Config Editor - Desktop (Tauri) QA Guide

Scope:
- This project is now delivered as a desktop app.
- The old local HTTP server launch flow is removed.

Run in development:
1. Install dependencies:
   pnpm install
2. Start desktop dev mode:
   pnpm desktop:dev

Build for Windows:
1. Install dependencies:
   pnpm install
2. Build desktop app:
   pnpm desktop:build
3. Find artifacts in:
   src-tauri/target/release/bundle/

Notes:
- Do not open `dist/index.html` directly.
- File access is handled through Tauri native commands.
