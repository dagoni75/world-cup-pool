export function isMaintenanceMode() {
  return process.env.NEXT_PUBLIC_MAINTENANCE_MODE === "true";
}
