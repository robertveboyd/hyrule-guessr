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

function formatCoord(value: number) {
  return value.toFixed(2);
}

const PIN_SIZE = 12;

function pinIcon() {
  return L.divIcon({
    className: "botw-map-pin",
    iconSize: [PIN_SIZE, PIN_SIZE],
    iconAnchor: [PIN_SIZE / 2, PIN_SIZE / 2],
    html: `<span class="botw-map-pin-dot"></span>`,
  });
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

export function BotwMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pinRef = useRef<L.Marker | null>(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [point, setPoint] = useState<{ x: number; z: number } | null>(null);

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

    const placePin = (game: GamePoint) => {
      const clamped = clampToMainField(game);
      setPoint(clamped);
      const latlng = L.latLng(
        gameToLatLng(clamped).lat,
        gameToLatLng(clamped).lng,
      );
      if (pinRef.current) {
        pinRef.current.setLatLng(latlng);
      } else {
        pinRef.current = L.marker(latlng, {
          icon: pinIcon(),
          interactive: false,
          keyboard: false,
        }).addTo(map);
      }
    };
    const onClick = (event: L.LeafletMouseEvent) => {
      placePin(latLngToGame(event.latlng));
    };

    map.on("click", onClick);
    const onZoomAnim = (event: L.ZoomAnimEvent) => {
      const pin = pinRef.current;
      if (!pin) return;
      requestAnimationFrame(() => {
        keepPinSize(map, pin, event.zoom, event.center);
      });
    };
    map.on("zoomanim", onZoomAnim);
    map.on("zoomend", () => setZoom(map.getZoom()));
    const onResize = () => map.invalidateSize();
    window.addEventListener("resize", onResize);
    mapRef.current = map;
    map.invalidateSize();

    return () => {
      window.removeEventListener("resize", onResize);
      map.off("click", onClick);
      map.off("zoomanim", onZoomAnim);
      map.remove();
      mapRef.current = null;
      pinRef.current = null;
    };
  }, []);

  return (
    <div className="flex min-h-svh flex-col bg-black">
      <header className="flex flex-wrap items-center justify-between gap-3 bg-hud px-4 py-2">
        <p className="font-mono text-sm text-foreground">
          {point
            ? `x ${formatCoord(point.x)}, z ${formatCoord(point.z)}`
            : "Click the map for BotW (x, z)"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            z{zoom}
          </span>
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
      </header>
      <div ref={containerRef} className="min-h-0 flex-1 !bg-black" />
    </div>
  );
}
