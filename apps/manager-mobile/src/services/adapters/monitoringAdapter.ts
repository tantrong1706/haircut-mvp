import {
  captureError as sharedCaptureError,
  clearMonitoringUser as sharedClearMonitoringUser,
  setMonitoringUser as sharedSetMonitoringUser,
  trackEvent as sharedTrackEvent,
  withMonitoringTrace as sharedWithMonitoringTrace,
} from "../../../../../customer-web/src/services/monitoring";

export const captureError = sharedCaptureError;
export const clearMonitoringUser = sharedClearMonitoringUser;
export const setMonitoringUser = sharedSetMonitoringUser;
export const trackEvent = sharedTrackEvent;
export const withMonitoringTrace = sharedWithMonitoringTrace;
