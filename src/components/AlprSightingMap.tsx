import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Crosshair,
  FileDown,
  Layers,
  Lock,
  MapPin,
  Navigation,
  Route,
} from 'lucide-react';
import { AlprCameraSighting, AlprQueryStatus } from '../types';

interface AlprSightingMapProps {
  plateNumber: string;
  stateCode: string;
  overallStatus: AlprQueryStatus;
  sightings: AlprCameraSighting[];
  totalSightingsCount: number;
  selectedSightingId: string | null;
  focusNonce?: number;
  onSelectSighting: (sightingId: string) => void;
  isLockedPreview: boolean;
  onExportPdf?: () => void;
}

type MapTileStyle = 'dark' | 'street';

const TILE_LAYERS: Record<
  MapTileStyle,
  { url: string; attribution: string; label: string }
> = {
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    label: 'Dark Tactical',
  },
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    label: 'Street Grid',
  },
};

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getMarkerAccent(
  cameraType: AlprCameraSighting['cameraType'],
  overallStatus: AlprQueryStatus,
  index: number
): string {
  if (index === 0 && overallStatus === 'queried_active') {
    return '#f59e0b'; // Amber alert highlight for most recent actively queried node
  }
  if (cameraType === 'Flock Sentinel (HOA)') {
    return '#10b981'; // Emerald for HOA private sentinel gates
  }
  if (cameraType === 'Mobile Cruiser ALPR' || cameraType === 'Highway Transit Pole') {
    return '#818cf8'; // Indigo for mobile / highway transit nodes
  }
  return '#06b6d4'; // Cyan for fixed municipal Flock Falcon poles
}

