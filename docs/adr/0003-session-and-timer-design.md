# ADR-0003: ChurrascoSessionService and Timer Design for Milestone 2

- **Status**: Accepted
- **Date**: 2026-04-26
- **Deciders**: Project owner（grill-me セッション 2026-04-26 を経て決定）

## Context

ADR-0001 で v0.1 の出発点を、ADR-0002 で M1 の `MeatDeckService` 設計を固定した。M1 は PR #17 のマージで完了し、`drawNext(state, allMeats, rng?)` が stateless 関数として動いている。Stop hook で `pnpm ci`（biome / tsc --noEmit / knip / vitest --coverage / audit）が各ターン後に強制される運用に乗っている。

`docs/roadmap.md` の次フェーズは **Milestone 2 — Session and timer**: `docs/spec/state-and-commands.md:7-21` に記された `SessionStatus` / `ChurrascoSessionState` を `src/domain/session.ts` として導入し、`docs/spec/architecture.md:159-167` に責務記述された `ChurrascoSessionService` で start / stop / pause / tick / 肉到着を実装する。M2 done-when は次の 3 条件:

1. 短い `intervalMinutes` で肉到着が観測可能
2. `stop` 後はタイマーが発火しない
3. `deactivate` 時にタイマーが dispose される

spec はコマンドごとの「成功パスの遷移先」のみ規定しており、不正状態からの呼び出し / 異常設定値 / dispose 後の利用 / sleep 復帰時の挙動 / pause からの復帰口は未定義。これらは ADR で明文化しないと M3 以降で「あの時こう決めた」が口承になる。

`MeatDeckService` の field 名 `MeatDeckState.deck` は spec の `ChurrascoSessionState.meatDeck` と命名差があり、ADR-0002 §9 (a) で M2 着手時に rename する旨が事前承認済み。これも本 ADR で確定させる。

## Decision

以下 11 点を M2 の `ChurrascoSessionService` 設計として採用する。

### 1. クラス（Disposable 実装）

`ChurrascoSessionService` はクラスとして実装し、`vscode.Disposable` を満たす。`setInterval` ハンドルと `EventEmitter<ChurrascoSessionState>` がインスタンス所有物となるため、M1 の `MeatDeckService` のような stateless 関数群では収まらない。

```ts
class ChurrascoSessionService implements Disposable {
  constructor(deps: {
    meats: Meat[];
    getIntervalMinutes: () => number;
    tickIntervalMs?: number;  // default 1000
    rng?: () => number;
  });
  get state(): Readonly<ChurrascoSessionState>;
  readonly onStateChange: Event<ChurrascoSessionState>;
  start(): void;
  stop(): void;
  pause(): void;
  dispose(): void;
}
```

### 2. tick: 1 秒固定 + 1 秒ジッター容認

`setInterval(tick, 1000)` で 1 秒粒度の polling。`Date.parse(nextArrivalAt) <= Date.now()` を判定して true なら `drawNext` を呼ぶ。最大 1 秒の遅延が乗るが、`docs/spec/overview.md:11` の「strict Pomodoro timer ではない」と整合する。

二段タイマー化（`setInterval(1s)` + `setTimeout(nextArrivalAt - now)`）は dispose / pause / stop の経路で 2 つのハンドルをライフサイクル管理する必要があり、テスト経路を膨らませるため不採用。

`tickIntervalMs` は DI で上書き可能（テスト用）。

### 3. コマンドの状態別セマンティクス

spec 未規定の境界を以下で固定する。

| Command | 元状態 | 動作 |
|---------|-------|------|
| `start` | `stopped` | `status='running'`, `startedAt=now`, `nextArrivalAt = now + intervalMs`, `today` を当日日付に更新 |
| `start` | `paused` | **resume**: `status='running'`, `nextArrivalAt` 維持 |
| `start` | `running` | no-op (spec §82 準拠) |
| `start` | `meatArrived` / `full` | no-op |
| `pause` | `running` | `status='paused'`, `nextArrivalAt` 維持、interval 維持 |
| `pause` | その他 | no-op |
| `stop` | 任意 | `status='stopped'`, `currentMeatId=null`, `nextArrivalAt=null`, `clearInterval` |
| `stop` | `stopped` | shallow-equal guard により `onStateChange` 発火なし |

