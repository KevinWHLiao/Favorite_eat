import {
  CUISINES,
  MOODS,
  BADGES,
  loadState,
  saveState,
  defaultState,
  uid,
  evaluateBadges,
} from "./storage.js?v=20260926d";
import {
  cloudReady,
  getSavedRoomCode,
  rememberRoomCode,
  createRoom,
  joinRoom,
  schedulePush,
  subscribeRoom,
  unsubscribeRoom,
  isApplyingRemote,
  normalizeCode,
} from "./cloud.js?v=20260926d";
import { geocodePlace, placesMissingCoords } from "./geo.js?v=20260926d";
import { renderMap, invalidateMap } from "./map.js?v=20260926d";

let state = loadState() || defaultState();
let roomCode = getSavedRoomCode();
let onboardMode = "create";
let editingId = null;
let detailId = null;
let pendingRating = 5;
let pendingMoods = [];

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function todayLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function init() {
  fillCuisineSelects();
  buildStarPicker();
  buildMoodPicker();
  bindEvents();
  setOnboardMode("create");
  updateCloudHint();

  if (cloudReady() && roomCode) {
    setSyncStatus("同步中…");
    try {
      const room = await joinRoom(roomCode);
      roomCode = room.code;
      state = room.payload;
      saveState(state);
      enterApp(`已回到房間 ${roomCode}`);
      return;
    } catch (err) {
      console.warn(err);
      rememberRoomCode("");
      roomCode = "";
      toast("先前房間失效，請重新建立或加入");
    }
  }

  if (state.couple.a && state.couple.b && roomCode) {
    enterApp();
  } else {
    showOnboarding(true);
    setSyncStatus(cloudReady() ? "尚未進入房間" : "尚未設定雲端");
  }
}

function enterApp(msg) {
  showOnboarding(false);
  renderAll();
  startRealtime();
  setSyncStatus(cloudReady() && roomCode ? `雲端同步 · ${roomCode}` : "本機模式");
  if (msg) toast(msg);
}

function showOnboarding(show) {
  $("#onboarding").classList.toggle("hidden", !show);
  $("#app").classList.toggle("hidden", show);
}

function updateCloudHint() {
  const hint = $("#cloud-hint");
  if (!cloudReady()) {
    hint.className = "hint warn";
    hint.textContent = "雲端尚未設定：請在 js/config.js 填入 Supabase 網址與金鑰。若已設定仍看到此訊息，請強制重新整理頁面。";
    $("#onboard-submit").disabled = true;
  } else {
    hint.className = "hint ok";
    hint.textContent =
      onboardMode === "create"
        ? "建立後會產生房間碼，把碼傳給對方就能一起寫。"
        : "輸入對方分享的房間碼，進入同一本手帳。";
    $("#onboard-submit").disabled = false;
  }
}

function setOnboardMode(mode) {
  onboardMode = mode;
  $$(".mode-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });
  const roomField = $("#room-code-field");
  const roomInput = $("#room-code-input");
  if (mode === "join") {
    roomField.classList.remove("hidden");
    roomInput.required = true;
    $("#onboard-submit").textContent = "加入雲端房間";
  } else {
    roomField.classList.add("hidden");
    roomInput.required = false;
    $("#onboard-submit").textContent = "建立雲端房間";
  }
  updateCloudHint();
}

function setSyncStatus(text) {
  $("#sync-status").textContent = text;
}

function fillCuisineSelects() {
  const opts = CUISINES.map((c) => `<option value="${c}">${c}</option>`).join("");
  $("#f-cuisine").innerHTML = opts;
  $("#filter-cuisine").innerHTML =
    `<option value="all">全部料理</option>` +
    CUISINES.map((c) => `<option value="${c}">${c}</option>`).join("");
}

function buildStarPicker() {
  const box = $("#star-picker");
  box.innerHTML = "";
  for (let i = 1; i <= 5; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "star-btn";
    btn.dataset.value = String(i);
    btn.setAttribute("aria-label", `${i} 星`);
    btn.textContent = "★";
    btn.addEventListener("click", () => {
      pendingRating = i;
      $("#f-rating").value = String(i);
      syncStars();
    });
    box.appendChild(btn);
  }
  syncStars();
}

function syncStars() {
  $$(".star-btn").forEach((btn) => {
    btn.classList.toggle("on", Number(btn.dataset.value) <= pendingRating);
  });
}

function buildMoodPicker() {
  const box = $("#mood-picker");
  box.innerHTML = "";
  MOODS.forEach((mood) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.textContent = mood;
    btn.dataset.mood = mood;
    btn.addEventListener("click", () => {
      if (pendingMoods.includes(mood)) {
        pendingMoods = pendingMoods.filter((m) => m !== mood);
      } else {
        pendingMoods = [...pendingMoods, mood].slice(0, 3);
      }
      syncMoods();
    });
    box.appendChild(btn);
  });
}

