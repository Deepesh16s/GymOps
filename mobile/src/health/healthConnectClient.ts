import { Linking, Platform } from "react-native";
import {
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  requestPermission,
  getGrantedPermissions,
  readRecords,
  getChanges,
  SdkAvailabilityStatus,
  type Permission,
  type ReadRecordsOptions,
  type ReadRecordsResult,
  type GetChangesRequest,
  type GetChangesResults,
} from "react-native-health-connect";
import { READ_PERMISSIONS, type TrackedRecordType } from "./recordTypes";

export type Availability = "unsupported" | "update_required" | "available";

const HEALTH_CONNECT_PACKAGE = "com.google.android.apps.healthdata";

export async function checkAvailability(): Promise<Availability> {
  if (Platform.OS !== "android") return "unsupported";

  const status = await getSdkStatus();
  if (status === SdkAvailabilityStatus.SDK_AVAILABLE) return "available";
  if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
    return "update_required";
  }
  return "unsupported";
}

export async function openHealthConnectInPlayStore(): Promise<void> {
  const marketUrl = `market://details?id=${HEALTH_CONNECT_PACKAGE}`;
  const webUrl = `https://play.google.com/store/apps/details?id=${HEALTH_CONNECT_PACKAGE}`;
  const canOpenMarket = await Linking.canOpenURL(marketUrl);
  await Linking.openURL(canOpenMarket ? marketUrl : webUrl);
}

let initialized = false;

export async function ensureInitialized(): Promise<void> {
  if (initialized) return;
  const ok = await initialize();
  if (!ok) throw new Error("Health Connect failed to initialize");
  initialized = true;
}

export async function requestHealthPermissions(): Promise<Permission[]> {
  await ensureInitialized();
  const granted = await requestPermission(READ_PERMISSIONS);
  return granted as Permission[];
}

export async function getGrantedHealthPermissions(): Promise<Permission[]> {
  await ensureInitialized();
  const granted = await getGrantedPermissions();
  return granted as Permission[];
}

export function hasAllTrackedPermissions(granted: Permission[]): boolean {
  const grantedTypes = new Set(
    granted.filter((p) => p.accessType === "read").map((p) => p.recordType)
  );
  return READ_PERMISSIONS.every((p) => grantedTypes.has(p.recordType));
}

export async function readRecordsForType<T extends TrackedRecordType>(
  recordType: T,
  options: ReadRecordsOptions
): Promise<ReadRecordsResult<T>> {
  await ensureInitialized();
  return readRecords(recordType, options);
}

export async function fetchChanges(request: GetChangesRequest): Promise<GetChangesResults> {
  await ensureInitialized();
  return getChanges(request);
}

export { openHealthConnectSettings };
