import { placesWithCoords, placesMissingCoords } from "./geo.js?v=20260926c";

let map = null;
let layer = null;
let Lref = null;

async function ensureLeaflet() {
  if (window.L) {
    Lref = window.L;
    return Lref;
  }
  await new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  Lref = window.L;
  return Lref;
}

function cuteIcon(L, wishlist) {
  const color = wishlist ? "#7EB8FF" : "#FF6B8A";
  const html = `
    <div class="map-pin" style="--pin:${color}">
      <span>${wishlist ? "♡" : "♪"}</span>
    </div>`;
  return L.divIcon({
    className: "cute-marker",
    html,
    iconSize: [36, 44],
    iconAnchor: [18, 42],
    popupAnchor: [0, -36],
  });
}

export async function renderMap(places, { onOpen } = {}) {
  const el = document.getElementById("food-map");
  const empty = document.getElementById("map-empty");
  const countEl = document.getElementById("map-count");
  if (!el) return;

  const L = await ensureLeaflet();
  const pinned = placesWithCoords(places);

  if (countEl) {
    const missing = placesMissingCoords(places).length;
    if (pinned.length) {
      countEl.textContent =
        missing > 0
          ? `地圖上有 ${pinned.length} 間 · 還有 ${missing} 間尚未定位`
          : `地圖上有 ${pinned.length} 間已標記的店`;
    } else {
      countEl.textContent =
        missing > 0
          ? `有 ${missing} 間店還沒定位，可按上方按鈕自動找位置`
          : "還沒有可顯示的店，新增回憶時會自動用店名定位";
    }
  }

  if (!pinned.length) {
    empty?.classList.remove("hidden");
  } else {
    empty?.classList.add("hidden");
  }

  if (!map) {
    map = L.map(el, {
      zoomControl: true,
      attributionControl: true,
    }).setView([25.033, 121.565], 12);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    }).addTo(map);

    layer = L.layerGroup().addTo(map);
  }

  layer.clearLayers();

  const bounds = [];
  for (const place of pinned) {
    const marker = L.marker([place.lat, place.lng], {
      icon: cuteIcon(L, !!place.wishlist),
    });
    const stars = "★".repeat(place.rating || 0);
    marker.bindPopup(`
      <div class="map-popup">
        <strong>${escapeHtml(place.name)}</strong>
        <div>${escapeHtml(place.cuisine || "")} · ${stars}</div>
        <div class="map-popup-addr">${escapeHtml(place.address || place.geoLabel || "")}</div>
        <button type="button" class="map-popup-btn" data-id="${place.id}">查看回憶</button>
      </div>
    `);
    marker.on("popupopen", () => {
      const btn = document.querySelector(`.map-popup-btn[data-id="${place.id}"]`);
      btn?.addEventListener("click", () => onOpen?.(place.id));
    });
    marker.addTo(layer);
    bounds.push([place.lat, place.lng]);
  }

  requestAnimationFrame(() => {
    map.invalidateSize();
    if (bounds.length === 1) {
      map.setView(bounds[0], 15);
    } else if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [40, 40] });
    } else {
      map.setView([25.033, 121.565], 12);
    }
  });
}

export function invalidateMap() {
  if (map) {
    setTimeout(() => map.invalidateSize(), 80);
  }
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