function syncMoods() {
  $$("#mood-picker .chip").forEach((chip) => {
    chip.classList.toggle("on", pendingMoods.includes(chip.dataset.mood));
  });
}

function bindEvents() {
  $$(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => setOnboardMode(btn.dataset.mode));
  });

  $("#onboard-form").addEventListener("submit", onOnboardSubmit);

  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });

  $$("[data-view].linkish").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  $("#btn-open-add").addEventListener("click", () => openEditor());
  $("#btn-close-edit").addEventListener("click", () => $("#edit-dialog").close());
  $("#btn-cancel-edit").addEventListener("click", () => $("#edit-dialog").close());
  $("#btn-close-detail").addEventListener("click", () => $("#detail-dialog").close());
  $("#btn-close-detail-2").addEventListener("click", () => $("#detail-dialog").close());

  $("#edit-form").addEventListener("submit", onSavePlace);
  $("#btn-delete").addEventListener("click", onDeletePlace);
  $("#btn-edit-from-detail").addEventListener("click", () => {
    $("#detail-dialog").close();
    openEditor(detailId);
  });

  $("#filter-cuisine").addEventListener("change", renderAlbum);
  $("#filter-sort").addEventListener("change", renderAlbum);
  $("#btn-spin").addEventListener("click", spinRoulette);

  $("#btn-export").addEventListener("click", exportData);
  $("#btn-import").addEventListener("change", importData);
  $("#btn-copy-room").addEventListener("click", copyRoomCode);
  $("#room-pill").addEventListener("click", copyRoomCode);
  $("#btn-leave-room").addEventListener("click", leaveRoom);
  $("#btn-autofix-geo")?.addEventListener("click", autofixMissingGeo);
}

async function onOnboardSubmit(e) {
  e.preventDefault();
  if (!cloudReady()) {
    toast("請先設定雲端（js/config.js）");
    return;
  }

  const a = $("#name-a").value.trim();
  const b = $("#name-b").value.trim();
  if (!a || !b) return;

  const submit = $("#onboard-submit");
  submit.disabled = true;
  const oldText = submit.textContent;
  submit.textContent = "連線中…";

  try {
    if (onboardMode === "create") {
      state = defaultState();
      state.couple = { a, b };
      const room = await createRoom(state);
      roomCode = room.code;
      saveState(state);
      enterApp(`房間已建立！把房間碼 ${roomCode} 傳給對方`);
    } else {
      const code = normalizeCode($("#room-code-input").value);
      const room = await joinRoom(code);
      roomCode = room.code;
      state = room.payload;
      // keep existing couple names on room, but allow joiner to set display if empty
      if (!state.couple.a || !state.couple.b) {
        state.couple = { a, b };
        await persistAsync();
      } else {
        // optional: update if they typed names - keep room's names as source of truth
        saveState(state);
      }
      enterApp(`已加入 ${state.couple.a} & ${state.couple.b} 的房間`);
    }
  } catch (err) {
    console.error(err);
    toast(err.message || "連線失敗，請稍後再試");
    setSyncStatus("連線失敗");
  } finally {
    submit.disabled = false;
    submit.textContent = oldText;
  }
}

