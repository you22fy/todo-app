# ビジネスロジック詳細設計

## 1. 設計原則

ビジネスロジックは**純粋関数**として `lib/logic/` に切り出す。

- 副作用なし（DB/ネットワーク/グローバル状態への依存なし）
- 入力に対して常に同じ出力を返す
- 単体テストが容易

```mermaid
graph LR
    subgraph "API Route（薄いハンドラ）"
        Parse["リクエストパース"]
        CallLogic["ロジック関数呼び出し"]
        DBOps["DB操作"]
        Response["レスポンス生成"]
    end

    subgraph "lib/logic/（純粋関数）"
        TaskLogic["task-logic.ts"]
        ProjectLogic["project-logic.ts"]
    end

    Parse --> CallLogic
    CallLogic --> TaskLogic
    CallLogic --> ProjectLogic
    CallLogic --> DBOps
    DBOps --> Response
```

## 2. task-logic.ts

### 2.1 computeParentStatus

サブタスクの状態から親タスクのステータスを計算する。

```typescript
function computeParentStatus(
  subTasks: { status: TaskStatus }[]
): TaskStatus
```

**アルゴリズム**:

```mermaid
flowchart TD
    A{サブタスク数 = 0?} -->|Yes| ERR[Error: サブタスクなし]
    A -->|No| B{全サブタスクが<br>done or canceled?}
    B -->|Yes| DONE["return 'done'"]
    B -->|No| DOING["return 'doing'"]

    style DONE fill:#c8e6c9
    style DOING fill:#fff9c4
    style ERR fill:#ffcdd2
```

**入出力例**:

| サブタスクの状態 | 結果 |
|---|---|
| `[done, done]` | done |
| `[done, canceled]` | done |
| `[canceled, canceled]` | done |
| `[doing, done]` | doing |
| `[yet, done]` | doing |
| `[pending, done]` | doing |
| `[]` | Error |

### 2.2 shouldBePending

ブロッカーの状態からタスクが pending であるべきかを判定する。

```typescript
function shouldBePending(
  blockerStatuses: TaskStatus[]
): boolean
```

**ルール**: ブロッカーが1つでも done/canceled 以外であれば true

| ブロッカーの状態 | 結果 |
|---|---|
| `[]` | false |
| `[done, done]` | false |
| `[done, canceled]` | false |
| `[yet, done]` | true |
| `[doing]` | true |
| `[pending]` | true |

### 2.3 validateSubTaskDependencies

サブタスクの `blocked_by` が同じ親の兄弟サブタスクのみを参照しているかを検証する。

```typescript
function validateSubTaskDependencies(
  taskParentId: string | null,
  blockedByIds: string[],
  siblingTasks: { id: string; parent_task_id: string | null }[]
): { valid: boolean; error?: string }
```

**検証フロー**:

```mermaid
flowchart TD
    A{blockedByIds<br>が空?} -->|Yes| OK1[valid: true]
    A -->|No| B{taskParentId<br>がnull?}
    B -->|Yes| ERR1[valid: false<br>sub-task以外では制約なし]
    B -->|No| C{全blockedByIdが<br>siblingsに含まれる?}
    C -->|Yes| OK2[valid: true]
    C -->|No| ERR2[valid: false<br>兄弟ではないタスクあり]
```

### 2.4 canBeSubTask

親タスク候補がサブタスクでないこと（＝サブサブタスク禁止）を確認する。

```typescript
function canBeSubTask(
  parentTask: { parent_task_id: string | null }
): boolean
```

- `parent_task_id === null` → true（親になれる）
- `parent_task_id !== null` → false（既にサブタスクなので親になれない）

### 2.5 canManuallyChangeStatus

サブタスクが存在する場合、親タスクのステータスを手動変更できないことを判定する。

```typescript
function canManuallyChangeStatus(
  hasSubTasks: boolean
): boolean
```

- `hasSubTasks = false` → true（手動変更可能）
- `hasSubTasks = true` → false（自動計算のため手動変更不可）

