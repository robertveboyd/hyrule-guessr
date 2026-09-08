"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { Button } from "@/components/ui/button";
import {
  CRS_TRANSFORM,
  DEFAULT_ZOOM,
  MAX_NATIVE_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  TILE_SIZE,
  clampToMainField,
  gameToLatLng,
  latLngToGame,
  mainFieldLatLngBounds,
  type GamePoint,
} from "@/lib/game/crs";
import { mapBaseImageUrl, mapTilesUrl } from "@/lib/game/tiles";
import { cn } from "@/lib/utils";

function createBotwCrs(): L.CRS {
  return L.Util.extend({}, L.CRS.Simple, {
    transformation: new L.Transformation(
      CRS_TRANSFORM.a,
      CRS_TRANSFORM.b,
      CRS_TRANSFORM.c,
      CRS_TRANSFORM.d,
    ),
  });
}

const PIN_SIZE = 12;

function pinIcon(kind: "preview" | "guess" | "truth") {
  const dot =
    kind === "guess"
      ? "botw-map-pin-dot botw-map-pin-dot-guess"
      : kind === "truth"
        ? "botw-map-pin-dot botw-map-pin-dot-truth"
        : "botw-map-pin-dot";
  return L.divIcon({
    className: "botw-map-pin",
    iconSize: [PIN_SIZE, PIN_SIZE],
    iconAnchor: [PIN_SIZE / 2, PIN_SIZE / 2],
    html: `<span class="${dot}"></span>`,
  });
}

function toLatLng(point: GamePoint) {
  const latlng = gameToLatLng(point);
  return L.latLng(latlng.lat, latlng.lng);
}

function latLngToNewLayerPoint(
  map: L.Map,
  latlng: L.LatLng,
  zoom: number,
  center: L.LatLng,
) {
  return (
    map as L.Map & {
      _latLngToNewLayerPoint: (
        latlng: L.LatLng,
        zoom: number,
        center: L.LatLng,
      ) => L.Point;
    }
  )._latLngToNewLayerPoint(latlng, zoom, center);
}

function keepPinSize(map: L.Map, pin: L.Marker, zoom: number, center: L.LatLng) {
  const icon = pin.getElement();
  if (!icon) return;
  const pos = latLngToNewLayerPoint(map, pin.getLatLng(), zoom, center).round();
  L.DomUtil.setTransform(icon, pos, 1 / map.getZoomScale(zoom));
}

export type BotwLeafletProps = {
  className?: string;
  interactive?: boolean;
  guess?: GamePoint | null;
  truth?: GamePoint | null;
  onGuess?: (point: GamePoint) => void;
  guessKind?: "preview" | "guess";
  showLine?: boolean;
  showZoom?: boolean;
  visible?: boolean;
};