function startRealtime() {
  unsubscribeRoom();
  if (!cloudReady() || !roomCode) return;
  subscribeRoom(roomCode, (payload) => {
    const prev = JSON.stringify(state);
    const next = JSON.stringify(payload);
    if (prev === next) return;
    state = payload;
    saveState(state);
    renderAll();
    setSyncStatus(`已同步對方更新 · ${roomCode}`);
    toast("另一半更新了手帳");
  });
}

function switchView(name) {
  $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === name));
  $$(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${name}`));
  if (name === "map") {
    renderMap(state.places, { onOpen: openDetail });
    renderMissingPlaces();
    invalidateMap();
  }
}

function persist() {
  const newly = evaluateBadges(state);
  saveState(state);
  if (cloudReady() && roomCode && !isApplyingRemote()) {
    setSyncStatus(`同步中… · ${roomCode}`);
    schedulePush(roomCode, state, () => {
      setSyncStatus(`同步失敗 · ${roomCode}`);
      toast("雲端同步失敗，資料仍保存在本機");
    });
    // optimistic synced label
    setTimeout(() => {
      if (!isApplyingRemote()) setSyncStatus(`雲端同步 · ${roomCode}`);
    }, 500);
  }
  if (newly.length) {
    setTimeout(() => {
      toast(`解鎖成就：${newly.map((b) => b.name).join("、")}`);
      renderBadges();
    }, 700);
  }
}

async function persistAsync() {
  persist();
}

function renderAll() {
  $("#couple-names").textContent = `${state.couple.a} & ${state.couple.b}`;
  $("#room-pill").textContent = roomCode ? `房間 · ${roomCode}` : "房間 · —";
  renderHome();
  renderAlbum();
  renderBadges();
  if ($("#view-map")?.classList.contains("active")) {
    renderMap(state.places, { onOpen: openDetail });
    renderMissingPlaces();
  }
}

function renderMissingPlaces() {
  const box = $("#map-missing");
  if (!box) return;
  const missing = placesMissingCoords(state.places);
  if (!missing.length) {
    box.innerHTML = "";
    return;
  }
  box.innerHTML =
    `<p class="sub" style="margin:0 0 0.25rem">這些店還沒上地圖（點「補地址／定位」）：</p>` +
    missing
      .map(
        (p) => `
      <div class="map-missing-item">
        <p><strong>${escapeHtml(p.name)}</strong> · ${escapeHtml(p.cuisine || "")}</p>
        <button type="button" class="btn ghost" data-fix-geo="${p.id}">補地址／定位</button>
      </div>`
      )
      .join("");
  $$("[data-fix-geo]", box).forEach((btn) => {
    btn.addEventListener("click", () => openEditor(btn.dataset.fixGeo));
  });
}

function renderHome() {
  const visited = state.places.filter((p) => !p.wishlist);
  const wish = state.places.filter((p) => p.wishlist);
  const avg =
    visited.length === 0
      ? "—"
      : (visited.reduce((s, p) => s + p.rating, 0) / visited.length).toFixed(1);

  $("#home-greeting").textContent =
    visited.length === 0
      ? "第一枚印章，等你們蓋下"
      : `已一起吃過 ${visited.length} 間店`;

  $("#home-stats").textContent =
    visited.length === 0
      ? "還沒有紀錄，先蓋下第一枚印章吧。"
      : `平均評分 ${avg} 星 · 想去清單 ${wish.length} 間`;

  $("#stat-rail").innerHTML = [
    { num: visited.length, lbl: "吃過的店" },
    { num: avg, lbl: "平均評分" },
    { num: state.unlockedBadges.length, lbl: "解鎖成就" },
  ]
    .map(
      (s) => `
      <div class="stat-chip">
        <div class="num">${s.num}</div>
        <div class="lbl">${s.lbl}</div>
      </div>`
    )
    .join("");

  const recent = [...visited].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 8);
  const row = $("#recent-stamps");
  if (!recent.length) {
    row.innerHTML = `<p class="empty" style="grid-column:1/-1">尚無印章</p>`;
    return;
  }
  row.innerHTML = recent.map(cardHtml).join("");
  bindCardClicks(row);
}

function starsText(n) {
  return "★".repeat(n) + "☆".repeat(5 - n);
}

function cardHtml(place) {
  const pin = Number.isFinite(place.lat) && Number.isFinite(place.lng) ? " · 📍" : "";
  return `
    <article class="stamp-card album-card ${place.wishlist ? "wishlist" : ""}" data-id="${place.id}">
      <div class="stamp-seal-mark">${place.wishlist ? "想去" : "已吃"}</div>
      <p class="card-cuisine">${place.cuisine}${pin}</p>
      <h4 class="card-name">${escapeHtml(place.name)}</h4>
      <p class="card-meta">
        ${place.wishlist ? "願望清單" : `<span class="stars-inline">${starsText(place.rating)}</span>`}
        · ${place.date || "—"}
      </p>
    </article>`;
}

function bindCardClicks(root) {
  $$("[data-id]", root).forEach((el) => {
    el.addEventListener("click", () => openDetail(el.dataset.id));
  });
}

function renderAlbum() {
  const cuisine = $("#filter-cuisine").value;
  const sort = $("#filter-sort").value;
  let list = [...state.places];
  if (cuisine !== "all") list = list.filter((p) => p.cuisine === cuisine);

  list.sort((a, b) => {
    if (sort === "rating") return (b.rating || 0) - (a.rating || 0);
    if (sort === "name") return a.name.localeCompare(b.name, "zh-Hant");
    return (b.date || "").localeCompare(a.date || "");
  });

  const grid = $("#album-grid");
  const empty = $("#album-empty");
  if (!list.length) {
    grid.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
  grid.innerHTML = list.map(cardHtml).join("");
  bindCardClicks(grid);
}

function renderBadges() {
  $("#badge-grid").innerHTML = BADGES.map((b) => {
    const on = state.unlockedBadges.includes(b.id);
    return `
      <article class="badge ${on ? "unlocked" : ""}">
        <div class="badge-icon">${b.icon}</div>
        <h4>${b.name}</h4>
        <p>${b.desc}${on ? " · 已解鎖" : ""}</p>
      </article>`;
  }).join("");
}

function openEditor(id = null) {
  editingId = id;
  pendingMoods = [];
  pendingRating = 5;
  const title = $("#edit-title");
  const del = $("#btn-delete");

  if (id) {
    const place = state.places.find((p) => p.id === id);
    if (!place) return;
    title.textContent = "編輯回憶";
    del.classList.remove("hidden");
    $("#f-name").value = place.name;
    $("#f-address").value = place.address || "";
    $("#f-cuisine").value = place.cuisine;
    $("#f-date").value = place.date;
    $("#f-note").value = place.note || "";
    $("#f-wishlist").checked = !!place.wishlist;
    pendingRating = place.rating || 5;
    pendingMoods = [...(place.moods || [])];
    $("#geo-hint").textContent = place.lat
      ? `已標記在地圖上 · ${place.geoLabel || place.address || ""}`
      : "沒填地址也沒關係，會先用店名自動找位置";
  } else {
    title.textContent = "新增回憶";
    del.classList.add("hidden");
    $("#edit-form").reset();
    $("#f-date").value = todayLocal();
    $("#f-wishlist").checked = false;
    $("#f-address").value = "";
    pendingRating = 5;
    pendingMoods = [];
    $("#geo-hint").textContent = "沒填地址也沒關係，會先用店名自動找位置";
  }
  $("#f-rating").value = String(pendingRating);
  syncStars();
  syncMoods();
  $("#edit-dialog").showModal();
}

async function onSavePlace(e) {
  e.preventDefault();
  const payload = {
    name: $("#f-name").value.trim(),
    address: $("#f-address").value.trim(),
    cuisine: $("#f-cuisine").value,
    date: $("#f-date").value,
    rating: pendingRating,
    moods: [...pendingMoods],
    note: $("#f-note").value.trim(),
    wishlist: $("#f-wishlist").checked,
  };
  if (!payload.name) return;

  const saveBtn = $("#btn-save-place");
  const prevText = saveBtn.textContent;
  saveBtn.disabled = true;
  saveBtn.textContent = "定位中…";

  try {
    const existing = editingId ? state.places.find((p) => p.id === editingId) : null;
    const needsGeo =
      !existing ||
      !(Number.isFinite(existing.lat) && Number.isFinite(existing.lng)) ||
      (existing.address || "") !== payload.address ||
      existing.name !== payload.name ||
      // re-pin if previous result landed outside Taiwan (e.g. Japan)
      (Number.isFinite(existing.lat) &&
        Number.isFinite(existing.lng) &&
        (existing.lat < 21.8 ||
          existing.lat > 25.4 ||
          existing.lng < 119.2 ||
          existing.lng > 122.2));

    if (!payload.wishlist && needsGeo) {
      try {
        const geo = await geocodePlace({ name: payload.name, address: payload.address });
        if (geo) {
          payload.lat = geo.lat;
          payload.lng = geo.lng;
          payload.geoLabel = geo.label;
          $("#geo-hint").textContent = `已找到：${geo.label}`;
        } else {
          payload.lat = null;
          payload.lng = null;
          payload.geoLabel = "";
          toast("找不到位置，回憶仍會保存。可再補更完整的地址");
        }
      } catch (err) {
        console.warn(err);
        toast("地址查詢失敗，回憶仍會保存");
      }
    } else if (payload.wishlist) {
      payload.lat = existing?.lat ?? null;
      payload.lng = existing?.lng ?? null;
      payload.geoLabel = existing?.geoLabel || "";
    } else if (existing) {
      payload.lat = existing.lat;
      payload.lng = existing.lng;
      payload.geoLabel = existing.geoLabel;
    }

    const wasNew = !editingId;
    if (editingId) {
      const idx = state.places.findIndex((p) => p.id === editingId);
      if (idx >= 0) state.places[idx] = { ...state.places[idx], ...payload };
    } else {
      state.places.push({ id: uid(), ...payload, createdAt: Date.now() });
    }

    persist();
    $("#edit-dialog").close();
    renderAll();

    if (wasNew && !payload.wishlist) {
      playStampFx();
      toast(
        payload.lat
          ? `「${payload.name}」已蓋章並標上地圖！`
          : `「${payload.name}」已蓋章！`
      );
    } else {
      toast(payload.lat ? "已保存並標上地圖" : "已保存並同步");
    }
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = prevText;
  }
}

async function autofixMissingGeo() {
  const missing = placesMissingCoords(state.places);
  if (!missing.length) {
    toast("所有吃過的店都已定位囉");
    return;
  }

  const btn = $("#btn-autofix-geo");
  btn.disabled = true;
  const old = btn.textContent;
  let ok = 0;

  try {
    for (let i = 0; i < missing.length; i++) {
      btn.textContent = `定位中 ${i + 1}/${missing.length}…`;
      const place = missing[i];
      const geo = await geocodePlace({ name: place.name, address: place.address });
      if (!geo) continue;
      const idx = state.places.findIndex((p) => p.id === place.id);
      if (idx < 0) continue;
      state.places[idx] = {
        ...state.places[idx],
        lat: geo.lat,
        lng: geo.lng,
        geoLabel: geo.label,
      };
      ok += 1;
      // be kind to free geocoders
      await new Promise((r) => setTimeout(r, 700));
    }
    if (ok > 0) {
      persist();
      renderAll();
      toast(`已為 ${ok} 間店標上地圖`);
    } else {
      toast("自動定位失敗，請編輯店家補上更完整地址");
    }
  } finally {
    btn.disabled = false;
    btn.textContent = old;
  }
}

function onDeletePlace() {
  if (!editingId) return;
  if (!confirm("確定要刪掉這則回憶嗎？")) return;
  state.places = state.places.filter((p) => p.id !== editingId);
  persist();
  $("#edit-dialog").close();
  renderAll();
  toast("已刪除");
}

function openDetail(id) {
  detailId = id;
  const place = state.places.find((p) => p.id === id);
  if (!place) return;
  $("#d-name").textContent = place.name;
  const moods = (place.moods || [])
    .map((m) => `<span class="detail-mood">${escapeHtml(m)}</span>`)
    .join("");
  $("#detail-body").innerHTML = `
    <p class="card-cuisine">${escapeHtml(place.cuisine)} · ${place.date || "—"}</p>
    <p class="stars-inline">${place.wishlist ? "願望清單（還沒吃過）" : starsText(place.rating)}</p>
    ${
      place.address || place.geoLabel
        ? `<p class="sub" style="margin:0.4rem 0 0">📍 ${escapeHtml(place.geoLabel || place.address)}</p>`
        : ""
    }
    <div>${moods}</div>
    ${place.note ? `<div class="detail-note">${escapeHtml(place.note)}</div>` : `<p class="sub">還沒寫小故事。</p>`}
  `;
  $("#detail-dialog").showModal();
}

function spinRoulette() {
  const onlyFav = $("#spin-favorites").checked;
  let pool = state.places.filter((p) => !p.wishlist);
  if (onlyFav) pool = pool.filter((p) => p.rating >= 4);

  if (!pool.length) {
    toast(onlyFav ? "還沒有 4 星以上的店喔" : "先去蓋幾枚印章再轉吧");
    return;
  }

  const result = $("#wheel-result");
  result.classList.add("spinning");
  $("#btn-spin").disabled = true;

  let ticks = 0;
  const tick = setInterval(() => {
    const temp = pool[Math.floor(Math.random() * pool.length)];
    result.innerHTML = `<div class="wheel-pick-name">${escapeHtml(temp.name)}</div>`;
    ticks++;
    if (ticks > 18) {
      clearInterval(tick);
      const pick = pool[Math.floor(Math.random() * pool.length)];
      result.classList.remove("spinning");
      result.innerHTML = `
        <div>
          <p class="wheel-pick-name">${escapeHtml(pick.name)}</p>
          <p class="wheel-pick-meta">${escapeHtml(pick.cuisine)} · ${starsText(pick.rating)}</p>
        </div>`;
      state.stats.spins += 1;
      persist();
      $("#btn-spin").disabled = false;
      toast(`命運選定：${pick.name}`);
    }
  }, 80);
}

function exportData() {
  const blob = new Blob([JSON.stringify({ ...state, roomCode }, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `favorite-eat-${roomCode || "local"}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("已匯出 JSON");
}

