/**
 * Geocode address via Photon (Komoot / OSM), no API key needed.
 * Prefer Taiwan results when query looks local.
 */
export async function geocodeAddress(query) {
  const q = String(query || "").trim();
  if (!q) return null;

  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "1");
  url.searchParams.set("lang", "zh");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("地址查詢失敗");
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
}

export function placesWithCoords(places) {
  return (places || []).filter(
    (p) => !p.wishlist && Number.isFinite(p.lat) && Number.isFinite(p.lng)
  );
}
