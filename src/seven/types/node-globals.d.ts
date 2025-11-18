/**
 * Node.js global type declarations for Seven
 */

declare module 'fs' {
  export function existsSync(path: string): boolean;
  export function readFileSync(path: string, encoding: string): string;
  export function writeFileSync(path: string, data: string, encoding: string): void;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void;
}

declare module 'path' {
  export function dirname(path: string): string;
  export function join(...paths: string[]): string;
}

declare global {
  const console: {
    log(...args: any[]): void;
    error(...args: any[]): void;
    warn(...args: any[]): void;
    info(...args: any[]): void;
  };

  const process: {
    argv: string[];
    env: Record<string, string | undefined>;
  };

  interface ImportMeta {
    url: string;
  }

  namespace NodeJS {
    interface ProcessEnv {
      SEVEN_MODE?: string;
      SEVEN_AUTO_MODE?: string;
    }
  }
}

export {};
