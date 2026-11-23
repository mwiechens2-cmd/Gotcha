import React, { useEffect, useMemo, useState } from 'react';
import {
  APIProvider,
  APILoadingStatus,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  useMap,
} from '@vis.gl/react-google-maps';
import {
  Crosshair,
  ExternalLink,
  Info,
  Loader2,
  Lock,
  MapPin,
} from 'lucide-react';
import { PhoneLookupResult } from '../types';
import { fetchMapsClientConfig } from '../utils/webLookup';

interface PhoneAddressGoogleMapProps {
  activeResult: PhoneLookupResult;
  isDossierUnlocked: boolean;
  isSearching?: boolean;
}

interface LatLngLiteral {
  lat: number;
  lng: number;
}

const MapCameraSync: React.FC<{
  center: LatLngLiteral;
  zoom: number;
  focusNonce: number;
}> = ({ center, zoom, focusNonce }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    map.panTo(center);
    map.setZoom(zoom);
  }, [map, center.lat, center.lng, zoom, focusNonce]);

  return null;
};

interface PhoneMapInnerProps {
  center: LatLngLiteral;
  zoom: number;
  focusNonce: number;
  isStreetPin: boolean;
  isPrivateIndividualLocked: boolean;
  pinTitle: string;
  ownerDisplayName: string;
  addressLine1: string;
  addressLine2: string;
  phoneDisplay: string;
  carrierDisplay: string;
  infoOpen: boolean;
  setInfoOpen: React.Dispatch<React.SetStateAction<boolean>>;
  markerResetKey: string;
}

