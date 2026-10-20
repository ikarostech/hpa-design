# 公開手順

1. `package.json` と `package-lock.json` のバージョンを揃え、`docs/releases/v<version>.md` にリリースノートを用意する。
2. テスト・ビルド・スキーマ検証後、変更を `main` にpushし、その公開対象コミットに `v<version>` タグを付けてpushする。公開済みタグは移動しない。
3. GitHub Actionsの「Deploy to GitHub Pages」を `main` から手動実行し、`release_tag` に既存タグを指定する。Pages環境が許可している `main` のワークフローから、タグに固定されたコードをチェックアウトして検証・配信する。
4. 配信成功後、同じタグのリリースノートでGitHub Releaseを作成する。Actionsの成功と公開ページを確認する。

`release_tag` を省略した手動実行は、選択したrefの再配信のみを行う。通常の `main` pushは、従来どおり `package.json` のバージョンが更新された場合に配信する。