### 4. `paused → start` で resume

spec の Commands カタログ（`docs/spec/state-and-commands.md:60-71`）に resume コマンドが存在しないため、`start` が pause からの復帰口を兼ねる。これにより `pause` が片道切符にならない。`start` は元状態で 4 つの分岐を持つ複合操作になるが、コマンドカタログを増やさずに resume を実現する最小コスト案。

### 5. `setState` shallow-equal guard で全コマンド冪等化

private ヘルパ `setState(next: ChurrascoSessionState)` 内で「現状と shallow-equal なら early return（fire しない）」を実装する。これで start / stop / pause すべての冪等性を一貫して担保し、`stopped → stop` で重複の end-of-session summary（M5 で実装予定）が出るような spurious 発火を抑止する。

### 6. 設定読み取り: snapshot のみ（reactivity は M3 へ）

`getIntervalMinutes: () => number` を関数 DI で受け、`start()` 時に 1 回だけ呼んで snapshot を取る。`workspace.onDidChangeConfiguration` の監視は M2 では入れない。

理由:
- M2 done-when に reactivity は含まれない
- `onDidChangeConfiguration` 監視は `Disposable` を 1 つ増やし、テストモックも追加する必要がある
- M3 で `StatusBarController` が `mm:ss` 表示する際、設定変更時の表示更新は自然に必要になるため、その時点でまとめて入れた方が一貫した設計になる

### 7. 設定 sanitize は extension.ts で吸収、Service 内部は無防備

`package.json` の schema (`minimum: 0.1`) はユーザが `settings.json` 直書きで違反値を入れられる。NaN / Infinity / 負数 / 0 / 文字列 / null が来うる。

`src/constants/configuration.ts` に `sanitizeInterval(value: unknown): number` ヘルパを置き、`Number.isFinite(v) && v > 0 ? v : 10` で正規化。`extension.ts` で:

```ts
getIntervalMinutes: () => sanitizeInterval(
  workspace.getConfiguration('churrasco').get<number>('intervalMinutes', 10),
)
```

として吸収する。`ChurrascoSessionService` 自身は不正値を受け取らない前提で動き、内部に defensive guard は入れない（ADR-0001 / 0002 の「消費先のないコードを延期する」「dead branch を避ける」原則）。

`window.showWarningMessage` での通知は過剰（VS Code の schema 違反赤線で既に視認できる）として不採用。

### 8. dispose: `disposed` フラグなし、API 保証で冪等

```ts
dispose(): void {
  if (this.tickHandle !== null) {
    clearInterval(this.tickHandle);
    this.tickHandle = null;
  }
  this.stateEmitter.dispose();
}
```

`clearInterval(null)` は no-op、`EventEmitter.dispose()` は二度呼んでも安全な VS Code API 仕様。`disposed` フラグを置くと dead branch が増えてカバレッジ閾値を支えるための無意味な防御コードになるため不採用。

dispose 後の `start`/`stop`/`pause` 呼び出しは仕様外（実装上は例外なく動くが保証しない）。テストで担保するのは「dispose 後に時間を進めても tick 発火しない」「dispose 二度呼びで throw しない」の 2 点のみ。

多重 activate（VS Code の保証違反）の防御も同じ理由で入れない。

### 9. sleep 復帰時は「即座に 1 つ arrive」

PC を sleep した結果 `nextArrivalAt` が過去になった場合、復帰直後の tick で guard `Date.parse(nextArrivalAt) <= Date.now()` が true になり、1 個 draw して `meatArrived` で停止する。spec の「10 分ごと」とは若干ズレるが M2 では eat/pass がないため 1 個で打ち止め。M4 で eat/pass が入ると、ユーザ操作後の `nextArrivalAt = now + interval` 再計算で自然に正しいリズムに復帰する。

