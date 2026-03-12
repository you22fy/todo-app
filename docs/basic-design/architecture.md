# システムアーキテクチャ

## 1. 技術スタック

```mermaid
graph TB
    subgraph Client["クライアント（ブラウザ）"]
        React["React 19"]
        SWR["SWR 2.x"]
        Shadcn["shadcn-ui"]
        Tailwind["Tailwind CSS v4"]
    end

    subgraph Server["サーバー（Next.js 16）"]
        Middleware["Middleware<br>Basic認証"]
        API["API Routes<br>app/api/*"]
        Logic["Business Logic<br>lib/logic/*"]
        DB["better-sqlite3"]
    end

    subgraph Storage["ストレージ"]
        SQLite["SQLite<br>data/todo.db"]
    end

    React --> SWR
    SWR -->|fetch| Middleware
    Middleware -->|認証OK| API
    API --> Logic
    API --> DB
    DB --> SQLite
```

## 2. レイヤー構成

本アプリケーションは以下の4層で構成される。

```mermaid
graph LR
    subgraph Presentation["プレゼンテーション層"]
        Pages["ビューページ"]
        Components["UIコンポーネント"]
    end

    subgraph DataAccess["データアクセス層"]
        Hooks["SWRフック"]
    end

    subgraph Application["アプリケーション層"]
        Routes["API Routes"]
        BizLogic["ビジネスロジック"]
    end

    subgraph Infrastructure["インフラ層"]
        DBModule["DBモジュール"]
        Auth["認証Middleware"]
    end

    Pages --> Hooks
    Components --> Hooks
    Hooks -->|HTTP| Routes
    Routes --> BizLogic
    Routes --> DBModule
    Auth -.->|認証検証| Routes
```

### 各レイヤーの責務

| レイヤー | 責務 | 主要ファイル |
|---|---|---|
| プレゼンテーション | UI表示・ユーザーインタラクション | `app/(views)/*`, `components/*` |
| データアクセス | API通信・キャッシュ管理・楽観的更新 | `hooks/*` |
| アプリケーション | HTTPリクエスト処理・バリデーション・ビジネスルール適用 | `app/api/*`, `lib/logic/*` |
| インフラ | DB接続・マイグレーション・認証 | `lib/db.ts`, `middleware.ts` |

## 3. リクエスト処理フロー

### 3.1 読み取りフロー（GET）

```mermaid
sequenceDiagram
    participant B as ブラウザ
    participant MW as Middleware
    participant API as API Route
    participant DB as SQLite

    B->>MW: GET /api/tasks?status=yet,doing
    MW->>MW: Basic認証検証
    MW->>API: リクエスト転送
    API->>DB: SELECT tasks JOIN projects
    DB-->>API: 結果セット
    API->>DB: SELECT task_dependencies
    DB-->>API: 依存関係
    API->>DB: SELECT sub-tasks
    DB-->>API: サブタスク
    API-->>B: JSON Response
    B->>B: SWRキャッシュ更新
```

### 3.2 書き込みフロー（POST/PATCH/DELETE）

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant SWR as SWRキャッシュ
    participant API as API Route
    participant Logic as ビジネスロジック
    participant DB as SQLite

    U->>SWR: 操作実行
    SWR->>SWR: 楽観的キャッシュ更新
    SWR->>U: UI即反映
    SWR->>API: APIリクエスト
    API->>API: Zodバリデーション
    API->>Logic: 制約チェック
    Logic-->>API: 検証結果
    API->>DB: トランザクション実行
    Note over DB: INSERT/UPDATE<br>+ 親ステータス再計算<br>+ 依存タスク再計算
    DB-->>API: 結果
    API-->>SWR: レスポンス
    SWR->>SWR: キャッシュ確定 or ロールバック
```

## 4. 主要な設計判断

### 4.1 IDの生成方式

- **16文字のランダムhex文字列**を採用
- 理由: クライアント側でもサーバー側でも同一ロジックで生成可能
- 利点: 楽観的更新時にクライアントがIDを事前生成できるため、作成後即座にUIに反映できる

### 4.2 SWRの選定理由

| 候補 | 判断 | 理由 |
|---|---|---|
| SWR | **採用** | 軽量、Next.jsとの親和性、`mutate`の楽観的更新で十分 |
| React Query | 不採用 | 個人ツールにはオーバースペック |
| Server Components | 不採用 | フィルタリング・楽観的更新がインタラクティブなためClient Componentが適切 |

### 4.3 SQLiteの選定理由

- 外部サービス不要（ローカル完結）
- better-sqlite3による同期APIでトランザクション制御が容易
- 個人利用のためスケーラビリティは不要
- WALモードで読み取り性能を確保

### 4.4 ビューページのClient Component化

- 全3ビューがインタラクティブなフィルタリングと楽観的更新を必要とする
- Server ComponentではSWRのリアクティブなキャッシュ管理が使えない
- ページ自体は `'use client'` ディレクティブを持つClient Componentとして実装
