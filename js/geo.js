/**
 * Geocode address. Tries Photon first, then Nominatim.
 * No API key required.
 */
export async function geocodeAddress(query) {
  const q = String(query || "").trim();
  if (!q) return null;

  const photon = await geocodePhoton(q);
  if (photon) return photon;

  return geocodeNominatim(q);
}

async function geocodePhoton(q) {
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1&lang=zh`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const feature = data?.features?.[0];
    if (!feature?.geometry?.coordinates) return null;

    const [lng, lat] = feature.geometry.coordinates;
    const props = feature.properties || {};
    const label = [props.name, props.street, props.city || props.county, props.state, props.country]
      .filter(Boolean)
      .join(" · ");

    return {
      lat: Number(lat),
      lng: Number(lng),
      label: label || q,
    };
  } catch {
    return null;
  }
}

async function geocodeNominatim(q) {
  try {
    const url =
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const hit = Array.isArray(data) ? data[0] : null;
    if (!hit) return null;

    return {
      lat: Number(hit.lat),
      lng: Number(hit.lon),
      label: hit.display_name || q,
    };
  } catch {
    return null;
  }
}

export function placesWithCoords(places) {
  return (places || []).filter(
    (p) => !p.wishlist && Number.isFinite(p.lat) && Number.isFinite(p.lng)
  );
}
