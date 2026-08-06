/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare global {
  // Injected at build time by vite.config.ts (`define`).
  const __BUILD_ID__: string;

  interface Window {
    __ktExamActive?: boolean;
  }
}

export {};
