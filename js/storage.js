import { APP_CONFIG } from "./config.js";

const buildKey = (suffix) => `${APP_CONFIG.storagePrefix}.${suffix}`;

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
  return localStorage.getItem(buildKey("apiUrl")) || APP_CONFIG.defaultApiUrl;
}

export function setStoredApiUrl(apiUrl) {
  localStorage.setItem(buildKey("apiUrl"), apiUrl);
}
