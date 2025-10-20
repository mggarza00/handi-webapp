"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

type LocationPayload = {
  type?: string | null;
  // flat
  address_line?: string | null;
  lat?: number | null;
  lng?: number | null;
  maps_url?: string | null;
  map_image_url?: string | null;
  date?: string | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  // nested
  location?: {
    address_line?: string | null;
    lat?: number | null;
    lng?: number | null;
    maps_url?: string | null;
    map_image_url?: string | null;
  } | null;
};

type Props = {
  payload: LocationPayload;
};

export default function LocationCard({ payload }: Props) {
  const loc = (payload?.location && typeof payload.location === "object")
    ? (payload.location as NonNullable<LocationPayload["location"]>)
    : (payload as unknown as LocationPayload);

  const address = (loc?.address_line || "").toString();
  const mapsUrl = (loc?.maps_url || (payload?.maps_url || null)) as string | null;
  const imgUrl = (loc?.map_image_url || (payload?.map_image_url || null)) as string | null;
  const dateStr = (payload?.date || null)
    || (payload?.scheduled_date ? `${payload.scheduled_date}${payload?.scheduled_time ? ` ${payload.scheduled_time}` : ""}` : null);

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Ubicación del servicio</div>
      {address ? (
        <div className="whitespace-pre-wrap text-sm text-slate-800">{address}</div>
      ) : null}
      {dateStr ? (
        <div className="text-xs text-slate-600">{dateStr}</div>
      ) : null}
      {imgUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imgUrl}
          alt="Mapa de ubicación"
          className="w-full max-w-md rounded border"
        />
      ) : null}
      {mapsUrl ? (
        <div>
          <Button asChild size="sm" variant="secondary">
            <a href={mapsUrl} target="_blank" rel="noreferrer">Abrir en Google Maps</a>
          </Button>
        </div>
      ) : null}
    </div>
  );
}

