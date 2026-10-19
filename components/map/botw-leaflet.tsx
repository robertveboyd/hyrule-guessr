"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { pinArt, pinLineColor, type PinKind } from "@/components/map/pin-icons";
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
import { MATCH_MAP_MOVED_MIN_MS } from "@/lib/game/match";
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

function pinIcon(kind: PinKind) {
  const art = pinArt(kind);
  const pulse =
    '<span class="botw-map-pin-pulse"></span><span class="botw-map-pin-pulse botw-map-pin-pulse-late"></span>';
  return L.divIcon({
    className: art.className,
    iconSize: art.iconSize,
    iconAnchor: art.iconAnchor,
    html: `${pulse}<img src="${art.src}" alt="" draggable="false" class="botw-map-pin-art" />`,
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

function syncLine(
  map: L.Map,
  ref: { current: L.Polyline | null },
  from: GamePoint | null,
  to: GamePoint | null,
  color: string,
) {
  if (!from || !to) {
    if (ref.current) {
      map.removeLayer(ref.current);
      ref.current = null;
    }
    return;
  }
  const latlngs: L.LatLngExpression[] = [toLatLng(from), toLatLng(to)];
  const style = {
    color,
    weight: 2,
    opacity: 0.9,
    dashArray: "8 6",
    lineCap: "butt" as const,
  };
  if (ref.current) {
    ref.current.setLatLngs(latlngs);
    ref.current.setStyle(style);
    return;
  }
  ref.current = L.polyline(latlngs, style).addTo(map);
}

function fitPins(map: L.Map, points: Array<GamePoint | null | undefined>) {
  const present = points.filter((point): point is GamePoint => Boolean(point));
  if (present.length === 0) return;
  if (present.length === 1) {
    map.setView(toLatLng(present[0]), 5);
    return;
  }
  map.fitBounds(L.latLngBounds(present.map(toLatLng)), {
    padding: [56, 56],
    maxZoom: 6,
  });
}

function applyFollow(
  map: L.Map,
  follow: GamePoint & { zoom?: number },
  pin: GamePoint | null,
) {
  const zoom = follow.zoom ?? map.getZoom();
  map.setView(toLatLng(follow), zoom, { animate: false });
  if (!pin) return;
  const latlng = toLatLng(pin);
  const visible = map.getBounds().pad(-0.12);
  if (visible.contains(latlng)) return;
  map.panInside(latlng, { padding: [36, 36], animate: false });
}

export type MapViewChange = GamePoint & {
  zoom: number;
  pin: GamePoint | null;
};

export type BotwLeafletProps = {
  className?: string;
  interactive?: boolean;
  guess?: GamePoint | null;
  truth?: GamePoint | null;
  opponent?: GamePoint | null;
  onGuess?: (point: GamePoint) => void;
  onViewChange?: (view: MapViewChange) => void;
  follow?: (GamePoint & { zoom?: number }) | null;
  guessKind?: PinKind;
  showLine?: boolean;
  showZoom?: boolean;
  visible?: boolean;
};

export function BotwLeaflet({
  className,
  interactive = true,
  guess = null,
  truth = null,
  opponent = null,
  onGuess,
  onViewChange,
  follow = null,
  guessKind = "guess",
  showLine = false,
  showZoom = true,
  visible = true,
}: BotwLeafletProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const guessPinRef = useRef<L.Marker | null>(null);
  const truthPinRef = useRef<L.Marker | null>(null);
  const opponentPinRef = useRef<L.Marker | null>(null);
  const guessLineRef = useRef<L.Polyline | null>(null);
  const opponentLineRef = useRef<L.Polyline | null>(null);
  const interactiveRef = useRef(interactive);
  const onGuessRef = useRef(onGuess);
  const onViewChangeRef = useRef(onViewChange);
  const guessRef = useRef(guess);
  const followRef = useRef(follow);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    interactiveRef.current = interactive;
    onGuessRef.current = onGuess;
    onViewChangeRef.current = onViewChange;
    guessRef.current = guess;
    followRef.current = follow;
  }, [interactive, onGuess, onViewChange, guess, follow]);

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
      if (followRef.current) return;
      requestAnimationFrame(() => {
        const current = mapRef.current;
        if (!current) return;
        if (guessPinRef.current) {
          keepPinSize(current, guessPinRef.current, event.zoom, event.center);
        }
        if (truthPinRef.current) {
          keepPinSize(current, truthPinRef.current, event.zoom, event.center);
        }
        if (opponentPinRef.current) {
          keepPinSize(current, opponentPinRef.current, event.zoom, event.center);
        }
      });
    };
    let lastEmitAt = 0;
    const emitView = (force: boolean) => {
      const current = mapRef.current;
      if (!current || !onViewChangeRef.current || followRef.current) return;
      const now = Date.now();
      if (!force && now - lastEmitAt < MATCH_MAP_MOVED_MIN_MS) return;
      lastEmitAt = now;
      const center = latLngToGame(current.getCenter());
      onViewChangeRef.current({
        x: center.x,
        z: center.z,
        zoom: current.getZoom(),
        pin: guessRef.current,
      });
    };
    map.on("zoomanim", onZoomAnim);
    map.on("move", () => emitView(false));
    map.on("zoom", () => emitView(false));
    map.on("zoomend", () => {
      setZoom(map.getZoom());
      emitView(true);
    });
    map.on("moveend", () => emitView(true));
    const onResize = () => map.invalidateSize();
    window.addEventListener("resize", onResize);
    mapRef.current = map;
    map.invalidateSize();
    setMapReady(true);

    return () => {
      window.removeEventListener("resize", onResize);
      map.off("click", onClick);
      map.off("zoomanim", onZoomAnim);
      map.off("move");
      map.off("zoom");
      map.off("zoomend");
      map.off("moveend");
      map.remove();
      mapRef.current = null;
      guessPinRef.current = null;
      truthPinRef.current = null;
      opponentPinRef.current = null;
      guessLineRef.current = null;
      opponentLineRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const syncMarker = (
      pinRef: { current: L.Marker | null },
      point: GamePoint | null,
      kind: PinKind,
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
    syncMarker(opponentPinRef, opponent, "opponent");

    if (showLine) {
      syncLine(map, guessLineRef, guess, truth, pinLineColor("guess"));
      syncLine(
        map,
        opponentLineRef,
        opponent,
        truth,
        pinLineColor("opponent"),
      );
      fitPins(map, [guess, opponent, truth]);
    } else {
      syncLine(map, guessLineRef, null, null, pinLineColor("guess"));
      syncLine(map, opponentLineRef, null, null, pinLineColor("opponent"));
    }

    if (!guess && !truth && !opponent && !follow) {
      const origin = gameToLatLng({ x: 0, z: 0 });
      map.setView([origin.lat, origin.lng], DEFAULT_ZOOM);
    }
  }, [follow, guess, truth, opponent, guessKind, showLine, mapReady]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !mapReady) return;
    const observer = new ResizeObserver(() => {
      const map = mapRef.current;
      if (!map) return;
      map.invalidateSize();
      if (showLine) {
        fitPins(map, [guess, opponent, truth]);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [guess, mapReady, opponent, showLine, truth]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    map.invalidateSize();
    if (showLine) {
      fitPins(map, [guess, opponent, truth]);
    }
  }, [guess, mapReady, opponent, showLine, truth, visible]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !follow || showLine) return;
    applyFollow(map, follow, guess);
  }, [follow, guess, mapReady, showLine]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !onViewChangeRef.current) return;
    const center = latLngToGame(map.getCenter());
    onViewChangeRef.current({
      x: center.x,
      z: center.z,
      zoom: map.getZoom(),
      pin: guess,
    });
  }, [guess, mapReady]);

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