export const AlprSightingMap: React.FC<AlprSightingMapProps> = ({
  plateNumber,
  stateCode,
  overallStatus,
  sightings,
  totalSightingsCount,
  selectedSightingId,
  focusNonce = 0,
  onSelectSighting,
  isLockedPreview,
  onExportPdf,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const overlayGroupRef = useRef<L.LayerGroup | null>(null);
  const markersByIdRef = useRef<Map<string, L.Marker>>(new Map());
  const onSelectRef = useRef(onSelectSighting);

  const [tileStyle, setTileStyle] = useState<MapTileStyle>('dark');
  const [showCorridor, setShowCorridor] = useState(true);
  const [tileWarning, setTileWarning] = useState(false);

  onSelectRef.current = onSelectSighting;

  // Chronological order (oldest -> newest) for trajectory path
  const chronologicalSightings = useMemo(() => {
    return [...sightings].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [sightings]);

  // Initialize Leaflet map instance once
  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const initialCenter: [number, number] =
      sightings[0]?.coordinates ?? [34.0522, -118.2437];

    const map = L.map(el, {
      center: initialCenter,
      zoom: 12,
      zoomControl: true,
      scrollWheelZoom: false,
    });

    const overlays = L.layerGroup().addTo(map);
    mapRef.current = map;
    overlayGroupRef.current = overlays;

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize({ animate: false });
      });
      resizeObserver.observe(el);
    }

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      markersByIdRef.current.clear();
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      overlayGroupRef.current = null;
    };
  }, []);

  // Switch tile basemap when tileStyle changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }

    setTileWarning(false);
    let tileErrors = 0;

    const cfg = TILE_LAYERS[tileStyle];
    const layer = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: 19,
    });

    layer.on('tileerror', () => {
      tileErrors += 1;
      if (tileErrors >= 4) {
        setTileWarning(true);
      }
    });

    layer.on('tileload', () => {
      tileErrors = 0;
      setTileWarning(false);
    });

    layer.addTo(map);
    tileLayerRef.current = layer;
  }, [tileStyle]);

  // Helper to fit viewport around all active sightings
  const fitMapToSightings = (targetList: AlprCameraSighting[]) => {
    const map = mapRef.current;
    if (!map || targetList.length === 0) return;

    if (targetList.length === 1) {
      map.setView(targetList[0].coordinates, 13, { animate: true });
      return;
    }

    const bounds = L.latLngBounds(targetList.map((s) => s.coordinates));
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [44, 44], maxZoom: 14, animate: true });
    }
  };

  // Render camera sighting markers, sensor coverage halos, and trajectory path
  useEffect(() => {
    const map = mapRef.current;
    const overlays = overlayGroupRef.current;
    if (!map || !overlays) return;

    overlays.clearLayers();
    markersByIdRef.current.clear();

    if (sightings.length === 0) return;

    // Draw trajectory line connecting sightings in chronological order
    if (showCorridor && chronologicalSightings.length > 1) {
      const latLngs = chronologicalSightings.map((s) => s.coordinates);
      L.polyline(latLngs, {
        color: overallStatus === 'queried_active' ? '#f59e0b' : '#22d3ee',
        weight: 2.5,
        opacity: 0.78,
        dashArray: '6 6',
      }).addTo(overlays);
    }

    // Plot newest-first index (#1 = latest capture)
    sightings.forEach((sighting, idx) => {
      const accent = getMarkerAccent(sighting.cameraType, overallStatus, idx);
      const isSelected = sighting.id === selectedSightingId;
      const radiusMeters = sighting.cameraType === 'Highway Transit Pole' ? 480 : 320;

      // Subtle optical coverage radius circle around sensor pole
      L.circle(sighting.coordinates, {
        radius: radiusMeters,
        color: accent,
        weight: isSelected ? 1.5 : 1,
        opacity: isSelected ? 0.65 : 0.35,
        fillColor: accent,
        fillOpacity: isSelected ? 0.14 : 0.06,
      }).addTo(overlays);

      const pinSize = isSelected ? 30 : 24;
      const iconHtml = `
        <div style="
          width:${pinSize}px;
          height:${pinSize}px;
          border-radius:9999px;
          background:${accent};
          color:#080c14;
          border:2px solid ${isSelected ? '#ffffff' : '#0f172a'};
          box-shadow:0 0 ${isSelected ? '14px' : '6px'} ${accent};
          display:flex;
          align-items:center;
          justify-content:center;
          font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
          font-size:${isSelected ? '12px' : '11px'};
          font-weight:700;
        ">${idx + 1}</div>
      `;

      const markerIcon = L.divIcon({
        className: 'vigil-alpr-marker',
        html: iconHtml,
        iconSize: [pinSize, pinSize],
        iconAnchor: [pinSize / 2, pinSize / 2],
        popupAnchor: [0, -pinSize / 2],
      });

      const popupHtml = `
        <div style="min-width:220px;font-family:ui-sans-serif,system-ui,sans-serif;font-size:12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;">
            <span style="font-family:ui-monospace,monospace;font-size:11px;font-weight:700;color:${accent};">NODE #${idx + 1} · ${escapeHtml(sighting.cameraId)}</span>
          </div>
          <div style="font-weight:700;color:#ffffff;margin-bottom:4px;">${escapeHtml(sighting.cameraName)}</div>
          <div style="color:#cbd5e1;font-size:11px;margin-bottom:6px;">${escapeHtml(sighting.intersectionOrLocation)}</div>
          <div style="border-top:1px solid #1e293b;padding-top:6px;display:grid;gap:2px;font-size:11px;color:#94a3b8;font-family:ui-monospace,monospace;">
            <div>Type: <span style="color:#34d399;">${escapeHtml(sighting.cameraType)}</span></div>
            <div>Agency: <span style="color:#e2e8f0;">${escapeHtml(sighting.municipalityAgency)}</span></div>
            <div>Captured: <span style="color:#e2e8f0;">${escapeHtml(new Date(sighting.timestamp).toLocaleString())}</span></div>
            <div>Vector: <span style="color:#e2e8f0;">${escapeHtml(sighting.directionOfTravel)} · Lane ${sighting.laneNumber} · ~${sighting.speedEstimateMph} MPH</span></div>
            <div>GPS: <span style="color:#67e8f0;">${sighting.coordinates[0].toFixed(4)}, ${sighting.coordinates[1].toFixed(4)}</span></div>
          </div>
        </div>
      `;

      const marker = L.marker(sighting.coordinates, { icon: markerIcon })
        .bindPopup(popupHtml, { maxWidth: 290 })
        .on('click', () => {
          onSelectRef.current(sighting.id);
        });

      marker.addTo(overlays);
      markersByIdRef.current.set(sighting.id, marker);
    });
  }, [sightings, chronologicalSightings, overallStatus, selectedSightingId, showCorridor]);

  // Refit map bounds automatically whenever the audited vehicle sightings list changes
  useEffect(() => {
    fitMapToSightings(sightings);
  }, [plateNumber, stateCode, sightings.length]);

  // Fly to and open popup when sighting card or node chip explicitly requests focus
  useEffect(() => {
    if (!focusNonce || !selectedSightingId) return;
    const target = sightings.find((s) => s.id === selectedSightingId);
    const map = mapRef.current;
    if (!target || !map) return;

    map.flyTo(target.coordinates, Math.max(map.getZoom(), 13), { duration: 0.45 });
    const marker = markersByIdRef.current.get(target.id);
    if (marker) {
      marker.openPopup();
    }
  }, [focusNonce, selectedSightingId, sightings]);

  // Fly to selected sighting and open popup when user picks a node
  const focusNodeOnMap = (sighting: AlprCameraSighting) => {
    onSelectSighting(sighting.id);
    const map = mapRef.current;
    if (!map) return;

    map.flyTo(sighting.coordinates, Math.max(map.getZoom(), 13), {
      duration: 0.45,
    });
    const marker = markersByIdRef.current.get(sighting.id);
    if (marker) {
      marker.openPopup();
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0d1322] p-5 space-y-4">
      {/* Header & Interactive Map Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <MapPin className="h-4 w-4 text-cyan-400 shrink-0" />
            <h3 className="text-base font-semibold text-white">
              Optical Camera Sighting Map & Corridor Plot
            </h3>
            <span className="text-xs font-mono text-slate-400 tabular-nums">
              {sightings.length} of {totalSightingsCount} Node(s) Mapped · [{plateNumber}] ({stateCode})
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Interactive spatial plot of ALPR camera detections, optical sensor coverage zones, and chronological travel corridor.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowCorridor((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              showCorridor
                ? 'border-cyan-500/60 bg-cyan-950/50 text-cyan-300'
                : 'border-slate-700 bg-slate-900 text-slate-300 hover:text-white'
            }`}
          >
            <Route className="h-3.5 w-3.5" />
            <span>Corridor Path</span>
          </button>

          <button
            type="button"
            onClick={() => setTileStyle((prev) => (prev === 'dark' ? 'street' : 'dark'))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:border-cyan-500/50 hover:text-white transition-colors cursor-pointer"
          >
            <Layers className="h-3.5 w-3.5 text-cyan-400" />
            <span>{tileStyle === 'dark' ? 'Dark Tactical' : 'Street Grid'}</span>
          </button>

          <button
            type="button"
            onClick={() => fitMapToSightings(sightings)}
            disabled={sightings.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:border-cyan-500/50 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            <Crosshair className="h-3.5 w-3.5 text-cyan-400" />
            <span>Fit Bounds</span>
          </button>

          {onExportPdf && (
            <button
              type="button"
              onClick={onExportPdf}
              title={
                isLockedPreview
                  ? 'Unlock OSINT access to export full ALPR PDF dossier'
                  : 'Open PDF dossier briefing & export'
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900/70 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:border-cyan-500/50 hover:text-cyan-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {isLockedPreview ? (
                <Lock className="h-3.5 w-3.5 text-slate-400" />
              ) : (
                <FileDown className="h-3.5 w-3.5 text-cyan-400" />
              )}
              <span>Export to PDF</span>
            </button>
          )}
        </div>
      </div>

      {/* Tile Network Notice */}
      {tileWarning && (
        <div className="rounded-lg border border-amber-700/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-200 flex items-center justify-between gap-2">
          <span>
            Map basemap tiles are slow or blocked in this network environment; plotted camera GPS markers remain active.
          </span>
          <button
            type="button"
            onClick={() => setTileStyle((prev) => (prev === 'dark' ? 'street' : 'dark'))}
            className="text-amber-300 hover:text-white underline font-medium cursor-pointer shrink-0"
          >
            Switch Tile Source
          </button>
        </div>
      )}

      {/* Leaflet Canvas */}
      <div className="relative rounded-lg overflow-hidden border border-slate-800 bg-[#080c14] vigil-alpr-map">
        <div
          ref={containerRef}
          className="h-[340px] sm:h-[380px] w-full z-0"
          aria-label={`Interactive ALPR camera sighting map for license plate ${plateNumber} in ${stateCode}`}
        />

        {isLockedPreview && totalSightingsCount > sightings.length && (
          <div className="absolute bottom-3 left-3 z-[400] max-w-sm rounded-lg border border-cyan-500/40 bg-[#080c14]/90 backdrop-blur-sm px-3 py-2 text-[11px] text-slate-200 flex items-center gap-2 shadow-lg">
            <Lock className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
            <span>
              Previewing latest node only ({totalSightingsCount - sightings.length} additional camera coordinate(s) locked).
            </span>
          </div>
        )}
      </div>

      {/* Quick Node Selector & Legend Bar */}
      {sightings.length > 0 && (
        <div className="flex flex-col gap-2.5 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            {sightings.map((sighting, idx) => {
              const isSelected = sighting.id === selectedSightingId;
              const accent = getMarkerAccent(sighting.cameraType, overallStatus, idx);
              return (
                <button
                  key={sighting.id}
                  type="button"
                  onClick={() => focusNodeOnMap(sighting)}
                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-cyan-400/80 bg-cyan-950/50 text-white'
                      : 'border-slate-800 bg-[#080c14]/70 text-slate-300 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  <span
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-mono font-bold text-[#080c14] shrink-0"
                    style={{ backgroundColor: accent }}
                  >
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <span className="font-medium block truncate max-w-[180px]">
                      {sighting.cameraName}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400 tabular-nums block">
                      {sighting.coordinates[0].toFixed(4)}, {sighting.coordinates[1].toFixed(4)}
                    </span>
                  </div>
                  <Navigation className="h-3 w-3 text-slate-400 shrink-0" />
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 font-mono">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-500 inline-block" />
              Flock Falcon (Fixed)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" />
              Flock Sentinel (HOA)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-400 inline-block" />
              Highway / Mobile Node
            </span>
            {overallStatus === 'queried_active' && (
              <span className="inline-flex items-center gap-1.5 text-amber-300">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500 inline-block" />
                Active Query Primary Capture
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