### 2.6 computeEffectiveStatus

現在のステータスとブロッカーの状態から実効ステータスを計算する。

```typescript
function computeEffectiveStatus(
  currentStatus: TaskStatus,
  blockerStatuses: TaskStatus[]
): TaskStatus
```

**アルゴリズム**:

```mermaid
flowchart TD
    A{ブロッカーあり<br>かつ未解消?} -->|Yes| PENDING["return 'pending'"]
    A -->|No| B{現在pending<br>かつブロッカーあり<br>かつ全て解消?}
    B -->|Yes| YET["return 'yet'"]
    B -->|No| CURRENT["return currentStatus"]

    style PENDING fill:#fff9c4
    style YET fill:#e8eaf6
```

## 3. project-logic.ts

### 3.1 suggestProjectStatus

プロジェクトに属するタスクの状態から、プロジェクトの推奨ステータスを導出する。

```typescript
function suggestProjectStatus(
  tasks: { status: TaskStatus }[]
): ProjectStatus
```

**アルゴリズム**:

```mermaid
flowchart TD
    A{タスク数 = 0?} -->|Yes| YET1["return 'yet'"]
    A -->|No| B{全タスクが<br>done or canceled?}
    B -->|Yes| FIN["return 'finished'"]
    B -->|No| C{doing or pending<br>のタスクあり?}
    C -->|Yes| PROC["return 'processing'"]
    C -->|No| YET2["return 'yet'"]

    style FIN fill:#c8e6c9
    style PROC fill:#fff9c4
    style YET1 fill:#e8eaf6
    style YET2 fill:#e8eaf6
```

## 4. API Routeでのロジック適用

API RouteはCRUD操作の中でこれらの純粋関数を呼び出し、副作用（DB更新）と組み合わせる。

### 4.1 タスク作成時のフロー

```mermaid
sequenceDiagram
    participant H as API Handler
    participant L as task-logic
    participant DB as Database

    H->>H: Zodバリデーション
    alt サブタスク作成
        H->>DB: 親タスク取得
        H->>L: canBeSubTask(parent)
        H->>L: validateSubTaskDependencies()
        H->>H: project_id = parent.project_id
    end
    H->>H: blocked_by → status = 'pending'
    H->>DB: BEGIN TRANSACTION
    H->>DB: INSERT task
    H->>DB: INSERT task_dependencies
    alt サブタスク
        H->>DB: SELECT sub-tasks of parent
        H->>L: computeParentStatus(subTasks)
        H->>DB: UPDATE parent status
    end
    H->>DB: COMMIT
```

### 4.2 タスク更新時のフロー

```mermaid
sequenceDiagram
    participant H as API Handler
    participant L as task-logic
    participant DB as Database

    H->>H: Zodバリデーション
    H->>DB: 既存タスク取得

    alt ステータス変更
        H->>DB: サブタスク数取得
        H->>L: canManuallyChangeStatus(hasSubTasks)
        Note over L: falseなら400エラー
    end

    alt blocked_by変更
        H->>L: validateSubTaskDependencies()
        H->>DB: 依存関係再構築
        H->>L: computeEffectiveStatus()
    end

    H->>DB: BEGIN TRANSACTION
    H->>DB: UPDATE task
    alt 親タスクがある
        H->>L: computeParentStatus()
        H->>DB: UPDATE parent status
    end
    alt ステータス変更あり
        H->>DB: 依存タスク取得
        loop 各依存タスク
            H->>L: computeEffectiveStatus()
            H->>DB: UPDATE dependent status
        end
    end
    H->>DB: COMMIT
```

## 5. トランザクション管理

以下の操作はトランザクション内で実行し、データ整合性を保証する。

| 操作 | トランザクション内の処理 |
|---|---|
| タスク作成 | INSERT task + INSERT dependencies + UPDATE parent status |
| タスク更新 | UPDATE task + UPDATE parent status + UPDATE dependent statuses |
| タスク削除 | DELETE dependencies + DELETE task + UPDATE parent status |
