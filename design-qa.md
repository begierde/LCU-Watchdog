# Design QA — Akari-inspired frameless dark shell

- Source visual truth: `C:\Users\SILVER~1\AppData\Local\Temp\codex-clipboard-11ec2359-0e62-41dc-984e-3de195c4cdc9.png`
- Implementation screenshot: `C:\Users\SilverSliver\Documents\ChatGPT\LCU-watchdog\output\playwright\overview.png`
- Combined comparison: `C:\Users\SilverSliver\Documents\ChatGPT\LCU-watchdog\output\playwright\titlebar-comparison.png`
- State: overview page, LCU connected, restored window
- Viewport: 1180 × 762 CSS px; Windows device scale factor 1.5
- Source pixels: 2313 × 114 (reference is a top-chrome strip only)
- Implementation pixels: 1769 × 1143; focused title-bar crop is the top 114 px
- Density normalization: the combined evidence preserves both source and implementation pixels and centers the narrower implementation crop. Layout judgments use relative title-bar height and alignment rather than raw one-to-one pixels because the source density and viewport are unknown.

## Full-view comparison evidence

The implementation screenshot shows the complete overview at the target launch viewport. The app now uses one continuous deep purple-gray surface, darker cards with subtle borders, a fixed sidebar, and a 44 px frameless top bar. No light page surface remains. The source only documents top chrome, so full-page information architecture and content density are treated as existing-product constraints rather than source mismatches.

## Focused comparison evidence

`titlebar-comparison.png` places the reference and implementation top regions together. Both use a dark purple title strip, left-aligned active tab, low-contrast divider, large draggable center region, right-side status/tools, and integrated minimize/maximize/close controls. The implementation intentionally keeps the existing LCU connection status and product branding.

## Required fidelity surfaces

- Fonts and typography: Segoe UI/Microsoft YaHei-style system typography preserves the reference's compact Windows app character. Tab text and chrome labels use compact weights and do not wrap.
- Spacing and layout rhythm: the 44 px title bar, 46 px window controls, fixed 224 px sidebar, thin divider, and compact tab match the reference proportions closely enough for the requested “Akari-like frameless feel.”
- Colors and visual tokens: deep purple-gray backgrounds, low-opacity borders, muted lavender secondary text, pink tab badge, and restrained green connection state are consistent across the shell and Naive UI controls.
- Image quality and asset fidelity: no screenshot imagery was needed in the interface. Window controls use packaged Fluent vector icon components; player/profile images continue to use their real game assets.
- Copy and content: existing LCU Watchdog copy is preserved. The title tab reflects the current page and optionally the selected Riot ID.

## Comparison history

1. Initial implementation used Electron's native `titleBarOverlay`. Visual capture showed the right-side control area empty, which was a P1 usability and fidelity issue.
2. Replaced it with a true `frame: false` window and three explicit Fluent-icon controls through a narrow preload IPC API. Added maximize/restore state synchronization and automated interaction coverage.
3. Post-fix evidence shows all three controls visibly aligned in the title bar. The smoke test successfully maximizes and restores the window, then confirms the original viewport is restored.

## Verification

- Primary interactions tested: navigation, add-player modal, event settings draft persistence, maximize, restore, and minimum viewport layout.
- Console/page errors checked: none.
- Horizontal overflow at 980 px minimum width: none.
- Remaining P0/P1/P2 findings: none.
- P3 follow-up: the current product logo differs from League Akari by design and can be replaced later if a dedicated LCU Watchdog brand asset is provided.

final result: passed
