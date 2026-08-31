/**
 * Resolução e auditoria de geolocalização (server-only).
 *
 * Provedor real de geocodificação reversa: OpenStreetMap Nominatim (sem
 * credenciais). Pode ser trocado por outro serviço via GEOCODING_ENDPOINT.
 * O resultado é usado apenas como evidência do aceite — nunca bloqueia o
 * fluxo quando indisponível.
 */

export type GeoAudit = {
  provider: string;
  address: string | null;
  distanceMeters: number | null;
  geofence: "dentro_do_raio" | "fora_do_raio" | "sem_referencia" | "sem_localizacao";
  resolvedAt: string | null;
};

/** Distância aproximada em metros entre dois pontos. */
export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const rad = (v: number) => (v * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

async function reverseGeocode(
  latitude: number,
  longitude: number,
  customEndpoint?: string | null,
): Promise<string | null> {
  const endpoint =
    customEndpoint ?? process.env["GEOCODING_ENDPOINT"] ?? "https://nominatim.openstreetmap.org/reverse";
  const url = `${endpoint}?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "GoldenHourHub/1.0 (aceite-eletronico)",
        "Accept-Language": "pt-BR",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { display_name?: string };
    return typeof data.display_name === "string" ? data.display_name.slice(0, 300) : null;
  } catch {
    return null;
  }
}

/** Monta a evidência de localização: endereço aproximado e cerca da unidade. */
export async function resolveGeoAudit(input: {
  latitude?: number | null;
  longitude?: number | null;
  unit?: { latitude: number | null; longitude: number | null; point_radius_meters?: number | null } | null;
}): Promise<GeoAudit> {
  const provider = process.env["GEOCODING_ENDPOINT"] ? "custom" : "nominatim";
  if (input.latitude == null || input.longitude == null) {
    return {
      provider,
      address: null,
      distanceMeters: null,
      geofence: "sem_localizacao",
      resolvedAt: null,
    };
  }

  const address = await reverseGeocode(input.latitude, input.longitude);

  let distanceMeters: number | null = null;
  let geofence: GeoAudit["geofence"] = "sem_referencia";
  if (input.unit?.latitude != null && input.unit.longitude != null) {
    distanceMeters = haversineMeters(
      input.latitude,
      input.longitude,
      input.unit.latitude,
      input.unit.longitude,
    );
    const radius = input.unit.point_radius_meters ?? 200;
    geofence = distanceMeters <= radius ? "dentro_do_raio" : "fora_do_raio";
  }

  return { provider, address, distanceMeters, geofence, resolvedAt: new Date().toISOString() };
}