const PhoneMapInner: React.FC<PhoneMapInnerProps> = ({
  center,
  zoom,
  focusNonce,
  isStreetPin,
  isPrivateIndividualLocked,
  pinTitle,
  ownerDisplayName,
  addressLine1,
  addressLine2,
  phoneDisplay,
  carrierDisplay,
  infoOpen,
  setInfoOpen,
  markerResetKey,
}) => {
  const loadingStatus = useApiLoadingStatus();
  const [markerRef, marker] = useAdvancedMarkerRef();

  useEffect(() => {
    if (loadingStatus === APILoadingStatus.AUTH_FAILURE) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    }
  }, [loadingStatus]);

  useEffect(() => {
    // Open InfoWindow when a new marker resolves for the traced number
    if (marker) {
      setInfoOpen(true);
    }
  }, [marker, markerResetKey, setInfoOpen]);

  if (
    loadingStatus === APILoadingStatus.FAILED ||
    loadingStatus === APILoadingStatus.AUTH_FAILURE
  ) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-[#080c14] px-6 text-center space-y-2">
        <MapPin className="h-6 w-6 text-amber-400" />
        <p className="text-xs font-semibold text-slate-200">
          Google Maps JavaScript API could not be initialized in this session.
        </p>
        <p className="text-[11px] text-slate-400 max-w-md">
          Coordinate readout: {center.lat.toFixed(5)}, {center.lng.toFixed(5)}. Use the external
          Google Maps link above to inspect the pinned location directly.
        </p>
      </div>
    );
  }

  return (
    <GoogleMap
      mapId="DEMO_MAP_ID"
      defaultCenter={center}
      defaultZoom={zoom}
      gestureHandling="greedy"
      streetViewControl={false}
      mapTypeControl={true}
      fullscreenControl={true}
      internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
      style={{ width: '100%', height: '100%' }}
    >
      <MapCameraSync center={center} zoom={zoom} focusNonce={focusNonce} />

      <AdvancedMarker
        ref={markerRef}
        position={center}
        title={pinTitle}
        onClick={() => setInfoOpen((prev) => !prev)}
      >
        <Pin
          background={isStreetPin ? '#06b6d4' : '#f59e0b'}
          borderColor={isStreetPin ? '#083344' : '#78350f'}
          glyphColor="#ffffff"
          scale={isStreetPin ? 1.15 : 1.05}
        />
      </AdvancedMarker>

      {infoOpen && marker && (
        <InfoWindow
          anchor={marker}
          maxWidth={300}
          onCloseClick={() => setInfoOpen(false)}
        >
          <div className="p-1 text-slate-900 space-y-1.5 min-w-[210px]">
            <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-1.5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-700">
                  {isPrivateIndividualLocked
                    ? 'Protected Area Pin'
                    : isStreetPin
                    ? 'Verified Address Pin'
                    : 'Rate Center Pin'}
                </p>
                <p className="text-xs font-bold text-slate-900 leading-snug mt-0.5">
                  {ownerDisplayName}
                </p>
              </div>
              <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded shrink-0">
                {phoneDisplay}
              </span>
            </div>

            <div className="text-[11px] leading-snug text-slate-700">
              <p className="font-semibold text-slate-900">{addressLine1}</p>
              {addressLine2 && <p className="text-slate-600">{addressLine2}</p>}
            </div>

            <div className="pt-1 border-t border-slate-200 flex items-center justify-between gap-2 text-[10px] font-mono text-slate-500">
              <span className="truncate max-w-[140px]">{carrierDisplay}</span>
              <span>
                {center.lat.toFixed(4)}, {center.lng.toFixed(4)}
              </span>
            </div>
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  );
};

export const PhoneAddressGoogleMap: React.FC<PhoneAddressGoogleMapProps> = ({
  activeResult,
  isDossierUnlocked,
  isSearching = false,
}) => {
  const [mapsApiKey, setMapsApiKey] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState(true);
  const [infoOpen, setInfoOpen] = useState(true);
  const [focusNonce, setFocusNonce] = useState(0);

  useEffect(() => {
    let active = true;
    fetchMapsClientConfig()
      .then((cfg) => {
        if (active) {
          setMapsApiKey(cfg.apiKey);
        }
      })
      .finally(() => {
        if (active) setLoadingKey(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const owner = activeResult.ownerSummary;
  const fallbackName = activeResult.dossier?.subscriberName;
  const fallbackAddr = activeResult.dossier?.addressHistory?.[0];
  const resolvedName = owner?.ownerName || fallbackName || 'Unlisted Subscriber';
  const resolvedType =
    owner?.ownerType ||
    (activeResult.dossier?.subscriberType === 'Individual'
      ? 'Individual'
      : activeResult.dossier?.subscriberType === 'Corporate'
      ? 'Corporate'
      : 'Unlisted');

  const isPrivateIndividualLocked = resolvedType === 'Individual' && !isDossierUnlocked;
  const rawStreet =
    owner?.streetAddress || (owner?.status === 'verified_owner' ? fallbackAddr?.street : undefined);
  const cityStateDisplay =
    owner?.cityStateZip || `${activeResult.location.city}, ${activeResult.location.state}`;

  const hasExactStreet = Boolean(rawStreet) && !isPrivateIndividualLocked;

  const displayCoordinates = useMemo<LatLngLiteral>(() => {
    const chosen =
      isPrivateIndividualLocked && activeResult.location.rateCenterCoordinates
        ? activeResult.location.rateCenterCoordinates
        : activeResult.location.coordinates;
    const lat = Number.isFinite(chosen?.[0]) ? chosen[0] : 37.7749;
    const lng = Number.isFinite(chosen?.[1]) ? chosen[1] : -122.4194;
    return { lat, lng };
  }, [
    isPrivateIndividualLocked,
    activeResult.location.rateCenterCoordinates,
    activeResult.location.coordinates,
  ]);

  const targetZoom = hasExactStreet ? 16 : 11;

  const ownerDisplayName = isPrivateIndividualLocked
    ? 'Private Individual Subscriber (Locked)'
    : resolvedName;

  const addressLine1 = isPrivateIndividualLocked
    ? `${activeResult.location.city}, ${activeResult.location.state} (Rate Center)`
    : rawStreet || `${cityStateDisplay} (Rate Center Only)`;

  const addressLine2 = isPrivateIndividualLocked
    ? 'Unlock OSINT Dossier to reveal exact street pin'
    : rawStreet
    ? activeResult.location.formattedAddress &&
      activeResult.location.formattedAddress !== rawStreet
      ? activeResult.location.formattedAddress
      : cityStateDisplay
    : `Switch: ${activeResult.location.rateCenter}`;

  const externalMapsQuery = hasExactStreet
    ? [rawStreet, cityStateDisplay].filter(Boolean).join(', ')
    : `${displayCoordinates.lat},${displayCoordinates.lng}`;
  const externalGoogleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    externalMapsQuery
  )}`;

  const markerResetKey = `${activeResult.phoneNumber}-${isPrivateIndividualLocked ? 'locked' : 'open'}-${displayCoordinates.lat}-${displayCoordinates.lng}`;

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0d1322] overflow-hidden">
      {/* Map Panel Header */}
      <div className="px-5 py-4 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <MapPin className="h-4 w-4 text-cyan-400 shrink-0" />
            <h3 className="text-sm sm:text-base font-semibold text-white">
              Registered Address Pin · Google Maps
            </h3>
            {isPrivateIndividualLocked ? (
              <span className="inline-flex items-center gap-1 rounded border border-amber-700/60 bg-amber-950/40 px-2 py-0.5 text-[10px] font-mono font-semibold text-amber-300">
                <Lock className="h-3 w-3" />
                <span>Dossier Locked · Area Pin</span>
              </span>
            ) : hasExactStreet ? (
              <span className="inline-flex items-center gap-1 rounded border border-emerald-700/60 bg-emerald-950/40 px-2 py-0.5 text-[10px] font-mono font-semibold text-emerald-300">
                <span>
                  {activeResult.location.geocodeAccuracy === 'rooftop_address'
                    ? 'Exact Street Pin'
                    : 'Geocoded Address Pin'}
                </span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-mono font-semibold text-slate-300">
                <span>Rate Center Area Pin</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            {isPrivateIndividualLocked
              ? `Centered on ${activeResult.location.city}, ${activeResult.location.state} telecom exchange until private dossier is unlocked.`
              : hasExactStreet
              ? `${rawStreet} · ${cityStateDisplay}`
              : `No public street address listed; pinned to serving switch rate center (${cityStateDisplay}).`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setInfoOpen((prev) => !prev)}
            disabled={isSearching || !mapsApiKey}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 hover:border-cyan-500/50 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            <Info className="h-3.5 w-3.5 text-cyan-400" />
            <span>{infoOpen ? 'Hide Pin Card' : 'Show Pin Card'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFocusNonce((n) => n + 1);
              setInfoOpen(true);
            }}
            disabled={isSearching || !mapsApiKey}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 hover:border-cyan-500/50 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            <Crosshair className="h-3.5 w-3.5 text-cyan-400" />
            <span>Re-center</span>
          </button>

          <a
            href={externalGoogleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-950/40 px-2.5 py-1.5 text-[11px] font-semibold text-cyan-300 hover:bg-cyan-900/50 transition-colors"
          >
            <span>Open in Google Maps</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* Explicit-height Map Canvas (CF2 protection) */}
      <div className="relative w-full h-[300px] sm:h-[340px] bg-[#080c14]">
        {loadingKey ? (
          <div className="h-full w-full flex items-center justify-center gap-2 text-xs text-slate-400 font-mono">
            <Loader2 className="h-4 w-4 text-cyan-400 animate-spin" />
            <span>Initializing Google Maps view...</span>
          </div>
        ) : mapsApiKey ? (
          <APIProvider
            apiKey={mapsApiKey}
            libraries={['marker']}
            language="en"
            region="US"
          >
            <PhoneMapInner
              center={displayCoordinates}
              zoom={targetZoom}
              focusNonce={focusNonce}
              isStreetPin={hasExactStreet}
              isPrivateIndividualLocked={isPrivateIndividualLocked}
              pinTitle={`${ownerDisplayName} — ${addressLine1}`}
              ownerDisplayName={ownerDisplayName}
              addressLine1={addressLine1}
              addressLine2={addressLine2}
              phoneDisplay={activeResult.formattedNational}
              carrierDisplay={activeResult.carrier.name}
              infoOpen={infoOpen}
              setInfoOpen={setInfoOpen}
              markerResetKey={markerResetKey}
            />
          </APIProvider>
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center px-6 text-center space-y-2.5">
            <MapPin className="h-6 w-6 text-amber-400" />
            <p className="text-xs font-semibold text-slate-200">
              Google Maps API key is unavailable in the browser environment.
            </p>
            <p className="text-[11px] text-slate-400 max-w-md">
              Pinned target: {addressLine1} ({displayCoordinates.lat.toFixed(5)},{' '}
              {displayCoordinates.lng.toFixed(5)}).
            </p>
          </div>
        )}

        {isSearching && (
          <div className="absolute inset-0 z-10 bg-[#080c14]/85 backdrop-blur-sm flex flex-col items-center justify-center gap-2 text-xs text-slate-300 font-mono">
            <Loader2 className="h-5 w-5 text-cyan-400 animate-spin" />
            <span>Geocoding resolved address & positioning Google Maps pin...</span>
          </div>
        )}
      </div>

      {/* Bottom Telemetry Strip */}
      <div className="px-5 py-2.5 border-t border-slate-800/80 bg-[#080c14]/70 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-400">
        <span>
          PIN: {displayCoordinates.lat.toFixed(5)}°, {displayCoordinates.lng.toFixed(5)}°
        </span>
        <span>
          ZOOM: {targetZoom}x ({hasExactStreet ? 'Street-Level' : 'Exchange Area'})
        </span>
      </div>
    </div>
  );
};
