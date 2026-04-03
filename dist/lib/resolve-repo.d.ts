import type { HxConfig } from "./config.js";
type RepoInfo = {
    repositoryId: string;
    displayName: string;
    types: string[];
};
export declare function listRepos(config: HxConfig): Promise<RepoInfo[]>;
export declare function resolveRepo(config: HxConfig, nameOrId: string): Promise<string>;
export {};