export function BotwLeaflet({
  className,
  interactive = true,
  guess = null,
  truth = null,
  onGuess,
  guessKind = "guess",
  showLine = false,
  showZoom = true,
  visible = true,
}: BotwLeafletProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const guessPinRef = useRef<L.Marker | null>(null);
  const truthPinRef = useRef<L.Marker | null>(null);
  const lineRef = useRef<L.Polyline | null>(null);
  const interactiveRef = useRef(interactive);
  const onGuessRef = useRef(onGuess);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    interactiveRef.current = interactive;
    onGuessRef.current = onGuess;
  }, [interactive, onGuess]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const pan = interactive || visible;
    const toggle = (handler: L.Handler, on: boolean) => {
      if (on) handler.enable();
      else handler.disable();
    };
    toggle(map.dragging, pan);
    toggle(map.scrollWheelZoom, pan);
    toggle(map.doubleClickZoom, pan);
    toggle(map.touchZoom, pan);
  }, [interactive, mapReady, visible]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const bounds = mainFieldLatLngBounds();
    const maxBounds = L.latLngBounds(
      L.latLng(bounds.southWest.lat, bounds.southWest.lng),
      L.latLng(bounds.northEast.lat, bounds.northEast.lng),
    );
    const origin = gameToLatLng({ x: 0, z: 0 });

    const map = L.map(el, {
      crs: createBotwCrs(),
      attributionControl: false,
      zoomControl: false,
      keyboard: false,
      boxZoom: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      zoom: DEFAULT_ZOOM,
      center: [origin.lat, origin.lng],
      maxBounds,
      maxBoundsViscosity: 1,
    });

    map.createPane("botw-base").style.zIndex = "150";
    L.imageOverlay(mapBaseImageUrl(), maxBounds, {
      pane: "botw-base",
    }).addTo(map);
    L.tileLayer(mapTilesUrl(), {
      pane: "tilePane",
      tileSize: TILE_SIZE,
      maxNativeZoom: MAX_NATIVE_ZOOM,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      bounds: maxBounds,
      noWrap: true,
    }).addTo(map);

    const onClick = (event: L.LeafletMouseEvent) => {
      if (!interactiveRef.current) return;
      onGuessRef.current?.(clampToMainField(latLngToGame(event.latlng)));
    };
    map.on("click", onClick);
    const onZoomAnim = (event: L.ZoomAnimEvent) => {
      requestAnimationFrame(() => {
        const current = mapRef.current;
        if (!current) return;
        if (guessPinRef.current) {
          keepPinSize(current, guessPinRef.current, event.zoom, event.center);
        }
        if (truthPinRef.current) {
          keepPinSize(current, truthPinRef.current, event.zoom, event.center);
        }
      });
    };
    map.on("zoomanim", onZoomAnim);
    map.on("zoomend", () => setZoom(map.getZoom()));
    const onResize = () => map.invalidateSize();
    window.addEventListener("resize", onResize);
    mapRef.current = map;
    map.invalidateSize();
    setMapReady(true);

    return () => {
      window.removeEventListener("resize", onResize);
      map.off("click", onClick);
      map.off("zoomanim", onZoomAnim);
      map.remove();
      mapRef.current = null;
      guessPinRef.current = null;
      truthPinRef.current = null;
      lineRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const syncMarker = (
      pinRef: { current: L.Marker | null },
      point: GamePoint | null,
      kind: "preview" | "guess" | "truth",
    ) => {
      if (!point) {
        if (pinRef.current) {
          map.removeLayer(pinRef.current);
          pinRef.current = null;
        }
        return;
      }
      const latlng = toLatLng(point);
      if (pinRef.current) {
        pinRef.current.setLatLng(latlng);
        pinRef.current.setIcon(pinIcon(kind));
      } else {
        pinRef.current = L.marker(latlng, {
          icon: pinIcon(kind),
          interactive: false,
          keyboard: false,
        }).addTo(map);
      }
    };

    syncMarker(guessPinRef, guess, guessKind);
    syncMarker(truthPinRef, truth, "truth");

    if (showLine && guess && truth) {
      const latlngs: L.LatLngExpression[] = [toLatLng(guess), toLatLng(truth)];
      if (lineRef.current) {
        lineRef.current.setLatLngs(latlngs);
      } else {
        lineRef.current = L.polyline(latlngs, {
          color: "#e8eef5",
          weight: 2,
          opacity: 0.9,
        }).addTo(map);
      }
    } else if (lineRef.current) {
      map.removeLayer(lineRef.current);
      lineRef.current = null;
    }

    if (!guess && !truth) {
      const origin = gameToLatLng({ x: 0, z: 0 });
      map.setView([origin.lat, origin.lng], DEFAULT_ZOOM);
    }
  }, [guess, truth, guessKind, showLine, mapReady]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !mapReady) return;
    const observer = new ResizeObserver(() => {
      const map = mapRef.current;
      if (!map) return;
      map.invalidateSize();
      if (showLine && guess && truth) {
        map.fitBounds(L.latLngBounds([toLatLng(guess), toLatLng(truth)]), {
          padding: [48, 48],
          maxZoom: 6,
        });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [guess, mapReady, showLine, truth]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    map.invalidateSize();
    if (showLine && guess && truth) {
      map.fitBounds(L.latLngBounds([toLatLng(guess), toLatLng(truth)]), {
        padding: [48, 48],
        maxZoom: 6,
      });
    }
  }, [guess, mapReady, showLine, truth, visible]);

  return (
    <div className={cn("relative h-full w-full min-h-0 bg-black", className)}>
      <div ref={containerRef} className="absolute inset-0 !bg-black" />
      {showZoom ? (
        <div className="absolute right-3 bottom-3 z-[1000] flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">z{zoom}</span>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="border-amber/40 bg-hud text-amber"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => mapRef.current?.zoomOut()}
            aria-label="Zoom out"
          >
            −
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="border-amber/40 bg-hud text-amber"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => mapRef.current?.zoomIn()}
            aria-label="Zoom in"
          >
            +
          </Button>
        </div>
      ) : null}
    </div>
  );
}
