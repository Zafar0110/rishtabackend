import crypto from "node:crypto";

// Newer mongoose/MongoDB-driver versions expect the global Web Crypto API
// (globalThis.crypto), which Node only exposes without a flag on newer
// versions. Older/managed hosting runtimes (e.g. some cPanel Node.js
// Selector versions) don't have it, causing "crypto is not defined" on any
// DB operation. Must be imported first, before mongoose, in every entry file.
if (typeof globalThis.crypto === "undefined") {
  globalThis.crypto = crypto.webcrypto;
}
