import { getStoredApiUrl } from "./storage.js";

export class ApiError extends Error {
  constructor(message, code = "API_ERROR", details = null) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
  }
}

function buildUrl(action, params = {}) {
  const apiUrl = getStoredApiUrl().trim();
  const url = new URL(apiUrl);
  url.searchParams.set("action", action);

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    url.searchParams.set(key, value);
  });

  return url.toString();
}

async function parsePayload(response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new ApiError("La API no devolvio un JSON valido", "INVALID_JSON", {
      status: response.status,
      bodyPreview: text.slice(0, 220)
    });
  }
}

async function request(method, action, params = {}) {
  const init = {
    method,
    cache: "no-store",
    redirect: "follow"
  };

  let targetUrl = getStoredApiUrl().trim();

  if (method === "GET") {
    targetUrl = buildUrl(action, params);
  } else {
    init.headers = {
      // `text/plain` evita el preflight CORS comun en Apps Script.
      "Content-Type": "text/plain;charset=utf-8"
    };
    init.body = JSON.stringify({
      action,
      ...params
    });
  }

  let response;

  try {
    response = await fetch(targetUrl, init);
  } catch (error) {
    throw new ApiError("No fue posible conectar con la API", "NETWORK_ERROR", {
      reason: error.message
    });
  }

  const payload = await parsePayload(response);

  if (!payload.ok) {
    const apiError = payload.error || {};
    throw new ApiError(
      apiError.message || "La API devolvio un error",
      apiError.code || "API_ERROR",
      apiError.details || null
    );
  }

  return payload.data;
}

export function apiGet(action, params = {}) {
  return request("GET", action, params);
}

export function apiPost(action, params = {}) {
  return request("POST", action, params);
}
