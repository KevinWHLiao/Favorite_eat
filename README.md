# Favorite Eat · 雙人餐桌

情侶一起記錄吃過的美食餐廳小遊戲。每去一間店就蓋一枚印章，解鎖成就，猶豫時還能轉盤決定今天吃哪。

**線上玩玩看：** https://kevinwhliao.github.io/Favorite_eat/

## 怎麼玩

1. 輸入兩人暱稱，進入你們的餐桌手帳
2. 點「新增回憶」記錄餐廳、日期、評分、心情與小故事
3. 在「印章」頁翻閱整本美食印章冊
4. 「轉盤」從吃過的店隨機抽一間，結束選擇障礙
5. 「成就」累積吃店數、料理種類等解鎖徽章
6. 底部可匯出 / 匯入 JSON，方便兩人換手機時帶走資料

資料存在瀏覽器 `localStorage`，不會上傳到任何伺服器。

## 本機啟動

```bash
py -m http.server 8080
```

然後用瀏覽器開啟：http://localhost:8080

## 檔案結構

```
Favorite_eat/
├── index.html
├── css/style.css
├── js/app.js
├── js/storage.js
└── README.md
```
