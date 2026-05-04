/**
 * Shared flag-parsing utilities for CLI commands.
 */

export function getFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

export function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

export function getPositionalArgs(args: string[], excludeFlags: string[]): string[] {
  const flagValues = new Set<string>();
  for (const flag of excludeFlags) {
    const val = getFlag(args, flag);
    if (val) flagValues.add(val);
  }
  return args.filter((a) => !a.startsWith("--") && !flagValues.has(a));
}

export function isHelpRequested(args: string[]): boolean {
  return args.includes("--help") || args.includes("-h");
}

export function requireFlag(args: string[], flag: string, errorMsg: string): string {
  const value = getFlag(args, flag);
  if (!value) {
    console.error(`Error: ${errorMsg}`);
    process.exit(1);
  }
  return value;
}
