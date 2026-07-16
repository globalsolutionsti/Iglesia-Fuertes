import { APP_CONFIG } from "./config.js";

const buildKey = (suffix) => `${APP_CONFIG.storagePrefix}.${suffix}`;
const LEGACY_API_URL_KEY = buildKey("apiUrl");
const API_URL_OVERRIDE_KEY = buildKey("apiUrlOverride");
const API_URL_OVERRIDE_ENABLED_KEY = buildKey("apiUrlOverrideEnabled");

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(buildKey("user")) || "null");
  } catch (error) {
    return null;
  }
}

export function setStoredUser(user) {
  localStorage.setItem(buildKey("user"), JSON.stringify(user));
}

export function clearStoredUser() {
  localStorage.removeItem(buildKey("user"));
}

export function getStoredApiUrl() {
  if (hasStoredApiUrlOverride()) {
    return localStorage.getItem(API_URL_OVERRIDE_KEY) || APP_CONFIG.defaultApiUrl;
  }

  return APP_CONFIG.defaultApiUrl;
}

export function setStoredApiUrl(apiUrl) {
  localStorage.setItem(API_URL_OVERRIDE_KEY, apiUrl);
  localStorage.setItem(API_URL_OVERRIDE_ENABLED_KEY, "1");
  localStorage.removeItem(LEGACY_API_URL_KEY);
}

export function clearStoredApiUrl() {
  localStorage.removeItem(API_URL_OVERRIDE_KEY);
  localStorage.removeItem(API_URL_OVERRIDE_ENABLED_KEY);
  localStorage.removeItem(LEGACY_API_URL_KEY);
}

export function hasStoredApiUrlOverride() {
  return localStorage.getItem(API_URL_OVERRIDE_ENABLED_KEY) === "1"
    && Boolean(localStorage.getItem(API_URL_OVERRIDE_KEY));
}
