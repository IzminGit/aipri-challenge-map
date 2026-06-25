# バルーンフェスコーデ大会マップ 愛知県版

## 開く

`index.html` をブラウザで開くと静的版として使えます。

現在地取得と最新取得を安定して使う場合は、同梱サーバーで起動します。

```powershell
& 'C:\Users\USER\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' .\server.mjs
```

起動後に `http://127.0.0.1:4173/` を開きます。

## 最新情報を取得

サーバー起動中は画面右上の更新ボタンで公式ページを再取得します。

手動更新する場合:

```powershell
& 'C:\Users\USER\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' .\tools\refresh-data.mjs
```

## データ元

- 店舗・大会情報: 公式の開催店舗検索ページ
- 緯度経度: 国土地理院 住所検索API
