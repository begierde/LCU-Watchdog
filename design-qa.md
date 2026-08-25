# Design QA — LCU Watchdog 0.2.0 UI/UX unification

- Source visual truth: `C:\Users\SilverSliver\Documents\ChatGPT\LCU-watchdog\output\ui-ux-audit\00-akari-reference.png`
- Primary implementation screenshot: `C:\Users\SilverSliver\Documents\ChatGPT\LCU-watchdog\output\playwright\overview.png`
- Additional implementation evidence: `players.png`, `player-detail.png`, `monitoring-settings.png`, `events.png`, `application-settings.png`, and `minimum-980x660.png` in `output\playwright\`
- Combined comparison: `C:\Users\SilverSliver\Documents\ChatGPT\LCU-watchdog\output\ui-ux-implementation\design-qa-comparison.png`
- State: connected JP LCU fixture; one disabled player with two history matches; dark theme
- Target viewport: 1180 × 762 CSS px; Windows device scale factor 1.5
- Minimum viewport: 980 × 660 CSS px; captured at 980 × 660 pixels
- Source pixels: 1534 × 1107; source CSS viewport and density are unknown
- Implementation pixels: 1770 × 1143 at the target viewport
- Density normalization: the combined comparison pads both images to 1770 px without stretching. Layout judgments use component proportions and the separately verified 1180 × 762 CSS geometry rather than treating unknown source pixels as CSS pixels.

## Full-view comparison evidence

The combined comparison places the Akari reference and LCU Watchdog overview in one image. Both use a narrow left navigation rail, integrated dark title bar, session tabs, dense bordered surfaces, restrained elevation, and purple selection states. LCU Watchdog intentionally uses a monitoring-health dashboard instead of copying Akari's match-analysis information architecture. The implementation retains an independent brand and uses the agreed purple plus magenta system.

The implementation evidence covers the full product flow rather than only the shell: health overview, compact player list, multi-player title tab, compact match rows, monitoring settings, basic-first event settings, application settings, and the minimum supported viewport.

## Focused comparison evidence

- Title chrome: the 44 px title bar, system tab, closeable player tab, right-side connection state, and native-style window controls align with the reference's frameless desktop character.
- Player detail: match rows preserve Akari-like density with champion image, result, queue, KDA, duration, and time while avoiding copied decorative assets.
- Settings: the three internal tabs use one consistent content width, card rhythm, form-row treatment, and sticky save state.
- Minimum viewport: `minimum-980x660.png` shows the fixed 208 px sidebar, player tab, settings tabs, and application cards without horizontal overflow or obscured persistent controls.

## Required fidelity surfaces

- Fonts and typography: Segoe UI Variable / Microsoft YaHei UI is used throughout. Headings, compact metadata, tabs, and controls have consistent optical weight, line height, truncation, and wrapping. No legacy uppercase microcopy remains.
- Spacing and layout rhythm: the UI follows a 4 px spacing basis, 6 px controls, 8–10 px dense rows/cards, 12 px dialogs, a 208 px sidebar, and a 44 px title bar. The player and match lists remain readable at minimum width.
- Colors and visual tokens: CSS and Naive UI consume the same TypeScript token source. The primary purple is `#7356C5`, realtime accent is `#D13F73`, and semantic colors are consistent. Automated tests confirm normal text and primary button contrast at or above 4.5:1.
- Image quality and asset fidelity: packaged Fluent icons replace Unicode glyphs. The application icon, summoner profile image, and champion images are real assets with initial-based loading/failure fallbacks and descriptive alt text. No image is replaced by CSS or text-symbol artwork.
- Copy and content: event sources, player states, queue IDs 400/440/710/2400, and recoverable errors are presented in human-readable Chinese. Technical identifiers remain available only in details views.

## Interaction and accessibility verification

- Primary interactions tested: three-item navigation, add-player dialog, keyboard-addressable player rows, session player tabs, event accordions, dirty-settings leave guard, discard changes, disabled event testing while dirty, maximize/restore, and minimum viewport layout.
- Player rows use actual buttons; switches and icon actions have player-specific accessible names.
- Main navigation exposes `aria-current`; title and content tabs expose `tablist` / `tab` semantics and selected state.
- Focus rings are visible and reduced-motion preferences are respected.
- Console and page errors checked: none.
- Native menu bar checked: hidden.
- Horizontal overflow checked at 1180 × 762 and 980 × 660: none.

## Comparison history

1. Initial audit found five competing navigation destinations, stale player titles, card-heavy player browsing, raw errors, always-visible event JSON, inconsistent save placement, Unicode navigation icons, and duplicated light/dark CSS.
2. First implementation consolidated navigation, introduced session player tabs, moved run-now into connection context, replaced the player grid with compact rows, grouped settings, collapsed advanced event controls, and introduced one token source.
3. First rendered pass found two P2 workflow-polish issues: the player-list screenshot caught the closing modal animation, and settings subsection changes retained an unrelated scroll position.
4. The modal capture now waits until hidden, and internal settings tab changes scroll the content region to the top. Post-fix screenshots show clean player browsing and aligned settings pages at both target and minimum viewport.

## Findings

No actionable P0, P1, or P2 visual or interaction differences remain within the selected direction. The implementation intentionally does not reproduce Akari's background artwork or match-analysis columns because LCU Watchdog's agreed primary outcome is monitoring health and event configuration.

## Follow-up polish

- P3: Real-client screenshots with several enabled players and live/restricted mixed states would provide a richer density check than the deterministic single-player QA fixture.
- P3: Windows high-contrast mode, 200% text scaling, and a full screen-reader pass remain manual acceptance checks beyond screenshot and UI Automation evidence.

final result: passed
