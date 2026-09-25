/**
 * Geocode address / place name, biased to Taiwan.
 * Tries Nominatim (countrycodes=tw) first, then Photon within Taiwan bbox.
 */

const TAIWAN_BBOX = {
  // minLon, minLat, maxLon, maxLat
  photon: "119.3,21.8,122.15,25.35",
  viewbox: "119.3,25.35,122.15,21.8", // Nominatim: left,top,right,bottom
};

export async function geocodeAddress(query) {
  const q = normalizeTaiwanQuery(query);
  if (!q) return null;

  // Prefer Nominatim locked to Taiwan — avoids JP false matches like 松山
  const nominatim = await geocodeNominatim(q, true);
  if (nominatim && isInTaiwan(nominatim.lat, nominatim.lng)) return nominatim;

  const photon = await geocodePhoton(q, true);
  if (photon && isInTaiwan(photon.lat, photon.lng)) return photon;

  // Last resort without hard filter, but still reject Japan / out-of-TW hits
  const loose = (await geocodeNominatim(q, false)) || (await geocodePhoton(q, false));
  if (loose && isInTaiwan(loose.lat, loose.lng)) return loose;

  return null;
}

/** Prefer address; fall back to restaurant name (Taiwan-biased). */
export async function geocodePlace({ name, address } = {}) {
  const queries = [];
  if (address?.trim()) {
    const a = normalizeTaiwanQuery(address);
    queries.push(a);
    if (!/台灣|台湾|Taiwan|台北|臺北|高雄|台中|臺中/i.test(a)) {
      queries.push(`${a} 台灣`);
    }
  }
  if (name?.trim()) {
    const n = normalizeTaiwanQuery(name);
    queries.push(`${n} 台灣`);
    queries.push(`${n} Taipei Taiwan`);
    queries.push(n);
  }

  const seen = new Set();
  for (const q of queries) {
    if (!q || seen.has(q)) continue;
    seen.add(q);
    const hit = await geocodeAddress(q);
    if (hit) return hit;
  }
  return null;
}

function normalizeTaiwanQuery(query) {
  return String(query || "")
    .trim()
    .replaceAll("臺", "台") // 臺北 → 台北, better OSM coverage
    .replace(/\s+/g, " ");
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

function isTaiwanCountry(props = {}) {
  const c = String(props.country || props.countrycode || props.country_code || "").toLowerCase();
  return (
    c.includes("taiwan") ||
    c.includes("台灣") ||
    c.includes("台湾") ||
    c === "tw" ||
    c === "twn"
  );
}

async function geocodePhoton(q, taiwanOnly) {
  try {
    let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5&lang=zh`;
    if (taiwanOnly) url += `&bbox=${TAIWAN_BBOX.photon}`;

    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const features = data?.features || [];

    for (const feature of features) {
      const coords = feature?.geometry?.coordinates;
      if (!coords) continue;
      const [lng, lat] = coords;
      const props = feature.properties || {};

      if (taiwanOnly) {
        if (!isInTaiwan(lat, lng)) continue;
        // if country present and clearly not TW, skip
        if (props.country && !isTaiwanCountry(props) && !isInTaiwan(lat, lng)) continue;
      } else if (!isInTaiwan(lat, lng)) {
        continue;
      }

      const label = [props.name, props.street, props.city || props.county, props.state, props.country]
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
