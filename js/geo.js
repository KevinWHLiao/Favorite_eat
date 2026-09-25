/**
 * Taiwan-biased geocoding.
 * Prefer Photon (more reliable for TW street numbers); Nominatim as fallback.
 */

const TAIWAN_BBOX = {
  photon: "119.3,21.8,122.15,25.35",
  viewbox: "119.3,25.35,122.15,21.8",
};

export async function geocodeAddress(query) {
  const variants = taiwanAddressVariants(query);
  for (const q of variants) {
    const photon = await geocodePhoton(q);
    if (photon) return photon;
  }
  for (const q of variants) {
    const nominatim = await geocodeNominatim(q, true);
    if (nominatim) return nominatim;
  }
  return null;
}

/** Prefer address; fall back to restaurant name (Taiwan-biased). */
export async function geocodePlace({ name, address } = {}) {
  const tried = new Set();

  if (address?.trim()) {
    const hit = await geocodeAddress(address);
    if (hit) return hit;
    for (const q of taiwanAddressVariants(address)) tried.add(q);
  }

  if (name?.trim()) {
    const n = normalizeTaiwanQuery(name);
    const nameQueries = [`${n} 台北`, `${n} 台灣`, `${n} Taipei`, n];
    for (const q of nameQueries) {
      if (!q || tried.has(q)) continue;
      tried.add(q);
      const photon = await geocodePhoton(q);
      if (photon) return photon;
      const nominatim = await geocodeNominatim(q, true);
      if (nominatim) return nominatim;
    }
  }

  return null;
}

function normalizeTaiwanQuery(query) {
  return String(query || "")
    .trim()
    .replaceAll("臺", "台")
    .replace(/\s+/g, " ");
}

/** Build cleaner search strings from messy TW doorplate text. */
export function taiwanAddressVariants(raw) {
  let s = normalizeTaiwanQuery(raw);
  if (!s) return [];

  // drop leading postal code: 110台北市...
  s = s.replace(/^\d{3,6}/, "");
  // drop floor / basement tails: 一樓、2樓、B1...
  s = s.replace(/(?:[0-9０-９一二三四五六七八九十]+)?樓.*$/u, "");
  s = s.replace(/[BbＢｂ][0-9０-９]+.*$/u, "");
  s = s.trim();

  const variants = [];
  const push = (v) => {
    const t = String(v || "").trim();
    if (t && !variants.includes(t)) variants.push(t);
  };

  push(s);

  // 台北市信義區松光里松山路445號 → 松山路445號 信義區 台北市
  const re =
    /((?:台|臺)?[北中南西]?[縣市]|新北市|桃園市|基隆市|新竹市|嘉義市)?\s*([^市縣\s]{1,4}[區市鄉鎮])?\s*(?:[^區\s]{1,4}里)?\s*([^\s]+?(?:路|街|道|大道)(?:[一二三四五六七八九十0-9]+段)?(?:[0-9]+巷)?(?:[0-9]+弄)?)\s*([0-9０-９\-]+號?)/u;
  const m = s.match(re);
  if (m) {
    let [, city, dist, road, num] = m;
    num = String(num)
      .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
      .replace(/號$/, "");
    const numFull = `${num}號`;
    push([`${road}${numFull}`, dist, city].filter(Boolean).join(" "));
    push([road, numFull, dist, city].filter(Boolean).join(" "));
    push([`${road}${num}`, dist, city].filter(Boolean).join(" "));
    if (city && dist) push(`${city}${dist}${road}${numFull}`);
  }

  // also try without 里 leftovers if still present
  push(s.replace(/[^市區]{1,4}里/g, ""));

  return variants;
}

function isInTaiwan(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= 21.8 &&
    lat <= 25.4 &&
    lng >= 119.2 &&
    lng <= 122.2
  );
}

async function geocodePhoton(q) {
  try {
    // Do NOT pass lang=zh — Photon rejects it with 400
    const url =
      `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}` +
      `&limit=5&bbox=${TAIWAN_BBOX.photon}`;

    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const features = data?.features || [];

    for (const feature of features) {
      const coords = feature?.geometry?.coordinates;
      if (!coords) continue;
      const [lng, lat] = coords;
      if (!isInTaiwan(lat, lng)) continue;

      const props = feature.properties || {};
      const cc = String(props.countrycode || "").toUpperCase();
      if (cc && cc !== "TW") continue;

      const label = [
        props.name,
        props.housenumber ? `${props.street || ""}${props.housenumber}` : props.street,
        props.district || props.locality,
        props.city,
        props.country,
      ]
        .filter(Boolean)
        .join(" · ");

      return {
        lat: Number(lat),
        lng: Number(lng),
        label: label || q,
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function geocodeNominatim(q, taiwanOnly) {
  try {
    let url =
      `https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=1` +
      `&q=${encodeURIComponent(q)}`;
    if (taiwanOnly) {
      url += `&countrycodes=tw&viewbox=${TAIWAN_BBOX.viewbox}&bounded=1`;
    }

    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data)) return null;

    for (const hit of data) {
      const lat = Number(hit.lat);
      const lng = Number(hit.lon);
      if (!isInTaiwan(lat, lng)) continue;
      const cc = String(hit.address?.country_code || "").toLowerCase();
      if (taiwanOnly && cc && cc !== "tw") continue;

      return {
        lat,
        lng,
        label: hit.display_name || q,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function placesWithCoords(places) {
  return (places || []).filter(
    (p) => !p.wishlist && Number.isFinite(p.lat) && Number.isFinite(p.lng)
  );
}

export function placesMissingCoords(places) {
  return (places || []).filter(
    (p) => !p.wishlist && !(Number.isFinite(p.lat) && Number.isFinite(p.lng))
  );
}
