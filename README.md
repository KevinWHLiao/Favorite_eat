# Favorite Eat · 雙人餐桌

情侶一起記錄吃過的美食餐廳小遊戲。兩人輸入**同一個房間碼**，就能共用一本雲端美食印章手帳。

**線上玩玩看：** https://kevinwhliao.github.io/Favorite_eat/

## 怎麼玩（雲端共用）

1. 一人點「建立房間」，輸入暱稱 → 得到房間碼（例如 `A3K9MP`）
2. 把房間碼傳給另一半
3. 另一半點「加入房間」，輸入同一個房間碼
4. 之後誰新增餐廳、評分、小故事，另一邊也會同步看到

## 雲端設定（Supabase 免費）

1. 到 [https://supabase.com](https://supabase.com) 註冊並建立專案
2. 進入 **SQL Editor**，把 `supabase/schema.sql` 全部貼上執行
3. 到 **Project Settings → API**，複製：
   - Project URL
   - `anon` `public` key
4. 填進 `js/config.js`：

```js
export const SUPABASE_URL = "https://xxxx.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOi...";
```

5. 重新部署 / 推上 GitHub Pages 後即可使用

> `anon` key 本來就設計給前端使用；真正的保密靠「房間碼」。請勿把房間碼公開貼在社群。

## 本機啟動

```bash
py -m http.server 8080
```

開啟 http://localhost:8080

## 檔案結構

```
Favorite_eat/
├── index.html
├── css/style.css
├── js/
│   ├── app.js
│   ├── cloud.js
│   ├── config.js      ← 填 Supabase 金鑰
│   └── storage.js
├── supabase/schema.sql
└── README.md
```
