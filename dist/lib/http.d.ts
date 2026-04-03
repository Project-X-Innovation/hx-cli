import type { HxConfig } from "./config.js";
export declare function hxFetch(config: HxConfig, path: string, options?: {
    method?: string;
    body?: Record<string, unknown>;
    queryParams?: Record<string, string>;
}): Promise<unknown>;