heuristic な sleep 検知（前回 tick からの経過時間で判定など）は v0.1 のスコープを超えるため不採用。M5 の `globalState` 永続化が入る際、起動時の同じ問題（古い `nextArrivalAt` が残っている）と一緒に再検討する（§Future work）。

### 10. `today` は空文字初期化、`start()` でスナップ

`initialSessionState.today = ''` で初期化（`new Date().toISOString().slice(0, 10)` をモジュール評価時刻で埋め込む案は不採用、テスト時刻 mock の効果が及ばないため）。`start()` の中で `today: new Date(Date.now()).toISOString().slice(0, 10)` を設定する。

M2 では日付変更検知（24:00 跨ぎ）を実装しない。M5 の `TodayLogService` 導入時に「tick 内で `today` と `new Date(now).slice(0,10)` が乖離したらログをリセット」を追加する（§Future work）。

### 11. `MeatDeckState.deck → meatDeck` rename

ADR-0002 §9 (a) の事前承認パス。`SessionService` 実装の前に独立した structural コミットとして `MeatDeckService.ts` / `MeatDeckService.test.ts` を同時更新する。これにより `ChurrascoSessionState.meatDeck` と `MeatDeckState.meatDeck` の field 名が完全一致し、tick 内で `drawNext({ meatDeck: state.meatDeck, lastServedMeatId: state.lastServedMeatId }, ...)` が自然に書ける。

### コミット分割（Tidy First / 6 commit）

ADR-0001 / 0002 の 4-commit パターンを踏襲し、構造変更と振る舞い変更を分離する。

| # | Type | Subject | 性質 |
|---|------|---------|------|
| 0 | docs | `docs(adr): add ADR-0003 for ChurrascoSessionService and timer design` | docs |
| 1 | refactor | `refactor(deck): rename MeatDeckState.deck to meatDeck` | structural |
| 2 | feat | `feat(config): add CONFIGURATION_KEYS and sanitizeInterval helper` | structural |
| 3 | feat | `feat(session): add ChurrascoSessionState domain type and initial state` | structural |
| 4 | feat | `feat(session): implement ChurrascoSessionService with start/stop/pause/tick` | behavioral |
| 5 | feat | `feat(extension): wire ChurrascoSessionService and stop/pause commands` | behavioral |

各コミット時点で `pnpm ci` を満たす。

## Consequences

### Positive

- spec 未規定の境界（コマンド状態別セマンティクス・異常値・dispose 衛生・sleep 復帰・`today` 初期化）が一箇所に文書化される
- `setState` shallow-equal guard で start / stop / pause の冪等性が一貫
- `paused → start` で resume を実現することで Commands カタログを増やさずに pause の復帰口が確保される
- `sanitizeInterval` を `extension.ts` 側に置くことで Service の責務（タイマー管理）が純粋に保たれ、テスト時に常に有効値が前提にできる
- 6-commit 分割で `git bisect` / `git revert` の精度が高い
- `MeatDeckState.deck → meatDeck` rename を独立 commit にすることで Service 実装 commit に rename ノイズが混じらない

### Negative

- `start` が元状態で 4 分岐（stopped / paused / running / meatArrived・full）を持つ複合操作になり、テストケースが増える
- M5 で persistence が入るときに `today` 初期化と sleep 復帰の再設計が必要になる
- `getIntervalMinutes` を関数 DI にしたため、設定読み取りが 1 段抽象化される（直接 `workspace.getConfiguration` を読むより僅かに冗長）

### Neutral

- 本 ADR は M2 範囲の決定であり、M3（StatusBar / QuickPick）以降のサービス設計（UI 配線、Notification、TreeView、永続化）には直接影響しない
- `EventEmitter<ChurrascoSessionState>` の選択は M3 の `StatusBarController` が `onStateChange` を subscribe する想定に整合するが、Controller 設計自体は M3 の ADR で別途決定する

## Future work

以下は本 ADR のスコープ外、後続 ADR / マイルストーンで再検討:

