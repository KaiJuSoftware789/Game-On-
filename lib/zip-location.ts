// Server-only use: keep the national ZIP dataset out of browser bundles.
import zipcodes from "zipcodes";
import type { ZipLocation } from "./local-events";
export function lookupZip(input: string): ZipLocation {
  const zip = input.trim();
  if (!/^\d{5}$/.test(zip))
    throw new Error("Enter a five-digit U.S. ZIP code.");
  const place = zipcodes.lookup(zip);
  if (
    !place ||
    place.country !== "US" ||
    !Number.isFinite(place.latitude) ||
    !Number.isFinite(place.longitude) ||
    (place.latitude === 0 && place.longitude === 0)
  )
    throw new Error(
      "That ZIP code isn't in the location directory. Try a nearby ZIP code.",
    );
  return {
    zip,
    city: place.city,
    state: place.state,
    latitude: place.latitude,
    longitude: place.longitude,
  };
}