function importData(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data.couple || !Array.isArray(data.places)) throw new Error("格式不對");
      state = { ...defaultState(), ...data, stats: { ...defaultState().stats, ...(data.stats || {}) } };
      persist();
      renderAll();
      toast("匯入成功（已同步到雲端房間）");
    } catch {
      toast("匯入失敗，請確認檔案格式");
    }
    e.target.value = "";
  };
  reader.readAsText(file);
}

async function copyRoomCode() {
  if (!roomCode) {
    toast("目前沒有房間碼");
    return;
  }
  try {
    await navigator.clipboard.writeText(roomCode);
    toast(`房間碼 ${roomCode} 已複製`);
  } catch {
    toast(`房間碼：${roomCode}`);
  }
}

function leaveRoom() {
  if (!confirm("離開房間後，此裝置會回到開始畫面。雲端資料仍會保留。")) return;
  unsubscribeRoom();
  rememberRoomCode("");
  roomCode = "";
  state = defaultState();
  saveState(state);
  showOnboarding(true);
  setSyncStatus(cloudReady() ? "尚未進入房間" : "尚未設定雲端");
  toast("已離開房間");
}

function playStampFx() {
  const fx = $("#stamp-fx");
  fx.classList.remove("play");
  void fx.offsetWidth;
  fx.classList.add("play");
}

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 2800);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

init();