- **設定 reactivity**: `workspace.onDidChangeConfiguration` で `intervalMinutes` 変更を即時反映 → M3 で `StatusBarController` の reactivity と一緒に実装
- **sleep 復帰の catch-up**: `nextArrivalAt` が大幅に過去のとき複数 arrive させるか / catch-up を捨てるか → M5 永続化と一緒に再検討
- **日付変更検知**: 24:00 跨ぎで `today` と log をリセット → M5 の `TodayLogService` で実装
- **コマンドカタログ拡充**: `eatCurrentMeat` / `passCurrentMeat` (M4)、`showTodayLog` / `resetToday` (M5)、`openMenu` (M3) → 各マイルストーンで段階追加。M2 完了時点で 3/8 コマンドが registered

## Alternatives Considered

### Stateless functions（M1 と同じ設計）

`ChurrascoSessionService` も pure functions の集合とし、`tickHandle` は呼び出し側（`extension.ts`）が保持する案。`extension.ts` の責務（architecture.md §138-157「Wiring only. Does not: Run the meat draw...」）を超え、タイマー管理が `extension.ts` に漏れるため不採用。

### 二段タイマー（`setInterval` + `setTimeout`）

UI countdown 用の `setInterval(1s)` と arrival 用の `setTimeout(nextArrivalAt - now)` を併用する案。arrival は ms 精度になるが、pause / stop / dispose の経路で 2 つのハンドルを teardown する必要があり、テストパスが増える。spec が 1 秒精度を求めていないため不採用。

### `disposed` フラグでガード

`dispose()` 後の `start`/`stop`/`pause` を no-op にする案。dispose 後の利用は VS Code の通常運用では発生せず、テストで意図的に呼ばないとカバーされない dead branch になるため不採用。

### `meatArrived → start` で「冷めた肉を捨てる」

`meatArrived` 状態で `start` が呼ばれたら現在の肉を破棄して通常起動する案。`docs/spec/state-and-commands.md` には `cooled` ログ概念（M5 予定）があり、「捨てる」セマンティクスは `cooled` log に倒すべきで `start` が暗黙に行うべきではない。M2 では no-op に留める。

### 完全 reactive な設定読み取り

`workspace.onDidChangeConfiguration` で `intervalMinutes` 変更を即時 `nextArrivalAt` に反映する案。M2 done-when に含まれず、Disposable / テストモック / 「変更検知時に既に過去になった `nextArrivalAt` をどう扱うか」の追加判断を呼ぶ。M3 で StatusBar reactivity と合わせて入れる方がコスト効率が高いため M2 では不採用。

### `window.showWarningMessage` で sanitize 通知

不正な `intervalMinutes` を 10 にフォールバックする際にユーザに通知する案。VS Code の schema 違反赤線で既に視認できるため過剰。`settings.json` 直書きしているユーザは何が起きたか自分で気付ける。不採用。

### 5-commit / 7-commit 分割

ADR を不要化する 5-commit、または config と sanitize を分離する 7-commit。ADR を省くと M3 以降で口承化リスクが高い。config と sanitize は同一ファイル（`src/constants/configuration.ts`）に同居するため 1 commit が自然。6-commit を採用。

## References

- `docs/roadmap.md` Milestone 2
- `docs/spec/state-and-commands.md:7-21`（`SessionStatus` / `ChurrascoSessionState` の正規定義）
- `docs/spec/state-and-commands.md:55-115`（コマンド成功パスの遷移先）
- `docs/spec/architecture.md:138-167`（`extension.ts` / `ChurrascoSessionService` 責務記述）
- `docs/spec/overview.md:11`（「strict Pomodoro timer ではない」根拠）
- `docs/spec/ui.md:9`（StatusBar `mm:ss` 表示の M3 想定）
- `docs/adr/0001-development-startup-strategy.md`（service-first 開発順 / `pnpm ci` 必須要件）
- `docs/adr/0002-meat-deck-service-design.md` §9（`MeatDeckState.deck → meatDeck` rename パス事前承認）
- grill-me セッション記録: `/root/.claude/plans/imperative-giggling-pancake.md`
