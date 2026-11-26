import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

type Leaflet = typeof import("leaflet");
type Layer = { remove: () => void };

export type GeoPoint = { lat: number; lon: number; label?: string; detail?: string };

/**
 * Leaflet map loaded lazily on the client (OSM tiles, attribution required).
 * Accepts points plus optional GeoJSON/KML content parsed locally.
 */
export function GeoMap({
  points, geojson, kml, height = 380, zoom = 4,
}: { points: GeoPoint[]; geojson?: string; kml?: string; height?: number; zoom?: number }) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ map: import("leaflet").Map; L: Leaflet } | null>(null);
  const layerRef = useRef<Layer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod = await import("leaflet");
        const L = (mod.default ?? mod) as Leaflet;
        if (cancelled || !nodeRef.current || mapRef.current) return;
        const map = L.map(nodeRef.current, { zoomControl: true, attributionControl: true }).setView([20, 0], zoom);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);
        mapRef.current = { map, L };
        setReady(true);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
      layerRef.current?.remove();
      mapRef.current?.map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const ctx = mapRef.current;
    if (!ctx || !ready) return;
    const { map, L } = ctx;
    layerRef.current?.remove();
    const group = L.layerGroup().addTo(map);
    layerRef.current = group;

    const markers: Array<[number, number]> = [];
    for (const p of points) {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) continue;
      markers.push([p.lat, p.lon]);
      L.circleMarker([p.lat, p.lon], { radius: 7, color: "#22d3ee", weight: 2, fillColor: "#0ea5e9", fillOpacity: 0.45 })
        .addTo(group)
        .bindPopup(`<strong>${p.label ?? "Ponto"}</strong>${p.detail ? `<br/><span style="font-size:11px">${p.detail}</span>` : ""}<br/><span style="font-size:10px;opacity:.7">${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}</span>`);
    }

    if (geojson) {
      try {
        const parsed = JSON.parse(geojson);
        L.geoJSON(parsed, { style: { color: "#60a5fa", weight: 2, fillOpacity: 0.12 } }).addTo(group);
      } catch {
        /* invalid geojson handled by caller */
      }
    }

    if (kml) {
      try {
        const doc = new DOMParser().parseFromString(kml, "application/xml");
        const coords = [...doc.querySelectorAll("coordinates")];
        const lines = coords.map((c) =>
          c.textContent
            ? c.textContent.trim().split(/\s+/).map((pair) => {
                const [lon, lat] = pair.split(",").map(Number);
                return [lat, lon] as [number, number];
              }).filter(([la, lo]) => Number.isFinite(la) && Number.isFinite(lo))
            : [],
        ).filter((l) => l.length > 0);
        for (const line of lines) {
          L.polyline(line, { color: "#a78bfa", weight: 2 }).addTo(group);
          for (const [la, lo] of line) markers.push([la, lo]);
        }
      } catch {
        /* ignore malformed kml */
      }
    }

    if (markers.length === 1) map.setView(markers[0], 11);
    else if (markers.length > 1) map.fitBounds(L.latLngBounds(markers).pad(0.25));
  }, [points, geojson, kml, ready]);

  return (
    <div className="ag-map overflow-hidden rounded-xl border border-[var(--ag-border)]" style={{ height }}>
      {error ? (
        <div className="flex h-full items-center justify-center gap-2 px-4 text-center text-[11.5px] text-rose-300">
          <MapPin className="h-4 w-4" /> Falha ao carregar o mapa: {error}
        </div>
      ) : (
        <div ref={nodeRef} className="h-full w-full" />
      )}
    </div>
  );
}
