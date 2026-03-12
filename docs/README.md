# TODO App ドキュメント

個人利用向け TODO 管理アプリケーションの技術ドキュメント集です。

## 目次

### 要件定義

| ドキュメント | 概要 |
|---|---|
| [コンセプト](./requirements/concept.md) | アプリケーションの背景・目的・対象ユーザー |
| [機能要件](./requirements/functional.md) | データモデル・階層構造・ステータス制御・ビュー仕様 |
| [非機能要件](./requirements/non-functional.md) | 認証・レスポンシブ対応・UX方針・テスト方針 |

### 基本設計

| ドキュメント | 概要 |
|---|---|
| [システムアーキテクチャ](./basic-design/architecture.md) | 技術スタック・レイヤー構成・処理フロー |
| [データベース設計](./basic-design/database.md) | ER図・テーブル定義・制約・インデックス |
| [API設計](./basic-design/api.md) | RESTエンドポイント一覧・リクエスト/レスポンス仕様 |
| [画面設計](./basic-design/ui.md) | 画面一覧・コンポーネント構成・画面遷移 |

### 詳細設計

| ドキュメント | 概要 |
|---|---|
| [ビジネスロジック](./detailed-design/business-logic.md) | ステータス自動計算・依存関係バリデーション・純粋関数設計 |
| [フロントエンド設計](./detailed-design/frontend.md) | SWRフック・楽観的更新・状態管理・コンポーネント詳細 |
| [テスト設計](./detailed-design/testing.md) | テスト戦略・テストケース一覧・カバレッジ方針 |
| [ディレクトリ構成](./detailed-design/directory.md) | ファイル構成・命名規則・依存関係 |
