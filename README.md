# れいわキャリア LP

スマホファーストのアンケート型ランディングページです。

## Files

- `index.html`
- `styles.css`
- `script.js`
- `assets/`

## Deploy

GitHub Pagesなどの静的ホスティングで公開できます。

## Vercel API

フォーム送信はVercelの `/api/submit` からGoogle Sheets APIへ送信します。

Vercelに設定する環境変数:

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `SPREADSHEET_ID`
- `SHEET_NAME`

対象スプレッドシートには、サービスアカウントのメールアドレスを編集者として共有してください。
