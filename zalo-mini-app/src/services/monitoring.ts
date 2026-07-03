import {
  getAnalytics,
  isSupported as isAnalyticsSupported,
  logEvent,
  setAnalyticsCollectionEnabled,
  setUserId,
  setUserProperties,
  type Analytics,
} from "firebase/analytics";
import {
  getPerformance,
  trace,
  type FirebasePerformance,
  type PerformanceTrace,
} from "firebase/performance";
import { getFirebaseApp, getFunctionWriteMode, isFirebaseConfigured } from "./firebase";

type SentryModule = typeof import("@sentry/react");
type MonitoringValue = string | number | boolean | null | undefined;
type MonitoringParams = Record<string, MonitoringValue>;

let analyticsPromise: Promise<Analytics | null> | null = null;
let performanceInstance: FirebasePerformance | null = null;
let sentryPromise: Promise<SentryModule | null> | null = null;
let started = false;

export function initMonitoring() {
  if (started || isMonitoringDisabled()) {
    return;
  }

  started = true;
  void getAnalyticsClient();
  getPerformanceClient();
  void getSentryClient();

  window.addEventListener("error", (event) => {
    captureError(event.error || event.message, { area: "window_error" });
  });

  window.addEventListener("unhandledrejection", (event) => {
    captureError(event.reason, { area: "unhandled_rejection" });
  });

  trackEvent("app_started", {
    app_env: appEnvironment(),
    write_mode: getFunctionWriteMode(),
  });
}

export function trackEvent(name: string, params: MonitoringParams = {}) {
  if (isMonitoringDisabled()) {
    return;
  }

  void getAnalyticsClient().then((analytics) => {
    if (!analytics) {
      return;
    }

    logEvent(analytics, name, cleanParams(params));
  });
}

export function captureError(error: unknown, context: MonitoringParams = {}) {
  console.error(error);

  if (isMonitoringDisabled()) {
    return;
  }

  void getSentryClient().then((sentry) => {
    if (!sentry) {
      return;
    }

    sentry.captureException(toError(error), {
      extra: cleanParams(context),
    });
  });

  trackEvent("app_error", {
    area: String(context.area || "unknown"),
  });
}

export async function withMonitoringTrace<T>(
  name: string,
  task: () => Promise<T>,
  params: MonitoringParams = {},
): Promise<T> {
  const perfTrace = startTrace(name, params);

  try {
    const result = await task();
    perfTrace?.putMetric("success", 1);
    return result;
  } catch (error) {
    perfTrace?.putMetric("failure", 1);
    captureError(error, { area: name, ...params });
    throw error;
  } finally {
    try {
      perfTrace?.stop();
    } catch {
      // Do not let monitoring break the user flow.
    }
  }
}

export function setMonitoringUser(user: {
  uid: string;
  role: string;
  salonId: string;
}) {
  if (isMonitoringDisabled()) {
    return;
  }

  void getAnalyticsClient().then((analytics) => {
    if (!analytics) {
      return;
    }

    setUserId(analytics, user.uid);
    setUserProperties(analytics, {
      role: user.role,
      salon_id: user.salonId,
    });
  });

  void getSentryClient().then((sentry) => {
    if (!sentry) {
      return;
    }

    sentry.setUser({ id: user.uid });
    sentry.setTag("role", user.role);
    sentry.setTag("salon_id", user.salonId);
  });
}

export function clearMonitoringUser() {
  if (isMonitoringDisabled()) {
    return;
  }

  void getAnalyticsClient().then((analytics) => {
    if (!analytics) {
      return;
    }

    setUserId(analytics, null);
    setUserProperties(analytics, {
      role: "none",
      salon_id: "none",
    });
  });

  void getSentryClient().then((sentry) => {
    sentry?.setUser(null);
  });
}

async function getAnalyticsClient() {
  if (!analyticsPromise) {
    analyticsPromise = createAnalyticsClient();
  }

  return analyticsPromise;
}

async function createAnalyticsClient(): Promise<Analytics | null> {
  if (!isFirebaseConfigured()) {
    return null;
  }

  const app = getFirebaseApp();

  if (!app || !import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) {
    return null;
  }

  try {
    if (!(await isAnalyticsSupported())) {
      return null;
    }

    const analytics = getAnalytics(app);
    setAnalyticsCollectionEnabled(analytics, true);
    return analytics;
  } catch (error) {
    console.warn("Không bật được Firebase Analytics.", error);
    return null;
  }
}

function getPerformanceClient() {
  if (performanceInstance || !isFirebaseConfigured()) {
    return performanceInstance;
  }

  const app = getFirebaseApp();

  if (!app) {
    return null;
  }

  try {
    performanceInstance = getPerformance(app);
  } catch (error) {
    console.warn("Không bật được Firebase Performance.", error);
  }

  return performanceInstance;
}

function startTrace(name: string, params: MonitoringParams): PerformanceTrace | null {
  const performanceClient = getPerformanceClient();

  if (!performanceClient) {
    return null;
  }

  try {
    const perfTrace = trace(performanceClient, name);
    const attributes = cleanParams(params);

    Object.entries(attributes).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        return;
      }

      perfTrace.putAttribute(key.slice(0, 40), String(value).slice(0, 100));
    });

    perfTrace.start();
    return perfTrace;
  } catch (error) {
    console.warn("Không tạo được performance trace.", error);
    return null;
  }
}

async function getSentryClient() {
  if (!sentryPromise) {
    sentryPromise = createSentryClient();
  }

  return sentryPromise;
}

async function createSentryClient(): Promise<SentryModule | null> {
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  if (!dsn) {
    return null;
  }

  try {
    const sentry = await import("@sentry/react");
    sentry.init({
      dsn,
      environment: appEnvironment(),
      release: import.meta.env.VITE_APP_VERSION || undefined,
      tracesSampleRate: parseSampleRate(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE, 0.1),
      replaysSessionSampleRate: parseSampleRate(import.meta.env.VITE_SENTRY_REPLAY_SAMPLE_RATE, 0),
      replaysOnErrorSampleRate: parseSampleRate(import.meta.env.VITE_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE, 0),
      beforeSend(event) {
        if (event.user) {
          delete event.user.email;
          delete event.user.username;
          delete event.user.ip_address;
        }

        return event;
      },
    });

    return sentry;
  } catch (error) {
    console.warn("Không bật được Sentry.", error);
    return null;
  }
}

function cleanParams(params: MonitoringParams) {
  return Object.entries(params).reduce<Record<string, string | number | boolean | null>>(
    (result, [key, value]) => {
      const cleanKey = key.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 40);

      if (!cleanKey) {
        return result;
      }

      if (typeof value === "string") {
        result[cleanKey] = value.slice(0, 100);
      } else if (typeof value === "number" || typeof value === "boolean" || value === null) {
        result[cleanKey] = value;
      }

      return result;
    },
    {},
  );
}

function toError(error: unknown) {
  if (error instanceof Error) {
    return error;
  }

  return new Error(typeof error === "string" ? error : JSON.stringify(error));
}

function parseSampleRate(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) {
    return parsed;
  }

  return fallback;
}

function appEnvironment() {
  return import.meta.env.VITE_APP_ENV || import.meta.env.MODE || "production";
}

function isMonitoringDisabled() {
  return String(import.meta.env.VITE_MONITORING_DISABLED || "").toLowerCase() === "true";
}
