> **DRAFT — NOT SENT.** Internal review needed before sending. Send only through a private channel (author's email or a private GitHub Security Advisory on paralin/modlock), never as a public issue.

---

**Subject:** Private security report: Modlock v0.1.68 (5 issues, fixes suggested)

Hi paralin,

Thank you for Modlock. We're building a community platform on top of it, pinned to v0.1.68 (commit `5da2253`). Before we depend on it we did a read-only review of the code, and we found a few issues we'd like to report to you privately first.

A few notes on what this report is:
- It comes from static reading of the source only. We did not build or run Modlock, and we did not test anything against any live service, including hyperline.gg. We have no working exploits and don't plan to write any.
- We marked the places where a conclusion depends on engine behaviour we couldn't verify.
- We'd be glad to send PRs for any of these, or to review your fixes.

**Proposed disclosure timeline:** we won't share details publicly until a fix ships or 90 days pass from the date of this message, whichever comes first. We're happy to extend that if you need more time, and to coordinate the date and wording of any advisory with you. Please tell us if you'd like a CVE requested or would rather handle it yourself.

## Summary (by severity)

| # | Issue | Severity (our estimate) |
|---|---|---|
| 1 | Host-supplied content path escapes the package directory on Windows guests | High |
| 2 | Console injection through bot names bypasses the `ServerCommand` denylist | High (when mods are untrusted) |
| 3 | Guests mount host content without the `check` rules | Medium |
| 4 | `ServerCommand` is a denylist and strips cheat/dev flags from every named command | Medium |
| 5 | `Session.Watch` trusts the guest-supplied `SteamId` | Medium |
| 6 | `/restartmod` accepted from any player | Low |
| 7 | `gameinfo.gi` read-modify-write is not atomic or locked | Low |
| 8 | C++ `ReadBuild` does not confine `entry` / `map` to the mod directory | Low (partial) |

---

### 1. Path escape when a Windows guest writes the session package (High)

**Code path**
- The host sends `ContentPart{Path, Data}` (`peernet/host.go:346-368`). The guest collects the parts unvalidated (`peernet/host.go:454-472`), and the CLI keys them by the raw path (`cmd/modlock/host.go:335-341`). `mountGuest` then calls `session.StartInterface` (`cmd/modlock/host.go:412-427`).
- `mountRenderer` moves entries matching `isMapArchive` (`session/renderer.go:113-119`, `214-217`: `path.Dir(name) == "maps" && path.Ext(name) == ".vpk"`) into `archives`. `writePackage` then does `filepath.Join(dir, filepath.FromSlash(name))` followed by `os.WriteFile` (`session/renderer.go:142-146`, `198-212`).

**Issue:** `isMapArchive` splits on `/` only. A name such as `maps/..\..\<…>\x.vpk` has `path.Dir == "maps"`, but on Windows `filepath.Join` treats `\` as a separator and cleans the `..` segments, so the write lands outside `game/citadel/modlock_dev/<key>/`. Nothing earlier on the join path rejects `..`, `\` or `:`. Linux/Proton guests aren't affected, and `../` with forward slashes is already stopped by `path.Dir`.

**Impact:** a session host running a modified daemon can write attacker-chosen bytes to any user-writable path ending in `.vpk` on a Windows guest, with no prompt. For example, it can overwrite the game's own or other addons' VPKs, which persistently tampers with or breaks the Deadlock install outside the session. We didn't find a direct route to native code execution.

**Reproduction (conceptual):** a host serves a content entry whose path starts with `maps/`, climbs with `..\` segments and ends in `.vpk`. A Windows guest runs `modlock join`, and the file appears outside `modlock_dev`.

**Suggested fix:** on the guest, reject any content path that fails `fs.ValidPath`, contains `\`, `:` or NUL, or isn't under `check.AddonDirs()` or exactly `maps/<simple-name>.vpk`. In `writePackage`, require `filepath.IsLocal`, and ideally write through `os.OpenRoot(dir)` (Go 1.24+).

### 2. Console injection through bot names (High when mods are untrusted)

**Code path**
- `Game::AddBot` stores the mod-supplied `request.name()` (`src/wasm/game_entities.cc:291`). `BotCreation::Create` only checks that the name is non-empty (`src/gameinterop/bot_creation.cc:25`).
- `Game::RemoveBot` runs `ServerCommand("kick \"" + name + "\"\n")` (`src/wasm/game_entities.cc:309`), and `Game::RemoveWorld` does the same for every bot (`src/wasm/game.cc:268`).
- Neither path goes through `RefuseConsoleLine` (`src/wasm/console_lines.cc:203-216`), which only runs in `GameServices::ServerCommand` (`src/wasm/game_services.cc:52`).

**Impact:** a mod can name a bot so that it closes the quoted argument and chains further commands (`"` followed by `;`). Those commands run on the server console when the bot is removed or the world is cleared, including ones the denylist blocks on purpose (`exec`, `rcon*`, `connect*`, `con_log*`, …). This assumes the Source 2 console splits on `;` outside quotes, as Source traditionally does. We did not test it.

**Suggested fix:** reject bot names containing `"`, `;`, CR/LF or control characters, and cap their length. Better still, kick by userid or slot (or through a native call) instead of by name, and build internal console lines through one helper that quotes or escapes arguments.

### 3. Guests mount host content without the `check` rules (Medium)

**Code path:** `cmd/modlock/host.go:334-346` and `412-427` pass the host's content straight to `mountRenderer`. In `session/renderer.go:106-108`, `maps.Copy(files, content)` runs after the renderer's files. `check.Content` and `check.Scripted` (`check/content.go:91-158`) are never applied on this path. The only `check.Mod` caller is `cmd/modlock/publish.go:39`. Content size is also unbounded (`peernet/host.go:454-472`, `cmd/modlock/host.go:341`).

**Impact:** a session host can run Panorama JS in a guest's game client with no prompt. It can also replace stock layouts or the renderer's own files (`latest_news.xml`, `boot.js`, `ui.js`), since the package outranks other mounts. If the guest exits uncleanly, the block stays in `gameinfo.gi` until the next session or `ClearStale`, so the content can affect normal play in the meantime. A host can also exhaust guest memory. How serious the JS part is depends on Deadlock's Panorama API surface, which we didn't verify.

**Suggested fix:** apply the `check.Content` addon-namespace rule on the guest (have the host send each mod's addon name, or enforce the `panorama/<kind>/<addon>/…` and `<asset>/<addon>/…` shape). Refuse paths that collide with renderer or stock files, ask the user before mounting scripted content, and cap total and per-file size. Longer term, guests could fetch published releases by hash from the service instead of from the host.

### 4. `ServerCommand` denylist and flag stripping (Medium)

**Code path:** `src/wasm/game_services.cc:50-82`. The line is checked against a denylist (`console_lines.cc:26-125`). Then, for every command name in it, `AllowServerChanges` runs (lines 71-75), which permanently clears `kExposureFlags | kCheatFlag` (`src/gameinterop/console_variables.cc:234-236`). The line is executed after that.

**Impact:** any command or cvar not on the list is allowed, including ones added by future game updates, and `sv_cheats` isn't listed. Any cheat-protected or development-only cvar a mod names becomes changeable for the rest of the server process, for all mods. When the list falls behind a game patch, it fails open.

**Suggested fix:** switch to an allowlist of commands and cvars mods may change, or at least limit `AllowServerChanges` to a reviewed or manifest-declared set that `check` validates. Restore the flags when the mod unloads.

### 5. `Session.Watch` trusts the guest-supplied `SteamId` (Medium)

**Code path:** `peernet/host.go:306-338` checks only the shared session secret (line 309), then selects the screen with `s.screens.Player(req.GetSteamId())` (line 326). The guest sets that ID itself (`peernet/host.go:427-430`, `cmd/modlock/host.go:302-312`). Nothing binds it to the authenticated peer (`mounted.GetPeerID()`, `peernet/host.go:123-131`).

**Impact:** anyone holding the join code, or any lobby member, can stream another player's UI live, including the host's. In modes with hidden information that amounts to a cheat.

**Suggested fix:** bind the account to the peer, for example by having the host record which peer's game stream became which slot, or by issuing a per-guest token at join. At minimum, refuse the host's account and any account another peer has already claimed.

### 6. `/restartmod` accepted from any player (Low)

**Code path:** `src/wasm/wasm_plugin.cc:297-327` accepts the chat command without looking at `line.slot` (available in `native_chat_hook.h:22-24`). `AskRestart` (`369-379`) honours it while the mod is stopped or within 5 minutes of a slow event (`kOfferWindow`, line 57).

**Impact:** this looks intentional, but any player can reset the mod's in-match state after a slow event, and repeated restarts of a failing mod stall the server tick.

**Suggested fix:** limit the command to the host or the developer/tester roles (the role table already exists), or require a vote, and rate-limit it.

### 7. `gameinfo.gi` edits are not atomic or locked (Low)

**Code path:** `devmount/devmount.go:112-125` does `os.ReadFile`, then `change`, then `os.WriteFile`, with no temp file and rename and no inter-process lock. `Hold` takes a *shared* lock (`devmount.go:79-88`), yet `mount.Close` (`session/renderer.go:176-180`) unmounts the fixed-name `MODLOCK DEV` block without checking for other live sessions.

**Impact:** a mod manager or a second session editing at the same time can lose updates. Readers can see a truncated file, and a crash mid-write leaves `gameinfo.gi` corrupt, so the game won't start until a Steam file verify. The first of two concurrent sessions to close also removes the other's block.

**Suggested fix:** write to a temp file in the same directory and `os.Rename` it over `gameinfo.gi` while holding an exclusive lock for the whole read-modify-write. Only unmount when no other session holds the lock, or use per-session block names.

### 8. C++ `ReadBuild` does not confine `entry` / `map` (Low, partial)

**Code path:** `src/wasm/build.cc:76` (`path / manifest.entry()`) and `:82` (`path / "maps" / (manifest.map() + ".bsp")`). With `std::filesystem`, an absolute right-hand side replaces `path`, and `..` is not rejected.

**Mitigation already present:** `sandbox.ReadBuild` (`sandbox/build.go:40-43`, used by `check.Mod`) requires `fs.ValidPath(entry)`, which blocks `..` and absolute entries for mods that pass `check`. Three gaps remain:
- `fs.ValidPath` accepts `\` and `:`, so a name that is harmless on a Linux publishing service can traverse on Windows.
- `map` isn't validated by `check`. `project/build.go:180` uses `filepath.IsLocal`, but `publish/mod.go:32-37` and the C++ loader don't.
- In practice this matters for platforms that load third-party published mods into `modlock-host`.

**Impact:** a file outside the mod can be read as the module or source. We found no useful way for the mod to read its contents, beyond possible leaks in error messages.

**Suggested fix:** in C++, reject absolute or root-named or `..`-containing `entry`/`map`, and check that `(path / x).lexically_normal()` stays under `path`. In `check.Mod`, validate `map` (for example with the slug pattern) and reject `\` and `:` in `entry`.

---

Thanks again for the project. We're happy to send PRs for any of these, starting with #1 and #2, or to share more detail. Please tell us how you'd like to coordinate.

Best regards,
[name / contact]
