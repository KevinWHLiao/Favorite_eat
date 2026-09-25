import {
  CUISINES,
  MOODS,
  BADGES,
  loadState,
  saveState,
  defaultState,
  uid,
  evaluateBadges,
} from "./storage.js";

let state = loadState() || defaultState();
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

function init() {
  fillCuisineSelects();
  buildStarPicker();
  buildMoodPicker();
  bindEvents();

  if (!state.couple.a || !state.couple.b) {
    showOnboarding(true);
  } else {
    showOnboarding(false);
    renderAll();
  }
}

function showOnboarding(show) {
  $("#onboarding").classList.toggle("hidden", !show);
  $("#app").classList.toggle("hidden", show);
}

function fillCuisineSelects() {
  const opts = CUISINES.map((c) => `<option value="${c}">${c}</option>`).join("");
  $("#f-cuisine").innerHTML = opts;
  const filter = $("#filter-cuisine");
  filter.innerHTML =
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
  $("#onboard-form").addEventListener("submit", (e) => {
    e.preventDefault();
    state.couple.a = $("#name-a").value.trim();
    state.couple.b = $("#name-b").value.trim();
    persist();
    showOnboarding(false);
    renderAll();
    toast(`${state.couple.a} & ${state.couple.b}，歡迎來到雙人餐桌`);
  });

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
  $("#btn-reset-names").addEventListener("click", () => {
    $("#name-a").value = state.couple.a;
    $("#name-b").value = state.couple.b;
    showOnboarding(true);
  });
}

function switchView(name) {
  $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === name));
  $$(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${name}`));
}

function persist() {
  const newly = evaluateBadges(state);
  saveState(state);
  if (newly.length) {
    setTimeout(() => {
      toast(`解鎖成就：${newly.map((b) => b.name).join("、")}`);
      renderBadges();
    }, 700);
  }
}

function renderAll() {
  $("#couple-names").textContent = `${state.couple.a} & ${state.couple.b}`;
  renderHome();
  renderAlbum();
  renderBadges();
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
  return `
    <article class="stamp-card album-card ${place.wishlist ? "wishlist" : ""}" data-id="${place.id}">
      <div class="stamp-seal-mark">${place.wishlist ? "想去" : "已吃"}</div>
      <p class="card-cuisine">${place.cuisine}</p>
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
    $("#f-cuisine").value = place.cuisine;
    $("#f-date").value = place.date;
    $("#f-note").value = place.note || "";
    $("#f-wishlist").checked = !!place.wishlist;
    pendingRating = place.rating || 5;
    pendingMoods = [...(place.moods || [])];
  } else {
    title.textContent = "新增回憶";
    del.classList.add("hidden");
    $("#edit-form").reset();
    $("#f-date").value = todayLocal();
    $("#f-wishlist").checked = false;
    pendingRating = 5;
    pendingMoods = [];
  }
  $("#f-rating").value = String(pendingRating);
  syncStars();
  syncMoods();
  $("#edit-dialog").showModal();
}

function onSavePlace(e) {
  e.preventDefault();
  const payload = {
    name: $("#f-name").value.trim(),
    cuisine: $("#f-cuisine").value,
    date: $("#f-date").value,
    rating: pendingRating,
    moods: [...pendingMoods],
    note: $("#f-note").value.trim(),
    wishlist: $("#f-wishlist").checked,
  };
  if (!payload.name) return;

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
    toast(`「${payload.name}」已蓋章！`);
  } else {
    toast("已保存");
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
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `favorite-eat-${state.couple.a}-${state.couple.b}.json`;
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
      showOnboarding(false);
      renderAll();
      toast("匯入成功");
    } catch {
      toast("匯入失敗，請確認檔案格式");
    }
    e.target.value = "";
  };
  reader.readAsText(file);
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
  toast._t = setTimeout(() => el.classList.remove("show"), 2600);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

init();
