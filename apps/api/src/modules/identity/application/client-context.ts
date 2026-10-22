/** Métadonnées de la requête utiles à l'audit, aux logs et au rate limiting. */
export interface ClientContext {
  ip: string | null
  userAgent: string | null
  requestId: string | null
}

export interface DeviceInfo {
  deviceId?: string | null
  deviceName?: string | null
}
