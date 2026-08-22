import { apiRequest } from "./api";

import type { Strategy } from "../types";

export async function getStrategies(): Promise<Strategy[]> {
  return apiRequest<Strategy[]>("/strategies");
}