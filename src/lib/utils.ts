import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function parseJsonResponse<T = unknown>(response: Response): Promise<T> {
  const body = await response.text();
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(`Expected JSON response but got ${contentType || "unknown"}: ${body.slice(0, 300)}`);
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error(`Unable to parse JSON response: ${body.slice(0, 300)}`);
  }
}

export async function parseResponseError(response: Response): Promise<string> {
  const body = await response.text();
  try {
    const json = JSON.parse(body);
    return json.error || json.message || JSON.stringify(json);
  } catch {
    return body;
  }
}
