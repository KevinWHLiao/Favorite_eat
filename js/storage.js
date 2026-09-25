const STORAGE_KEY = "favorite_eat_v1";

const CUISINES = [
  "中式", "日式", "韓式", "泰式", "義式", "美式",
  "火鍋", "燒烤", "小吃", "甜點咖啡", "早餐早午餐", "其他",
];

const MOODS = ["開心", "浪漫", "慶祝", "療癒", "探險", "日常", "驚喜"];

const BADGES = [
  { id: "first", name: "第一枚印章", desc: "一起蓋下第一間餐廳", icon: "◎", test: (s) => visitedCount(s) >= 1 },
  { id: "five", name: "五味人生", desc: "累積 5 間吃過的店", icon: "⑤", test: (s) => visitedCount(s) >= 5 },
  { id: "ten", name: "十全食美", desc: "累積 10 間吃過的店", icon: "⑩", test: (s) => visitedCount(s) >= 10 },
  { id: "variety", name: "味蕾旅行家", desc: "嘗試過 4 種以上料理類型", icon: "◈", test: (s) => cuisineVariety(s) >= 4 },
  { id: "lover", name: "滿分情侶", desc: "有一間給到 5 星", icon: "★", test: (s) => s.places.some((p) => !p.wishlist && p.rating >= 5) },
  { id: "wishlist", name: "想去清單啟動", desc: "加入至少 1 間想去的店", icon: "◇", test: (s) => s.places.some((p) => p.wishlist) },
  { id: "story", name: "餐桌作家", desc: "寫下 3 則用餐小故事", icon: "✎", test: (s) => s.places.filter((p) => (p.note || "").trim().length > 0).length >= 3 },
  { id: "spin", name: "轉盤命運", desc: "使用過一次今天吃哪", icon: "⟳", test: (s) => s.stats.spins >= 1 },
];

function visitedCount(state) {
  return state.places.filter((p) => !p.wishlist).length;
}

function cuisineVariety(state) {
  return new Set(state.places.filter((p) => !p.wishlist).map((p) => p.cuisine)).size;
}

export function defaultState() {
  return {
    couple: { a: "", b: "" },
    places: [],
    stats: { spins: 0 },
    unlockedBadges: [],
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return { ...defaultState(), ...data, stats: { ...defaultState().stats, ...(data.stats || {}) } };
  } catch {
    return null;
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function uid() {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function evaluateBadges(state) {
  const newly = [];
  for (const badge of BADGES) {
    if (state.unlockedBadges.includes(badge.id)) continue;
    if (badge.test(state)) {
      state.unlockedBadges.push(badge.id);
      newly.push(badge);
    }
  }
  return newly;
}

export { CUISINES, MOODS, BADGES, STORAGE_KEY };
