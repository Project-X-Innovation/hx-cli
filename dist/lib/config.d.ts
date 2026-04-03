export type HxConfig = {
    apiKey: string;
    url: string;
};
export declare function loadConfig(): HxConfig | null;
export declare function saveConfig(config: HxConfig): void;
export declare function requireConfig(): HxConfig;
