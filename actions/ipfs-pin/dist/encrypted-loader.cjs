"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// actions/ipfs-pin/src/encrypted-loader.ts
var import_promises3 = require("node:fs/promises");
var import_node_path4 = __toESM(require("node:path"), 1);

// node_modules/.pnpm/@proof-computer+liskov-runtime@https+++codeload.github.com+proof-computer+liskov-runtim_f15215979215515ddd7379bdd6f54a67/node_modules/@proof-computer/liskov-runtime/dist/acurast.js
var import_node_buffer2 = require("node:buffer");

// node_modules/.pnpm/@proof-computer+liskov-runtime@https+++codeload.github.com+proof-computer+liskov-runtim_f15215979215515ddd7379bdd6f54a67/node_modules/@proof-computer/liskov-runtime/dist/env.js
function resolveRuntimeStd(std) {
  return std ?? globalThis._STD_;
}
function getRuntimeEnvValue(name, options = {}) {
  const processValue = (options.env ?? process.env)[name];
  if (typeof processValue === "string" && processValue.length > 0)
    return processValue;
  const stdValue = resolveRuntimeStd(options.std)?.env?.[name];
  if (typeof stdValue === "string" && stdValue.length > 0)
    return stdValue;
  const environment = options.environment ?? globalThis.environment;
  if (typeof environment === "function") {
    const value = environment(name);
    if (typeof value === "string" && value.length > 0)
      return value;
    if (value !== void 0 && value !== null && typeof value !== "object")
      return String(value);
  }
  return void 0;
}
function requiredRuntimeEnvValue(name, options = {}) {
  const value = getRuntimeEnvValue(name, options);
  if (!value)
    throw new Error(`${name} is required`);
  return value;
}
function getFirstRuntimeEnvValue(names, options = {}) {
  for (const name of names) {
    const value = getRuntimeEnvValue(name, options);
    if (value !== void 0)
      return value;
  }
  return void 0;
}
function optionalBooleanEnv(name, options = {}) {
  const value = getRuntimeEnvValue(name, options);
  if (value === void 0)
    return void 0;
  if (value === "1" || value.toLowerCase() === "true")
    return true;
  if (value === "0" || value.toLowerCase() === "false")
    return false;
  return void 0;
}
function optionalIntegerEnv(name, options = {}) {
  const value = getRuntimeEnvValue(name, options);
  if (value === void 0)
    return void 0;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : void 0;
}
function optionalNonNegativeIntegerEnv(name, options = {}) {
  const value = getRuntimeEnvValue(name, options);
  if (value === void 0)
    return void 0;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : void 0;
}

// node_modules/.pnpm/@proof-computer+liskov-runtime@https+++codeload.github.com+proof-computer+liskov-runtim_f15215979215515ddd7379bdd6f54a67/node_modules/@proof-computer/liskov-runtime/dist/shared.js
var import_node_buffer = require("node:buffer");
var import_node_crypto = require("node:crypto");
function canonicalJson(value) {
  return JSON.stringify(sortJson(value));
}
function sortJson(value) {
  if (value === null || value === void 0)
    return value;
  if (typeof value === "bigint")
    return value.toString();
  if (typeof value !== "object")
    return value;
  if (Array.isArray(value))
    return value.map(sortJson);
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== void 0).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, sortJson(item)]));
}
function parseJson(raw, label = "JSON") {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${label} could not be parsed: ${safeErrorMessage(error)}`);
  }
}
function asRecord(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}
function recordOrUndefined(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
function requiredString(record, field) {
  const value = record[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}
function optionalString(record, field) {
  const value = record[field];
  return typeof value === "string" && value.length > 0 ? value : void 0;
}
function requiredStringAlias(record, ...fields) {
  for (const field of fields) {
    const value = optionalString(record, field);
    if (value !== void 0)
      return value;
  }
  throw new Error(`${fields.join(" or ")} is required`);
}
function requiredBoolean(record, field) {
  const value = record[field];
  if (typeof value !== "boolean")
    throw new Error(`${field} must be a boolean`);
  return value;
}
function optionalBoolean(record, field) {
  const value = record[field];
  return typeof value === "boolean" ? value : void 0;
}
function requiredNumber(record, field) {
  const value = record[field];
  if (!Number.isSafeInteger(value))
    throw new Error(`${field} must be a safe integer`);
  return Number(value);
}
function integerTimestamp(value, field) {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new Error(`${field} must be a non-negative safe integer`);
  }
  return Number(value);
}
function requireNonEmpty(value, label) {
  if (typeof value !== "string" || value.length === 0)
    throw new Error(`${label} is required`);
  return value;
}
function normalizePolicyDigest(value) {
  const digest2 = stripDigestPrefix(requireNonEmpty(value, "policyDigest").trim().toLowerCase());
  if (!/^[0-9a-f]{64}$/u.test(digest2))
    throw new Error("policyDigest must be a SHA-256 hex digest");
  return digest2;
}
function normalizeRequestedSecretIds(values) {
  const normalized = [...new Set(values.map((value) => requireNonEmpty(value, "requestedSecretIds[]").trim()))].filter(Boolean).sort((left, right) => left.localeCompare(right));
  if (normalized.length === 0)
    throw new Error("requestedSecretIds must not be empty");
  return normalized;
}
function parseStringArrayOrCsv(value, label) {
  if (Array.isArray(value))
    return normalizeRequestedSecretIds(value.map((item) => String(item)));
  if (typeof value !== "string" || value.length === 0)
    throw new Error(`${label} is required`);
  const trimmed = value.trim();
  if (trimmed.startsWith("[")) {
    const parsed = parseJson(trimmed, label);
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) {
      throw new Error(`${label} JSON must be a string array`);
    }
    return normalizeRequestedSecretIds(parsed);
  }
  return normalizeRequestedSecretIds(trimmed.split(",").map((item) => item.trim()).filter(Boolean));
}
function stringRecord(record, label) {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => {
    if (typeof value !== "string")
      throw new Error(`${label}.${key} must be a string`);
    return [key, value];
  }));
}
function normalizeHex(value) {
  const hex = stripHexPrefix(value).toLowerCase();
  if (!/^[0-9a-f]+$/u.test(hex))
    throw new Error("expected a hex string");
  return `0x${hex}`;
}
function normalizeHexNoPrefix(value) {
  const hex = stripHexPrefix(value).toLowerCase();
  if (!/^[0-9a-f]+$/u.test(hex))
    throw new Error("expected a hex string");
  return hex;
}
function stripHexPrefix(value) {
  return value.startsWith("0x") ? value.slice(2) : value;
}
function stripDigestPrefix(value) {
  return value.startsWith("sha256:") ? value.slice("sha256:".length) : value;
}
function sha256Hex(value) {
  return (0, import_node_crypto.createHash)("sha256").update(value).digest("hex");
}
function sha256Digest(value) {
  return `sha256:${sha256Hex(value)}`;
}
function digestMatches(value, digest2) {
  const expected = stripDigestPrefix(digest2.toLowerCase());
  return /^[0-9a-f]{64}$/u.test(expected) && sha256Hex(value) === expected;
}
function randomHex(bytes = 16, randomBytes3 = import_node_crypto.randomBytes) {
  return import_node_buffer.Buffer.from(randomBytes3(bytes)).toString("hex");
}
function safeErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
function assertSecureRuntimeUrl(url, allowInsecureHttp, label) {
  if (url.protocol === "https:")
    return;
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  if (local || allowInsecureHttp === true)
    return;
  throw new Error(`${label} must use HTTPS outside explicit local/test opt-in`);
}
function validEnvName(name) {
  const value = requireNonEmpty(name, "env name");
  if (!/^[A-Z_][A-Z0-9_]*$/u.test(value))
    throw new Error(`Invalid env name ${value}`);
  return value;
}

// node_modules/.pnpm/@proof-computer+liskov-runtime@https+++codeload.github.com+proof-computer+liskov-runtim_f15215979215515ddd7379bdd6f54a67/node_modules/@proof-computer/liskov-runtime/dist/acurast.js
var DEFAULT_JOB_ID_ENV_NAMES = [
  "ACURAST_JOB_ID",
  "PROOF_ACURAST_JOB_ID",
  "SWITCHBOARD_MANAGED_JOB_ID"
];
var DEFAULT_PROCESSOR_ID_ENV_NAMES = [
  "ACURAST_PROCESSOR_ID",
  "ACURAST_PROCESSOR_ADDRESS",
  "PROOF_ACURAST_PROCESSOR_ID",
  "SWITCHBOARD_MANAGED_PROCESSOR_ID"
];
var DEFAULT_ENCRYPTION_KEY_ENV_NAMES = [
  "ACURAST_ENCRYPTION_PUBLIC_KEY",
  "PROOF_ACURAST_ENCRYPTION_PUBLIC_KEY",
  "SWITCHBOARD_MANAGED_ENCRYPTION_PUBLIC_KEY"
];
var P256_ENCRYPTION_KEY_PRIME_PUBLIC_KEY = "036b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296";
function createAcurastRuntimeAdapter(options = {}) {
  return {
    async resolveIdentity(resolveOptions) {
      return resolveAcurastRuntimeIdentityAsync(options, resolveOptions);
    },
    async sign(message) {
      return signAcurastRuntimeMessage(options, message);
    },
    async decryptGrantPayload(encrypted) {
      return decryptAcurastRuntimePayload(options, encrypted);
    }
  };
}
async function resolveAcurastRuntimeIdentityAsync(options = {}, resolveOptions = {}) {
  const std = resolveRuntimeStd(options.std);
  if (resolveOptions.requireEncryptionKey === true) {
    await primeAcurastEncryptionKeys(std);
  }
  return resolveAcurastRuntimeIdentityFromStd(std, options, resolveOptions);
}
function resolveAcurastRuntimeIdentityFromStd(std, options, resolveOptions) {
  const jobId = getFirstRuntimeEnvValue(options.jobIdEnvNames ?? DEFAULT_JOB_ID_ENV_NAMES, options) ?? stringifyRuntimeValue(std?.job?.getId?.());
  const processorId = getFirstRuntimeEnvValue(options.processorIdEnvNames ?? DEFAULT_PROCESSOR_ID_ENV_NAMES, options) ?? stringifyRuntimeValue(std?.device?.getAddress?.());
  if (!jobId)
    throw new Error("Acurast job id is required for Slipway runtime bootstrap");
  if (!processorId)
    throw new Error("Acurast processor id is required for Slipway runtime bootstrap");
  const identity = { jobId, processorId };
  if (resolveOptions.requireEncryptionKey === true) {
    const responseEncryptionKey = getFirstRuntimeEnvValue(options.encryptionKeyEnvNames ?? DEFAULT_ENCRYPTION_KEY_ENV_NAMES, options) ?? encryptionKeyFromStd(std);
    if (!responseEncryptionKey) {
      throw new Error("Acurast response encryption key is required for Lockbox bootstrap");
    }
    identity.responseEncryptionKey = normalizeHexNoPrefix(responseEncryptionKey);
  }
  return identity;
}
async function primeAcurastEncryptionKeys(std = resolveRuntimeStd()) {
  const encrypt = std?.signers?.secp256r1?.encrypt;
  if (typeof encrypt !== "function")
    return { attempted: false, ok: false };
  try {
    await Promise.resolve(encrypt.call(std?.signers?.secp256r1, P256_ENCRYPTION_KEY_PRIME_PUBLIC_KEY, "00", "00"));
    return { attempted: true, ok: true };
  } catch (error) {
    return { attempted: true, ok: false, errorMessage: error instanceof Error ? error.message : String(error) };
  }
}
async function signAcurastRuntimeMessage(options = {}, message) {
  const std = resolveRuntimeStd(options.std);
  const sign = std?.signers?.ed25519?.sign;
  if (typeof sign !== "function")
    throw new Error("Acurast Ed25519 signer is required for Slipway runtime bootstrap");
  const signature = await Promise.resolve(sign.call(std?.signers?.ed25519, import_node_buffer2.Buffer.from(message).toString("hex")));
  return normalizeHex(signature);
}
async function decryptAcurastRuntimePayload(options = {}, encrypted) {
  const std = resolveRuntimeStd(options.std);
  const decrypt = std?.signers?.secp256r1?.decrypt;
  if (typeof decrypt !== "function")
    throw new Error("Acurast secp256r1 decrypt is required for Lockbox bootstrap");
  const plaintextHex = await Promise.resolve(decrypt.call(std?.signers?.secp256r1, encrypted.senderPublicKey, encrypted.saltHex, encrypted.ciphertextHex));
  return import_node_buffer2.Buffer.from(stripHexPrefix(normalizeHex(plaintextHex)), "hex");
}
function encryptionKeyFromStd(std) {
  const keys = safeCall(() => std?.job?.getEncryptionKeys?.());
  if (!keys)
    return void 0;
  const parsed = typeof keys === "string" ? parseJsonOrUndefined(keys) : keys;
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))
    return void 0;
  for (const name of ["p256", "secp256r1", "secp256r1Encryption", "encP256"]) {
    const value = parsed[name];
    if (typeof value === "string" && value.length > 0)
      return value;
    if (value instanceof Uint8Array)
      return import_node_buffer2.Buffer.from(value).toString("hex");
    if (Array.isArray(value) && value.every((item) => Number.isInteger(item) && item >= 0 && item <= 255)) {
      return import_node_buffer2.Buffer.from(value).toString("hex");
    }
  }
  return void 0;
}
function stringifyRuntimeValue(value) {
  if (typeof value === "string" && value.length > 0)
    return value;
  if (value === void 0 || value === null)
    return void 0;
  return JSON.stringify(value);
}
function parseJsonOrUndefined(value) {
  try {
    return JSON.parse(value);
  } catch {
    return void 0;
  }
}
function safeCall(fn) {
  try {
    const value = fn();
    return value === null || value === void 0 ? void 0 : value;
  } catch {
    return void 0;
  }
}

// node_modules/.pnpm/@proof-computer+liskov-runtime@https+++codeload.github.com+proof-computer+liskov-runtim_f15215979215515ddd7379bdd6f54a67/node_modules/@proof-computer/liskov-runtime/dist/blackbox-logger.js
var import_node_buffer3 = require("node:buffer");
var import_node_crypto3 = require("node:crypto");

// node_modules/.pnpm/@proof-computer+liskov-runtime@https+++codeload.github.com+proof-computer+liskov-runtim_f15215979215515ddd7379bdd6f54a67/node_modules/@proof-computer/liskov-runtime/dist/home.js
var import_node_path = __toESM(require("node:path"), 1);
var SLIPWAY_HOME_ENV_NAME = "SLIPWAY_HOME";
var DEFAULT_SLIPWAY_HOME_DIRNAME = ".slipway";
var FALLBACK_SLIPWAY_HOME = "/tmp/slipway";
function resolveSlipwayHome(options = {}) {
  const env = options.env ?? process.env;
  const raw = firstNonEmpty(options.home, env[SLIPWAY_HOME_ENV_NAME]);
  if (raw !== void 0)
    return expandHome(raw, env);
  const homeDir = firstNonEmpty(env.HOME, env.USERPROFILE);
  return homeDir ? import_node_path.default.join(homeDir, DEFAULT_SLIPWAY_HOME_DIRNAME) : FALLBACK_SLIPWAY_HOME;
}
function expandHome(value, env) {
  if (value === "~" || value.startsWith("~/") || value.startsWith("~\\")) {
    const homeDir = firstNonEmpty(env.HOME, env.USERPROFILE);
    if (!homeDir)
      return value;
    if (value === "~")
      return homeDir;
    return import_node_path.default.join(homeDir, value.slice(2));
  }
  return value;
}
function firstNonEmpty(...values) {
  return values.find((value) => typeof value === "string" && value.length > 0);
}

// node_modules/.pnpm/@proof-computer+liskov-runtime@https+++codeload.github.com+proof-computer+liskov-runtim_f15215979215515ddd7379bdd6f54a67/node_modules/@proof-computer/liskov-runtime/dist/blackbox-spool-internal.js
var testModules;
async function loadDiskSpoolModules() {
  if (testModules)
    return testModules;
  const [fs, path5] = await Promise.all([import("node:fs/promises"), import("node:path")]);
  return { fs, path: path5.default ?? path5 };
}

// node_modules/.pnpm/@proof-computer+liskov-runtime@https+++codeload.github.com+proof-computer+liskov-runtim_f15215979215515ddd7379bdd6f54a67/node_modules/@proof-computer/liskov-runtime/dist/proof-log-crypto.js
var import_node_crypto2 = require("node:crypto");
function encryptProofLogRecord(key, value) {
  const iv = (0, import_node_crypto2.randomBytes)(12);
  const cipher = (0, import_node_crypto2.createCipheriv)("aes-256-gcm", decodeProofLogKey(key), iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: 1,
    alg: "A256GCM",
    iv: base64UrlEncode(iv),
    ciphertext: base64UrlEncode(ciphertext),
    tag: base64UrlEncode(tag)
  };
}
function decodeProofLogKey(key) {
  const decoded = base64UrlDecode(key);
  if (decoded.length !== 32)
    throw new Error("Proof log encryption key must decode to 32 bytes");
  return decoded;
}
function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64url");
}
function base64UrlDecode(value) {
  if (!/^[A-Za-z0-9_-]+$/u.test(value))
    throw new Error("Expected base64url value");
  return Buffer.from(value, "base64url");
}

// node_modules/.pnpm/@proof-computer+liskov-runtime@https+++codeload.github.com+proof-computer+liskov-runtim_f15215979215515ddd7379bdd6f54a67/node_modules/@proof-computer/liskov-runtime/dist/blackbox-logger.js
var BLACKBOX_LOG_ENV_NAMES = [
  "BLACKBOX_LOG_CONFIG",
  "BLACKBOX_SINK_ID",
  "BLACKBOX_JOB_ID",
  "BLACKBOX_WRITE_URL",
  "BLACKBOX_RESUME_URL",
  "BLACKBOX_LOG_DEK",
  "BLACKBOX_LOG_CONTEXT",
  "BLACKBOX_LOG_TIMEOUT_MS",
  // Factory-token self-registration variant (P1.3).
  "BLACKBOX_FACTORY_TOKEN",
  "BLACKBOX_FACTORY_ID",
  "BLACKBOX_BASE_URL",
  "BLACKBOX_SPOOL_DIR",
  "BLACKBOX_NETWORK",
  "BLACKBOX_APPLICATION_ID",
  "BLACKBOX_DEPLOYMENT_ID"
];
var BLACKBOX_RUNTIME_LOG_CONFIG_DOMAIN_V2 = "proof.liskov.blackbox-log-config.v2";
var SPOOL_STATE_FILE = "state.json";
var SPOOL_RECORD_FORMAT = "blackbox-spool-record-v1";
var SPOOL_BATCH_FORMAT = "blackbox-spool-batch-v1";
var SPOOL_STATE_FORMAT = "blackbox-spool-state-v1";
var DEFAULT_TIMEOUT_MS = 5e3;
var DEFAULT_BATCH_MAX_RECORDS = 50;
var DEFAULT_BATCH_MAX_BYTES = 256 * 1024;
var DEFAULT_MAX_SPOOL_BYTES = 10 * 1024 * 1024;
var MAX_SEQUENCE_REBASE_ATTEMPTS = 3;
var BLACKBOX_WRITER_KEY_DERIVATION = "hkdf-sha256-ed25519-v1";
var BLACKBOX_WRITER_KEY_DERIVATION_SALT = "proof.liskov.blackbox.writer-key.v1";
var BLACKBOX_WRITER_KEY_DERIVATION_INFO = "Ed25519";
var ED25519_PKCS8_SEED_PREFIX = import_node_buffer3.Buffer.from("302e020100300506032b657004220420", "hex");
var ED25519_SPKI_PREFIX = import_node_buffer3.Buffer.from("302a300506032b6570032100", "hex");
function readBlackboxLogConfig(getConfigValue = defaultConfigValue) {
  const compact = getConfigValue("BLACKBOX_LOG_CONFIG");
  if (compact) {
    const parsed = parseBlackboxLogConfigPayload(compact);
    return normalizeBlackboxLogConfig({
      domain: stringField(parsed, "domain") ?? stringField(parsed, "d"),
      sinkId: stringField(parsed, "sinkId") ?? stringField(parsed, "sid"),
      jobId: stringField(parsed, "jobId") ?? stringField(parsed, "jid") ?? stringField(parsed, "job"),
      writeUrl: stringField(parsed, "writeUrl") ?? stringField(parsed, "url"),
      resumeUrl: stringField(parsed, "resumeUrl"),
      dek: stringField(parsed, "dek") ?? stringField(parsed, "k") ?? stringField(parsed, "logDek"),
      writerKeyDerivation: stringField(parsed, "writerKeyDerivation") ?? stringField(parsed, "wkd"),
      factoryToken: stringField(parsed, "factoryToken") ?? stringField(parsed, "ft"),
      factoryId: stringField(parsed, "factoryId") ?? stringField(parsed, "fid"),
      baseUrl: stringField(parsed, "baseUrl") ?? stringField(parsed, "base"),
      spoolDir: stringField(parsed, "spoolDir") ?? stringField(parsed, "spool"),
      network: stringField(parsed, "network") ?? stringField(parsed, "net"),
      applicationUid: stringField(parsed, "applicationUid") ?? stringField(parsed, "uid"),
      applicationId: stringField(parsed, "applicationId") ?? stringField(parsed, "app"),
      deploymentId: stringField(parsed, "deploymentId") ?? stringField(parsed, "dep"),
      context: contextField(parsed.context ?? parsed.ctx),
      timeoutMs: numberField(parsed, "timeoutMs") ?? numberField(parsed, "flushTimeoutMs")
    });
  }
  const explicit = {
    sinkId: getConfigValue("BLACKBOX_SINK_ID"),
    jobId: getConfigValue("BLACKBOX_JOB_ID"),
    writeUrl: getConfigValue("BLACKBOX_WRITE_URL"),
    resumeUrl: getConfigValue("BLACKBOX_RESUME_URL"),
    dek: getConfigValue("BLACKBOX_LOG_DEK"),
    factoryToken: getConfigValue("BLACKBOX_FACTORY_TOKEN"),
    factoryId: getConfigValue("BLACKBOX_FACTORY_ID"),
    baseUrl: getConfigValue("BLACKBOX_BASE_URL"),
    spoolDir: getConfigValue("BLACKBOX_SPOOL_DIR"),
    network: getConfigValue("BLACKBOX_NETWORK"),
    applicationId: getConfigValue("BLACKBOX_APPLICATION_ID"),
    deploymentId: getConfigValue("BLACKBOX_DEPLOYMENT_ID"),
    context: getConfigValue("BLACKBOX_LOG_CONTEXT"),
    timeoutMs: numberFromString(getConfigValue("BLACKBOX_LOG_TIMEOUT_MS"))
  };
  if (!explicit.sinkId && !explicit.jobId && !explicit.writeUrl && !explicit.dek && !explicit.factoryToken && !explicit.factoryId && !explicit.baseUrl) {
    return void 0;
  }
  return normalizeBlackboxLogConfig(explicit);
}
function blackboxLogHostnames(getConfigValue) {
  try {
    const config = readBlackboxLogConfig(getConfigValue);
    if (!config)
      return [];
    const hostnames = /* @__PURE__ */ new Set();
    if (config.writeUrl)
      hostnames.add(new URL(config.writeUrl).hostname);
    if (config.resumeUrl)
      hostnames.add(new URL(config.resumeUrl).hostname);
    if (config.baseUrl)
      hostnames.add(new URL(config.baseUrl).hostname);
    return [...hostnames];
  } catch {
    return [];
  }
}
function blackboxLogConfigFingerprint(getConfigValue = defaultConfigValue) {
  const hasConfig = Boolean(getConfigValue("BLACKBOX_LOG_CONFIG")) || Boolean(getConfigValue("BLACKBOX_SINK_ID")) || Boolean(getConfigValue("BLACKBOX_JOB_ID")) || Boolean(getConfigValue("BLACKBOX_WRITE_URL")) || Boolean(getConfigValue("BLACKBOX_LOG_DEK")) || Boolean(getConfigValue("BLACKBOX_FACTORY_TOKEN")) || Boolean(getConfigValue("BLACKBOX_FACTORY_ID")) || Boolean(getConfigValue("BLACKBOX_BASE_URL"));
  if (!hasConfig)
    return void 0;
  const values = BLACKBOX_LOG_ENV_NAMES.map((name) => [name, getConfigValue(name) ?? null]).filter(([, value]) => value !== null);
  return `0x${sha256Digest(canonicalJson(values)).slice("sha256:".length)}`;
}
function createBlackboxRemoteLogger(options = {}) {
  const getConfigValue = options.getConfigValue ?? defaultConfigValue;
  let config;
  try {
    config = readBlackboxLogConfig(getConfigValue);
  } catch (error) {
    return async (event) => options.onError?.(error, event);
  }
  if (!config)
    return async () => void 0;
  let signer;
  try {
    signer = config.writerKeyDerivation === BLACKBOX_WRITER_KEY_DERIVATION || options.signer === void 0 ? deriveBlackboxRequestSigner(config.dek) : options.signer;
  } catch (error) {
    return async (event) => options.onError?.(error, event);
  }
  if (!signer) {
    return async (event) => {
      options.onError?.(new Error("Blackbox logging requires the Acurast Ed25519 runtime signer"), event);
    };
  }
  let writerPublicKey;
  try {
    writerPublicKey = normalizePublicKeyHex(signer.publicKeyHex);
  } catch (error) {
    return async (event) => options.onError?.(error, event);
  }
  const engine = new BlackboxSpoolEngine(config, {
    signer,
    writerPublicKey,
    fetchImpl: options.fetchImpl ?? fetch,
    timeoutMs: options.timeoutMs ?? config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    spoolMode: options.spoolMode ?? "auto",
    spoolDir: options.spoolDir ?? config.spoolDir,
    getConfigValue,
    std: resolveRuntimeStd(options.std),
    signedAt: options.signedAt,
    nonce: options.nonce,
    baseRecord: options.baseRecord,
    onError: options.onError
  });
  return (event, details = {}) => engine.log(event, details);
}
async function createBlackboxSignedJsonRequest(input) {
  const body = canonicalJson(input.body);
  const bodyBytes = import_node_buffer3.Buffer.from(body, "utf8");
  const signedAt = input.signedAt ?? (/* @__PURE__ */ new Date()).toISOString();
  const nonce = input.nonce ?? (0, import_node_crypto3.randomBytes)(16).toString("base64url");
  const signingMessage = [
    input.method.toUpperCase(),
    input.path,
    `0x${sha256Digest(bodyBytes).slice("sha256:".length)}`,
    signedAt,
    nonce
  ].join("\n");
  const signature = await input.signer.sign(import_node_buffer3.Buffer.from(signingMessage, "utf8"));
  const signatureBytes = typeof signature === "string" ? import_node_buffer3.Buffer.from(stripHexPrefix(signature), "hex") : import_node_buffer3.Buffer.from(signature);
  return {
    headers: {
      accept: "application/json",
      authorization: `${input.signer.scheme} ${normalizePublicKeyHex(input.signer.publicKeyHex)}:${signatureBytes.toString("base64")}`,
      "content-type": "application/json",
      "x-signed-at": signedAt,
      "x-nonce": nonce
    },
    body,
    signingMessage
  };
}
function deriveBlackboxRequestSigner(dek) {
  if (!/^[A-Za-z0-9_-]+$/u.test(dek)) {
    throw new Error("Blackbox log DEK must be a base64url value");
  }
  const inputKeyMaterial = import_node_buffer3.Buffer.from(dek, "base64url");
  if (inputKeyMaterial.length !== 32) {
    throw new Error("Blackbox log DEK must decode to 32 bytes");
  }
  const seed = import_node_buffer3.Buffer.from((0, import_node_crypto3.hkdfSync)("sha256", inputKeyMaterial, import_node_buffer3.Buffer.from(BLACKBOX_WRITER_KEY_DERIVATION_SALT, "utf8"), import_node_buffer3.Buffer.from(BLACKBOX_WRITER_KEY_DERIVATION_INFO, "utf8"), 32));
  const privateKey = (0, import_node_crypto3.createPrivateKey)({
    key: import_node_buffer3.Buffer.concat([ED25519_PKCS8_SEED_PREFIX, seed]),
    format: "der",
    type: "pkcs8"
  });
  const publicKeyDer = import_node_buffer3.Buffer.from((0, import_node_crypto3.createPublicKey)(privateKey).export({ format: "der", type: "spki" }));
  if (publicKeyDer.length !== ED25519_SPKI_PREFIX.length + 32 || !publicKeyDer.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)) {
    throw new Error("Unable to derive the Blackbox Ed25519 writer public key");
  }
  const publicKeyHex = publicKeyDer.subarray(ED25519_SPKI_PREFIX.length).toString("hex");
  return {
    scheme: "Ed25519",
    publicKeyHex,
    sign: (message) => (0, import_node_crypto3.sign)(null, import_node_buffer3.Buffer.from(message), privateKey)
  };
}
var BlackboxSpoolEngine = class {
  config;
  options;
  storage;
  openPromise;
  admissionQueue = Promise.resolve();
  flushWorker;
  flushRequested = 0;
  flushCompleted = 0;
  recordOrdinal = 0;
  state = { format: SPOOL_STATE_FORMAT, nextSequence: 1, previousHash: null };
  resolved;
  constructor(config, options) {
    this.config = config;
    this.options = options;
  }
  async log(event, details) {
    const recordOrdinal = this.recordOrdinal++;
    try {
      await this.ensureOpen();
      const record = {
        ...this.options.baseRecord?.(),
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        event,
        context: this.config.context,
        details
      };
      const spoolRecord = {
        format: SPOOL_RECORD_FORMAT,
        recordId: `${String(Date.now()).padStart(13, "0")}-${String(recordOrdinal).padStart(10, "0")}-${(0, import_node_crypto3.randomBytes)(8).toString("hex")}`,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        encrypted: encryptProofLogRecord(this.config.dek, record)
      };
      const bytes = import_node_buffer3.Buffer.byteLength(`${JSON.stringify(spoolRecord)}
`, "utf8");
      if (bytes > DEFAULT_BATCH_MAX_BYTES) {
        throw new Error("Blackbox spool rejected record: record_too_large");
      }
      await this.admit(async () => {
        if (await this.storage.sizeBytes() + bytes > DEFAULT_MAX_SPOOL_BYTES) {
          throw new Error("Blackbox spool rejected record: spool_full");
        }
        await this.storage.writeRecord(spoolRecord.recordId, spoolRecord);
      });
    } catch (error) {
      this.options.onError?.(error, event);
      return;
    }
    await this.flush(event);
  }
  async flush(triggerEvent) {
    const request = ++this.flushRequested;
    this.flushWorker ??= this.runFlushWorker(triggerEvent).finally(() => {
      this.flushWorker = void 0;
    });
    await this.flushWorker;
    if (this.flushCompleted < request) {
      await this.flush(triggerEvent);
    }
  }
  async runFlushWorker(triggerEvent) {
    while (this.flushCompleted < this.flushRequested) {
      const requested = this.flushRequested;
      await this.flushLoop(triggerEvent);
      this.flushCompleted = requested;
    }
  }
  async admit(operation) {
    const admitted = this.admissionQueue.then(operation, operation);
    this.admissionQueue = admitted.then(() => void 0, () => void 0);
    return admitted;
  }
  async flushLoop(triggerEvent) {
    let context;
    try {
      context = await this.resolveSinkContext();
    } catch (error) {
      this.options.onError?.(error, triggerEvent);
      return;
    }
    for (; ; ) {
      let batchFile;
      try {
        batchFile = await this.oldestPendingBatchFile() ?? await this.buildPendingBatch(context);
        if (!batchFile)
          return;
        await this.sendPendingBatch(batchFile, context);
      } catch (error) {
        this.options.onError?.(error, triggerEvent);
        return;
      }
    }
  }
  async ensureOpen() {
    this.openPromise ??= this.open();
    await this.openPromise;
  }
  async open() {
    this.storage = await resolveSpoolStorage(this.options.spoolMode, this.spoolDirOrDefault());
    await this.storage.init();
    this.state = await this.readChainState();
    const currentJobId = this.maybeCurrentJobId();
    const sinkChanged = this.state.sinkId !== void 0 && this.config.sinkId !== void 0 && this.state.sinkId !== this.config.sinkId;
    const jobChanged = this.state.jobId !== void 0 && currentJobId !== void 0 && this.state.jobId !== currentJobId;
    let pendingIdentityChanged = false;
    if (sinkChanged || jobChanged) {
      for (const file of await this.storage.batchFiles()) {
        await this.storage.removeBatch(file);
      }
    } else {
      for (const file of await this.storage.batchFiles()) {
        const pending = await this.storage.readBatch(file);
        if (!pending || pending.format !== SPOOL_BATCH_FORMAT)
          continue;
        const pendingSinkChanged = this.config.sinkId !== void 0 && pending.batch.sinkId !== this.config.sinkId;
        const pendingJobChanged = currentJobId !== void 0 && pending.batch.jobId !== currentJobId;
        if (pendingSinkChanged || pendingJobChanged) {
          await this.storage.removeBatch(file);
          pendingIdentityChanged = true;
        }
      }
    }
    if (sinkChanged || jobChanged || pendingIdentityChanged) {
      this.state = { format: SPOOL_STATE_FORMAT, nextSequence: 1, previousHash: null };
      await this.storage.writeState(this.state);
    }
    await this.cleanupClaimedRecordsForPendingBatches();
  }
  async resolveSinkContext() {
    if (this.resolved)
      return this.resolved;
    const jobId = this.requireCurrentJobId();
    let chain;
    if (this.config.sinkId && this.config.writeUrl) {
      this.resolved = {
        sinkId: this.config.sinkId,
        jobId,
        writeUrl: this.config.writeUrl,
        resumeUrl: this.requireResumeUrl(this.config.writeUrl)
      };
      chain = await this.resumeSink(this.resolved);
    } else if (this.state.sinkId) {
      this.resolved = {
        sinkId: this.state.sinkId,
        jobId,
        writeUrl: this.writeUrlFor(this.state.sinkId),
        resumeUrl: this.resumeUrlFor(this.state.sinkId)
      };
      chain = await this.resumeSink(this.resolved);
    } else {
      const registration = await this.selfRegisterSink(jobId);
      this.resolved = {
        sinkId: registration.sinkId,
        jobId,
        writeUrl: registration.writeUrl,
        resumeUrl: registration.resumeUrl
      };
      chain = registration;
    }
    this.state = {
      ...this.state,
      sinkId: this.resolved.sinkId,
      jobId,
      nextSequence: chain.nextSequence,
      previousHash: chain.previousHash
    };
    await this.storage.writeState(this.state);
    return this.resolved;
  }
  async resumeSink(context) {
    const target = new URL(context.resumeUrl);
    const body = {
      jobId: context.jobId,
      writerPublicKey: this.options.writerPublicKey
    };
    const signed = await createBlackboxSignedJsonRequest({
      signer: this.options.signer,
      method: "POST",
      path: `${target.pathname}${target.search}`,
      body,
      signedAt: this.options.signedAt?.(),
      nonce: this.options.nonce?.()
    });
    const response = await this.options.fetchImpl(target, {
      method: "POST",
      headers: signed.headers,
      body: signed.body,
      signal: AbortSignal.timeout(Math.max(1, this.options.timeoutMs))
    });
    const responseBody = (await response.text()).slice(0, 500);
    if (!response.ok) {
      throw new Error(`Blackbox sink resume failed: ${response.status} ${responseBody}`);
    }
    const payload = parseJsonResponse(responseBody, "Blackbox sink resume response");
    if (stringOrUndefined(payload.sinkId) !== context.sinkId) {
      throw new Error("Blackbox sink resume response resolved a different sink");
    }
    return chainFromPayload(payload.chain, "Blackbox sink resume response");
  }
  async selfRegisterSink(jobId, retryBodylessSuccess = true) {
    const factoryToken = this.config.factoryToken;
    if (!factoryToken) {
      throw new Error("Blackbox log config requires sinkId + jobId + writeUrl (pre-bound sink) or factoryToken + baseUrl (factory self-registration)");
    }
    const factoryId = this.config.factoryId ?? parseFactoryIdFromToken(factoryToken);
    if (!factoryId) {
      throw new Error("Blackbox factory logger requires a factoryId (or a parseable factory token)");
    }
    const url = `${this.requireBaseUrl()}/v1/sink-factories/${encodeURIComponent(factoryId)}/job-sinks`;
    const body = withoutUndefined({
      jobId,
      network: this.config.network,
      applicationUid: this.config.applicationUid,
      applicationId: this.config.applicationId,
      deploymentId: this.config.deploymentId
    });
    const target = new URL(url);
    const signed = await createBlackboxSignedJsonRequest({
      signer: this.options.signer,
      method: "POST",
      path: `${target.pathname}${target.search}`,
      body,
      signedAt: this.options.signedAt?.(),
      nonce: this.options.nonce?.()
    });
    const response = await this.options.fetchImpl(target, {
      method: "POST",
      headers: {
        ...signed.headers,
        "x-blackbox-sink-factory-token": factoryToken
      },
      body: signed.body,
      signal: AbortSignal.timeout(Math.max(1, this.options.timeoutMs))
    });
    const responseBody = (await response.text()).slice(0, 500);
    if (!response.ok) {
      throw new Error(`Blackbox sink self-register failed: ${response.status} ${responseBody}`);
    }
    let payload;
    try {
      payload = parseJsonResponse(responseBody, "Blackbox sink self-register response");
    } catch (error) {
      if (retryBodylessSuccess)
        return this.selfRegisterSink(jobId, false);
      throw error;
    }
    const registration = payload;
    const sinkId = stringOrUndefined(registration.sink?.sinkId) ?? stringOrUndefined(registration.sinkId);
    if (!sinkId) {
      throw new Error("Blackbox sink self-register response did not include a sinkId");
    }
    const writeUrl = stringOrUndefined(registration.sink?.writeUrl) ?? stringOrUndefined(registration.writeUrl) ?? this.writeUrlFor(sinkId);
    const resumeUrl = stringOrUndefined(registration.sink?.resumeUrl) ?? stringOrUndefined(registration.resumeUrl) ?? deriveResumeUrl(writeUrl);
    if (!resumeUrl) {
      throw new Error("Blackbox sink self-register response did not include a resumable sink URL");
    }
    validateHttpUrl(writeUrl, "Blackbox sink self-register writeUrl");
    validateHttpUrl(resumeUrl, "Blackbox sink self-register resumeUrl");
    const chain = chainFromPayload(registration.chain, "Blackbox sink self-register response");
    return {
      sinkId,
      writeUrl,
      resumeUrl,
      ...chain
    };
  }
  async buildPendingBatch(context) {
    const files = await this.storage.recordFiles();
    if (files.length === 0)
      return void 0;
    const selected = [];
    for (const file of files) {
      const record = await this.storage.readRecord(file);
      if (!record || record.format !== SPOOL_RECORD_FORMAT)
        continue;
      const candidate = [...selected, { file, record }];
      const candidateBatch = this.batchForRecords(context, candidate);
      if (candidate.length > 1 && import_node_buffer3.Buffer.byteLength(canonicalJson(candidateBatch), "utf8") > DEFAULT_BATCH_MAX_BYTES) {
        break;
      }
      selected.push({ file, record });
      if (selected.length >= DEFAULT_BATCH_MAX_RECORDS)
        break;
    }
    if (selected.length === 0)
      return void 0;
    const batchWithoutId = this.batchForRecords(context, selected);
    const batch = { ...batchWithoutId, batchId: logBatchId(batchWithoutId) };
    const batchFile = `${String(batch.sequenceStart).padStart(16, "0")}-${String(batch.sequenceEnd).padStart(16, "0")}-${batch.batchId.slice(2, 18)}.json`;
    await this.storage.writeBatch(batchFile, {
      format: SPOOL_BATCH_FORMAT,
      batch,
      recordFiles: selected.map((item) => item.file)
    });
    for (const item of selected) {
      await this.storage.removeRecord(item.file);
    }
    return batchFile;
  }
  batchForRecords(context, records) {
    const sequenceStart = this.state.nextSequence;
    return {
      sinkId: context.sinkId,
      jobId: context.jobId,
      writerPublicKey: this.options.writerPublicKey,
      sequenceStart,
      sequenceEnd: sequenceStart + records.length - 1,
      previousHash: this.state.previousHash,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      encrypted: records.map((item) => item.record.encrypted)
    };
  }
  async sendPendingBatch(file, context) {
    let spoolBatch = await this.storage.readBatch(file);
    if (!spoolBatch || spoolBatch.format !== SPOOL_BATCH_FORMAT) {
      await this.storage.removeBatch(file);
      return;
    }
    const url = new URL(context.writeUrl);
    for (let attempt = 0; ; attempt += 1) {
      const signed = await createBlackboxSignedJsonRequest({
        signer: this.options.signer,
        method: "POST",
        path: `${url.pathname}${url.search}`,
        body: spoolBatch.batch,
        signedAt: this.options.signedAt?.(),
        nonce: this.options.nonce?.()
      });
      const response = await this.options.fetchImpl(url, {
        method: "POST",
        headers: signed.headers,
        body: signed.body,
        signal: AbortSignal.timeout(Math.max(1, this.options.timeoutMs))
      });
      const responseBody = (await response.text()).slice(0, 500);
      if (response.ok) {
        let chain;
        try {
          const payload = parseJsonResponse(responseBody, "Blackbox log write response");
          chain = chainFromPayload(payload.chain, "Blackbox log write response");
        } catch {
          chain = await this.resumeSink(context);
        }
        if (chain.nextSequence <= spoolBatch.batch.sequenceEnd) {
          throw new Error("Blackbox log write response returned a chain behind the accepted batch");
        }
        this.state = {
          format: SPOOL_STATE_FORMAT,
          nextSequence: chain.nextSequence,
          previousHash: chain.previousHash,
          sinkId: spoolBatch.batch.sinkId,
          jobId: spoolBatch.batch.jobId
        };
        await this.storage.writeState(this.state);
        await this.storage.removeBatch(file);
        return;
      }
      if (response.status === 409 && responseErrorCode(responseBody) === "sequence_conflict" && attempt < MAX_SEQUENCE_REBASE_ATTEMPTS) {
        const payload = parseJsonResponse(responseBody, "Blackbox sequence conflict response");
        const chain = chainFromPayload(payload.chain, "Blackbox sequence conflict response");
        spoolBatch = await this.rebasePendingBatch(file, spoolBatch, chain);
        continue;
      }
      throw new Error(`Blackbox log write failed: ${response.status} ${responseBody}`);
    }
  }
  async rebasePendingBatch(file, spoolBatch, chain) {
    if (chain.nextSequence < spoolBatch.batch.sequenceStart || chain.nextSequence === spoolBatch.batch.sequenceStart && chain.previousHash === (spoolBatch.batch.previousHash ?? null)) {
      throw new Error("Blackbox sequence recovery did not advance the server chain head");
    }
    const { batchId: _batchId, ...existing } = spoolBatch.batch;
    const sequenceEnd = chain.nextSequence + spoolBatch.batch.encrypted.length - 1;
    if (!Number.isSafeInteger(sequenceEnd)) {
      throw new Error("Blackbox sequence recovery exceeded the safe integer range");
    }
    const withoutId = {
      ...existing,
      sequenceStart: chain.nextSequence,
      sequenceEnd,
      previousHash: chain.previousHash
    };
    const rebased = {
      ...spoolBatch,
      batch: { ...withoutId, batchId: logBatchId(withoutId) }
    };
    await this.storage.writeBatch(file, rebased);
    this.state = {
      ...this.state,
      sinkId: spoolBatch.batch.sinkId,
      jobId: spoolBatch.batch.jobId,
      nextSequence: chain.nextSequence,
      previousHash: chain.previousHash
    };
    await this.storage.writeState(this.state);
    return rebased;
  }
  async oldestPendingBatchFile() {
    return (await this.storage.batchFiles())[0];
  }
  async readChainState() {
    try {
      const state = await this.storage.readState();
      if (state && state.format === SPOOL_STATE_FORMAT && Number.isInteger(state.nextSequence) && state.nextSequence > 0) {
        return {
          format: SPOOL_STATE_FORMAT,
          nextSequence: state.nextSequence,
          previousHash: state.previousHash ?? null,
          sinkId: typeof state.sinkId === "string" ? state.sinkId : void 0,
          jobId: typeof state.jobId === "string" ? state.jobId : void 0
        };
      }
    } catch {
    }
    return { format: SPOOL_STATE_FORMAT, nextSequence: 1, previousHash: null };
  }
  async cleanupClaimedRecordsForPendingBatches() {
    for (const batchFile of await this.storage.batchFiles()) {
      const spoolBatch = await this.storage.readBatch(batchFile);
      for (const recordFile of spoolBatch?.recordFiles ?? []) {
        await this.storage.removeRecord(recordFile);
      }
    }
  }
  requireCurrentJobId() {
    const jobId = this.maybeCurrentJobId();
    if (!jobId) {
      throw new Error("Blackbox factory logger requires the Acurast job id (env or _STD_.job.getId)");
    }
    return jobId;
  }
  maybeCurrentJobId() {
    if (this.config.jobId)
      return this.config.jobId;
    for (const name of DEFAULT_JOB_ID_ENV_NAMES) {
      const value = this.options.getConfigValue(name);
      if (value)
        return value;
    }
    return stringifyRuntimeValue2(this.options.std?.job?.getId?.());
  }
  writeUrlFor(sinkId) {
    if (this.config.writeUrl && this.config.sinkId === sinkId)
      return this.config.writeUrl;
    return `${this.requireBaseUrl()}/v1/sinks/${encodeURIComponent(sinkId)}/events`;
  }
  resumeUrlFor(sinkId) {
    if (this.config.resumeUrl && this.config.sinkId === sinkId)
      return this.config.resumeUrl;
    const derived = deriveResumeUrl(this.writeUrlFor(sinkId));
    if (!derived) {
      throw new Error("Blackbox log config requires resumeUrl when writeUrl does not end in /events");
    }
    return derived;
  }
  requireResumeUrl(writeUrl) {
    const resumeUrl = this.config.resumeUrl ?? deriveResumeUrl(writeUrl);
    if (!resumeUrl) {
      throw new Error("Blackbox pre-bound log config requires resumeUrl when writeUrl does not end in /events");
    }
    return resumeUrl;
  }
  requireBaseUrl() {
    if (!this.config.baseUrl) {
      throw new Error("Blackbox factory logger requires a baseUrl to derive its sink URLs");
    }
    return this.config.baseUrl.replace(/\/+$/, "");
  }
  spoolDirOrDefault() {
    if (this.options.spoolDir)
      return this.options.spoolDir;
    const seed = this.config.factoryId ?? parseFactoryIdFromToken(this.config.factoryToken ?? "") ?? this.config.sinkId ?? "sink";
    const jobId = this.maybeCurrentJobId();
    return defaultBlackboxSpoolDir(jobId ? `${seed}-${jobId}` : seed);
  }
};
async function resolveSpoolStorage(mode, spoolDir) {
  if (mode === "memory")
    return new MemorySpoolStorage();
  let disk;
  try {
    disk = new DiskSpoolStorage(spoolDir, await loadDiskSpoolModules());
  } catch (error) {
    if (mode === "disk")
      throw error;
    return new MemorySpoolStorage();
  }
  if (mode === "disk")
    return disk;
  try {
    await disk.probe();
    return disk;
  } catch {
    return new MemorySpoolStorage();
  }
}
var DiskSpoolStorage = class {
  spoolDir;
  modules;
  mode = "disk";
  recordsDir;
  batchesDir;
  stateFile;
  constructor(spoolDir, modules) {
    this.spoolDir = spoolDir;
    this.modules = modules;
    this.recordsDir = modules.path.join(spoolDir, "records");
    this.batchesDir = modules.path.join(spoolDir, "batches");
    this.stateFile = modules.path.join(spoolDir, SPOOL_STATE_FILE);
  }
  async probe() {
    const { fs, path: path5 } = this.modules;
    await fs.mkdir(this.spoolDir, { recursive: true });
    const marker = path5.join(this.spoolDir, `.blackbox-spool-probe-${(0, import_node_crypto3.randomBytes)(6).toString("hex")}`);
    try {
      await fs.writeFile(marker, "ok", "utf8");
    } finally {
      await fs.rm(marker, { force: true });
    }
  }
  async init() {
    await this.modules.fs.mkdir(this.recordsDir, { recursive: true });
    await this.modules.fs.mkdir(this.batchesDir, { recursive: true });
  }
  async readState() {
    return this.readJson(this.stateFile);
  }
  async writeState(state) {
    await this.writeJsonAtomic(this.stateFile, state);
  }
  recordFiles() {
    return this.sortedJsonFiles(this.recordsDir);
  }
  readRecord(file) {
    return this.readJson(this.modules.path.join(this.recordsDir, file));
  }
  async writeRecord(recordId, record) {
    await this.writeJsonAtomic(this.modules.path.join(this.recordsDir, `${recordId}.json`), record);
  }
  async removeRecord(file) {
    await this.modules.fs.rm(this.modules.path.join(this.recordsDir, file), { force: true });
  }
  batchFiles() {
    return this.sortedJsonFiles(this.batchesDir);
  }
  readBatch(file) {
    return this.readJson(this.modules.path.join(this.batchesDir, file));
  }
  async writeBatch(file, batch) {
    await this.writeJsonAtomic(this.modules.path.join(this.batchesDir, file), batch);
  }
  async removeBatch(file) {
    await this.modules.fs.rm(this.modules.path.join(this.batchesDir, file), { force: true });
  }
  async sizeBytes() {
    return await this.directorySize(this.recordsDir) + await this.directorySize(this.batchesDir);
  }
  async sortedJsonFiles(dir) {
    try {
      return (await this.modules.fs.readdir(dir)).filter((name) => name.endsWith(".json")).sort();
    } catch (error) {
      if (isNotFound(error))
        return [];
      throw error;
    }
  }
  async readJson(file) {
    try {
      return JSON.parse(await this.modules.fs.readFile(file, "utf8"));
    } catch (error) {
      if (isNotFound(error))
        return void 0;
      throw error;
    }
  }
  async writeJsonAtomic(file, value) {
    const { fs, path: path5 } = this.modules;
    await fs.mkdir(path5.dirname(file), { recursive: true });
    const tmp = `${file}.${(0, import_node_crypto3.randomBytes)(6).toString("hex")}.tmp`;
    try {
      await fs.writeFile(tmp, `${JSON.stringify(value)}
`, "utf8");
      await fs.rename(tmp, file);
    } catch (error) {
      try {
        await fs.rm(tmp, { force: true });
      } catch {
      }
      throw error;
    }
  }
  async directorySize(dir) {
    const { fs, path: path5 } = this.modules;
    let total = 0;
    let entries;
    try {
      entries = await fs.readdir(dir);
    } catch (error) {
      if (isNotFound(error))
        return 0;
      throw error;
    }
    for (const entry of entries) {
      if (!entry.endsWith(".json"))
        continue;
      let info;
      try {
        info = await fs.stat(path5.join(dir, entry));
      } catch (error) {
        if (isNotFound(error))
          continue;
        throw error;
      }
      total += info.isDirectory() ? await this.directorySize(path5.join(dir, entry)) : info.size;
    }
    return total;
  }
};
var MemorySpoolStorage = class {
  mode = "memory";
  records = /* @__PURE__ */ new Map();
  batches = /* @__PURE__ */ new Map();
  state;
  async init() {
  }
  async readState() {
    return this.state === void 0 ? void 0 : JSON.parse(this.state);
  }
  async writeState(state) {
    this.state = JSON.stringify(state);
  }
  async recordFiles() {
    return [...this.records.keys()].sort();
  }
  async readRecord(file) {
    const value = this.records.get(file);
    return value === void 0 ? void 0 : JSON.parse(value);
  }
  async writeRecord(recordId, record) {
    this.records.set(`${recordId}.json`, JSON.stringify(record));
  }
  async removeRecord(file) {
    this.records.delete(file);
  }
  async batchFiles() {
    return [...this.batches.keys()].sort();
  }
  async readBatch(file) {
    const value = this.batches.get(file);
    return value === void 0 ? void 0 : JSON.parse(value);
  }
  async writeBatch(file, batch) {
    this.batches.set(file, JSON.stringify(batch));
  }
  async removeBatch(file) {
    this.batches.delete(file);
  }
  async sizeBytes() {
    let total = 0;
    for (const value of this.records.values())
      total += import_node_buffer3.Buffer.byteLength(value, "utf8");
    for (const value of this.batches.values())
      total += import_node_buffer3.Buffer.byteLength(value, "utf8");
    return total;
  }
};
function parseBlackboxLogConfigPayload(value) {
  const trimmed = value.trim();
  const raw = trimmed.startsWith("{") ? trimmed : decodeEncodedJson(trimmed);
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("BLACKBOX_LOG_CONFIG must be a JSON object");
  return parsed;
}
function decodeEncodedJson(value) {
  for (const encoding of ["base64url", "base64"]) {
    try {
      const decoded = import_node_buffer3.Buffer.from(value, encoding).toString("utf8");
      if (decoded.trim().startsWith("{"))
        return decoded;
    } catch {
    }
  }
  throw new Error("BLACKBOX_LOG_CONFIG must be JSON, base64url JSON, or base64 JSON");
}
function normalizeBlackboxLogConfig(input) {
  if (!input.dek)
    throw new Error("Blackbox log config requires dek");
  if (input.domain !== void 0 && input.domain !== BLACKBOX_RUNTIME_LOG_CONFIG_DOMAIN_V2) {
    throw new Error(`Unsupported Blackbox log config domain: ${input.domain}`);
  }
  if (input.domain === BLACKBOX_RUNTIME_LOG_CONFIG_DOMAIN_V2) {
    if (!input.applicationUid || !input.applicationId) {
      throw new Error("Blackbox log config v2 requires applicationUid and applicationId");
    }
  } else if (input.applicationUid !== void 0) {
    throw new Error("Blackbox applicationUid requires the v2 config domain");
  }
  if (input.writerKeyDerivation !== void 0 && input.writerKeyDerivation !== BLACKBOX_WRITER_KEY_DERIVATION) {
    throw new Error(`Unsupported Blackbox writerKeyDerivation: ${input.writerKeyDerivation}`);
  }
  const writerKeyDerivation = input.writerKeyDerivation;
  if (input.factoryToken && !input.sinkId) {
    const factoryId = input.factoryId ?? parseFactoryIdFromToken(input.factoryToken);
    if (!factoryId) {
      throw new Error("Blackbox factory log config requires a factoryId (or a parseable factory token)");
    }
    if (!input.baseUrl)
      throw new Error("Blackbox factory log config requires baseUrl");
    const baseUrl = new URL(input.baseUrl);
    if (baseUrl.protocol !== "https:" && baseUrl.protocol !== "http:") {
      throw new Error("Blackbox baseUrl must use http or https");
    }
    return withoutUndefined({
      domain: input.domain,
      jobId: input.jobId,
      dek: input.dek,
      writerKeyDerivation,
      factoryToken: input.factoryToken,
      factoryId,
      baseUrl: input.baseUrl,
      spoolDir: input.spoolDir,
      network: input.network,
      applicationUid: input.applicationUid,
      applicationId: input.applicationId,
      deploymentId: input.deploymentId,
      context: input.context,
      timeoutMs: input.timeoutMs
    });
  }
  if (!input.sinkId || !input.jobId || !input.writeUrl) {
    throw new Error("Blackbox log config requires sinkId + jobId + writeUrl (pre-bound sink) or factoryToken + baseUrl (factory self-registration)");
  }
  const url = new URL(input.writeUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:")
    throw new Error("Blackbox writeUrl must use http or https");
  const resumeUrl = input.resumeUrl ?? deriveResumeUrl(url.toString());
  if (!resumeUrl) {
    throw new Error("Blackbox pre-bound log config requires resumeUrl when writeUrl does not end in /events");
  }
  validateHttpUrl(resumeUrl, "Blackbox resumeUrl");
  return withoutUndefined({
    domain: input.domain,
    sinkId: input.sinkId,
    jobId: input.jobId,
    writeUrl: url.toString(),
    resumeUrl: new URL(resumeUrl).toString(),
    dek: input.dek,
    writerKeyDerivation,
    baseUrl: input.baseUrl,
    spoolDir: input.spoolDir,
    applicationUid: input.applicationUid,
    applicationId: input.applicationId,
    deploymentId: input.deploymentId,
    context: input.context,
    timeoutMs: input.timeoutMs
  });
}
function parseFactoryIdFromToken(token) {
  const match = /^bbx_sf_([A-Za-z0-9][A-Za-z0-9.:-]{0,127})_/.exec(token);
  return match?.[1];
}
function defaultBlackboxSpoolDir(seed) {
  const segment = seed.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96) || "sink";
  return `${resolveSlipwayHome()}/logging/spool/${segment}`;
}
function contextField(value) {
  if (typeof value === "string" && value.length > 0)
    return value;
  if (value && typeof value === "object" && !Array.isArray(value))
    return canonicalJson(value);
  return void 0;
}
function stringField(record, name) {
  const value = record[name];
  return typeof value === "string" && value.length > 0 ? value : void 0;
}
function numberField(record, name) {
  const value = record[name];
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : numberFromString(typeof value === "string" ? value : void 0);
}
function numberFromString(value) {
  if (!value)
    return void 0;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : void 0;
}
function defaultConfigValue(name) {
  return getRuntimeEnvValue(name);
}
function logBatchHash(batch) {
  const { batchId: _batchId, ...hashMaterial } = batch;
  return `0x${sha256Digest(canonicalJson(hashMaterial)).slice("sha256:".length)}`;
}
function logBatchId(batch) {
  return logBatchHash(batch);
}
function normalizePublicKeyHex(value) {
  const hex = normalizeHexNoPrefix(value);
  if (!/^[0-9a-f]{64}$/u.test(hex))
    throw new Error("Blackbox signer public key must be a 32-byte hex string");
  return hex;
}
function isNotFound(error) {
  return typeof error === "object" && error !== null && error.code === "ENOENT";
}
function stringifyRuntimeValue2(value) {
  if (typeof value === "string" && value.length > 0)
    return value;
  if (value === void 0 || value === null)
    return void 0;
  return JSON.stringify(value);
}
function stringOrUndefined(value) {
  return typeof value === "string" && value.length > 0 ? value : void 0;
}
function positiveSafeInteger(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : void 0;
}
function chainFromPayload(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} included an invalid chain head`);
  }
  const chain = value;
  const nextSequence = positiveSafeInteger(chain.nextSequence);
  if (!nextSequence) {
    throw new Error(`${label} chain nextSequence must be a positive safe integer`);
  }
  if (chain.previousHash !== null && chain.previousHash !== void 0 && (typeof chain.previousHash !== "string" || !/^0x[0-9a-fA-F]{64}$/u.test(chain.previousHash))) {
    throw new Error(`${label} chain previousHash must be a 32-byte 0x-prefixed hash or null`);
  }
  const previousHash = typeof chain.previousHash === "string" ? chain.previousHash : null;
  if (nextSequence === 1 !== (previousHash === null)) {
    throw new Error(`${label} chain head is internally inconsistent`);
  }
  return { nextSequence, previousHash };
}
function parseJsonResponse(body, label) {
  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
  }
  throw new Error(`${label} must be a JSON object`);
}
function deriveResumeUrl(writeUrl) {
  const url = new URL(writeUrl);
  if (!url.pathname.endsWith("/events"))
    return void 0;
  url.pathname = `${url.pathname.slice(0, -"/events".length)}/resume`;
  return url.toString();
}
function validateHttpUrl(value, label) {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`${label} must use http or https`);
  }
}
function responseErrorCode(body) {
  try {
    const parsed = JSON.parse(body);
    return stringOrUndefined(parsed.error);
  } catch {
    return void 0;
  }
}
function withoutUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== void 0));
}

// node_modules/.pnpm/@proof-computer+liskov-runtime@https+++codeload.github.com+proof-computer+liskov-runtim_f15215979215515ddd7379bdd6f54a67/node_modules/@proof-computer/liskov-runtime/dist/bootstrap.js
var import_node_buffer4 = require("node:buffer");
var LISKOV_RUNTIME_BOOTSTRAP_REQUEST_DOMAIN_V1 = "proof.liskov.runtime-bootstrap-request.v1";
var LISKOV_RUNTIME_BOOTSTRAP_REQUEST_DOMAIN_V2 = "proof.liskov.runtime-bootstrap-request.v2";
var LISKOV_SECRET_BOOTSTRAP_REQUEST_DOMAIN_V1 = "proof.liskov.secret-bootstrap-request.v1";
var LISKOV_SECRET_BOOTSTRAP_REQUEST_DOMAIN_V2 = "proof.liskov.secret-bootstrap-request.v2";
var LISKOV_RUNTIME_BOOTSTRAP_RESPONSE_DOMAIN_V1 = "proof.liskov.runtime-bootstrap-response.v1";
var LISKOV_RUNTIME_BOOTSTRAP_RESPONSE_DOMAIN_V2 = "proof.liskov.runtime-bootstrap-response.v2";
var LISKOV_SECRET_BOOTSTRAP_RESPONSE_DOMAIN_V1 = "proof.liskov.secret-bootstrap-response.v1";
var LISKOV_SECRET_BOOTSTRAP_RESPONSE_DOMAIN_V2 = "proof.liskov.secret-bootstrap-response.v2";
var DEFAULT_LISKOV_CORE_URL = "https://runtime.liskov.proof.computer";
var DEFAULT_LISKOV_SECRETS_URL = "https://secrets.liskov.proof.computer";
var DEFAULT_LISKOV_BOOTSTRAP_REQUEST_TTL_MS = 6e4;
var DEFAULT_LISKOV_BOOTSTRAP_RETRY_INITIAL_DELAY_MS = 250;
var DEFAULT_LISKOV_BOOTSTRAP_RETRY_INTERVAL_MS = 2e3;
var DEFAULT_LISKOV_BOOTSTRAP_RETRY_MAX_ELAPSED_MS = 6e4;
var DEFAULT_LISKOV_BOOTSTRAP_RETRY_MAX_ATTEMPTS = 30;
var LiskovSignedBootstrapHttpError = class extends Error {
  status;
  bodyText;
  errorCode;
  retryable;
  constructor(input) {
    super(`${input.label} rejected request: ${input.status} ${input.bodyText.slice(0, 500)}`);
    this.name = "LiskovSignedBootstrapHttpError";
    this.status = input.status;
    this.bodyText = input.bodyText;
    this.errorCode = input.errorCode;
    this.retryable = input.retryable;
  }
};
function liskovSignedBootstrapUrls(options = {}) {
  return {
    coreUrl: options.coreUrl ?? getRuntimeEnvValue("PROOF_LISKOV_CORE_URL", options) ?? getRuntimeEnvValue("PROOF_SLIPWAY_URL", options) ?? DEFAULT_LISKOV_CORE_URL,
    secretsUrl: options.secretsUrl ?? getRuntimeEnvValue("PROOF_LISKOV_SECRETS_URL", options) ?? DEFAULT_LISKOV_SECRETS_URL
  };
}
function liskovSignedBootstrapAllowInsecureHttp(options = {}) {
  return options.allowInsecureHttp ?? optionalBooleanEnv("PROOF_LISKOV_BOOTSTRAP_ALLOW_INSECURE_HTTP", options);
}
function liskovSignedBootstrapRequestTtlMs(options = {}) {
  return options.requestTtlMs ?? optionalIntegerEnv("PROOF_LISKOV_BOOTSTRAP_REQUEST_TTL_MS", options) ?? DEFAULT_LISKOV_BOOTSTRAP_REQUEST_TTL_MS;
}
function liskovSignedBootstrapRetryOptions(options = {}) {
  return {
    initialDelayMs: nonNegativeInteger(options.retry?.initialDelayMs) ?? DEFAULT_LISKOV_BOOTSTRAP_RETRY_INITIAL_DELAY_MS,
    intervalMs: nonNegativeInteger(options.retry?.intervalMs) ?? DEFAULT_LISKOV_BOOTSTRAP_RETRY_INTERVAL_MS,
    maxElapsedMs: nonNegativeInteger(options.retry?.maxElapsedMs) ?? DEFAULT_LISKOV_BOOTSTRAP_RETRY_MAX_ELAPSED_MS,
    maxAttempts: positiveInteger(options.retry?.maxAttempts) ?? DEFAULT_LISKOV_BOOTSTRAP_RETRY_MAX_ATTEMPTS
  };
}
async function buildLiskovRuntimeBootstrapRequest(input) {
  const identity = await input.identityProvider.resolveIdentity({ requireEncryptionKey: false });
  const nowMs = input.nowMs ?? Date.now();
  const request = canonicalLiskovRuntimeBootstrapRequest({
    domain: LISKOV_RUNTIME_BOOTSTRAP_REQUEST_DOMAIN_V2,
    jobId: identity.jobId,
    processorId: identity.processorId,
    nonce: input.nonce ?? randomHex(16, input.randomBytes),
    issuedAtMs: nowMs,
    expiresAtMs: nowMs + (input.requestTtlMs ?? DEFAULT_LISKOV_BOOTSTRAP_REQUEST_TTL_MS)
  });
  return {
    ...request,
    signature: await input.identityProvider.sign(liskovRuntimeBootstrapRequestMessage(request))
  };
}
async function buildLiskovSecretBootstrapRequest(input) {
  const identity = await input.identityProvider.resolveIdentity({ requireEncryptionKey: true });
  const nowMs = input.nowMs ?? Date.now();
  const request = canonicalLiskovSecretBootstrapRequest({
    domain: LISKOV_SECRET_BOOTSTRAP_REQUEST_DOMAIN_V2,
    jobId: identity.jobId,
    processorId: identity.processorId,
    responseEncryptionKey: normalizeHexNoPrefix(identity.responseEncryptionKey),
    nonce: input.nonce ?? randomHex(16, input.randomBytes),
    issuedAtMs: nowMs,
    expiresAtMs: nowMs + (input.requestTtlMs ?? DEFAULT_LISKOV_BOOTSTRAP_REQUEST_TTL_MS)
  });
  return {
    ...request,
    signature: await input.identityProvider.sign(liskovSecretBootstrapRequestMessage(request))
  };
}
function canonicalLiskovRuntimeBootstrapRequest(request) {
  const { signature: _signature, ...unsigned } = request;
  const domain = runtimeBootstrapRequestDomain(unsigned.domain);
  return {
    domain,
    jobId: requiredString(unsigned, "jobId"),
    processorId: requiredString(unsigned, "processorId"),
    nonce: requiredString(unsigned, "nonce"),
    issuedAtMs: integerTimestamp(unsigned.issuedAtMs, "issuedAtMs"),
    expiresAtMs: integerTimestamp(unsigned.expiresAtMs, "expiresAtMs")
  };
}
function canonicalLiskovSecretBootstrapRequest(request) {
  const { signature: _signature, ...unsigned } = request;
  const domain = secretBootstrapRequestDomain(unsigned.domain);
  return {
    domain,
    jobId: requiredString(unsigned, "jobId"),
    processorId: requiredString(unsigned, "processorId"),
    responseEncryptionKey: normalizeHexNoPrefix(requiredString(unsigned, "responseEncryptionKey")),
    nonce: requiredString(unsigned, "nonce"),
    issuedAtMs: integerTimestamp(unsigned.issuedAtMs, "issuedAtMs"),
    expiresAtMs: integerTimestamp(unsigned.expiresAtMs, "expiresAtMs")
  };
}
function liskovRuntimeBootstrapRequestMessage(request) {
  return import_node_buffer4.Buffer.from(canonicalJson(canonicalLiskovRuntimeBootstrapRequest(request)), "utf8");
}
function liskovSecretBootstrapRequestMessage(request) {
  return import_node_buffer4.Buffer.from(canonicalJson(canonicalLiskovSecretBootstrapRequest(request)), "utf8");
}
async function loadLiskovRuntimeBootstrap(input) {
  const fetchImpl = input.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function")
    throw new Error("fetch is required for Liskov runtime bootstrap");
  const urls = liskovSignedBootstrapUrls(input);
  const allowInsecureHttp = liskovSignedBootstrapAllowInsecureHttp(input);
  const requestTtlMs = liskovSignedBootstrapRequestTtlMs(input);
  const request = await buildLiskovRuntimeBootstrapRequest({
    identityProvider: input.identityProvider,
    nowMs: input.nowMs?.() ?? Date.now(),
    randomBytes: input.randomBytes,
    requestTtlMs
  });
  const response = await retrySignedBootstrapRequest(input, async () => {
    const response2 = parseLiskovRuntimeBootstrapResponse(await postSignedBootstrapRequest({
      fetchImpl,
      url: new URL("/api/jobs/runtime-bootstrap", urls.coreUrl),
      allowInsecureHttp,
      label: "Liskov runtime bootstrap",
      request
    }));
    return response2;
  });
  assertRuntimeBootstrapBinding({ request, response });
  const runtimeEnvConfig = response.runtimeEnv?.enabled === false ? void 0 : {
    slipwayUrl: response.runtimeEnv?.url ?? response.slipwayUrl,
    ...response.applicationUid === void 0 ? {} : { applicationUid: response.applicationUid },
    applicationId: response.applicationId,
    policyDigest: response.policyDigest,
    deploymentId: response.deploymentId,
    runtimeInstanceId: response.runtimeInstanceId,
    allowInsecureHttp,
    requestTtlMs
  };
  return {
    request,
    response,
    runtimeEnvConfig,
    secretsRequired: response.secrets?.required === true,
    secretsUrl: response.secrets?.url ?? urls.secretsUrl
  };
}
async function loadLiskovSecretBootstrap(input) {
  const fetchImpl = input.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function")
    throw new Error("fetch is required for Liskov secret bootstrap");
  const urls = liskovSignedBootstrapUrls(input);
  const allowInsecureHttp = liskovSignedBootstrapAllowInsecureHttp(input);
  const requestTtlMs = liskovSignedBootstrapRequestTtlMs(input);
  const { request, response } = await retrySignedBootstrapRequest(input, async () => {
    const request2 = await buildLiskovSecretBootstrapRequest({
      identityProvider: input.identityProvider,
      nowMs: input.nowMs?.() ?? Date.now(),
      randomBytes: input.randomBytes,
      requestTtlMs
    });
    const response2 = parseLiskovSecretBootstrapResponse(await postSignedBootstrapRequest({
      fetchImpl,
      url: new URL("/api/jobs/secret-bootstrap", urls.secretsUrl),
      allowInsecureHttp,
      label: "Liskov secret bootstrap",
      request: request2
    }));
    return { request: request2, response: response2 };
  });
  assertSecretBootstrapBinding({ request, response });
  return {
    request,
    response,
    lockboxConfig: {
      lockboxUrl: response.lockboxUrl,
      ...response.applicationUid === void 0 ? {} : { applicationUid: response.applicationUid },
      applicationId: response.applicationId,
      grantId: response.grantId,
      policyDigest: response.policyDigest,
      deploymentId: response.deploymentId,
      requestedSecretIds: response.requestedSecretIds,
      allowInsecureHttp,
      requestTtlMs,
      fileBaseDir: response.fileBaseDir,
      // A signed bootstrap is bound to the current job + grant. Any existing
      // value can only be ambient process state (including state retained by a
      // reused Acurast runtime), so the authenticated grant must replace it.
      overwriteEnv: true
    }
  };
}
function parseLiskovRuntimeBootstrapResponse(value) {
  const record = asRecord(value, "Liskov runtime bootstrap response");
  const domain = runtimeBootstrapResponseDomain(record.domain);
  if (record.ok !== true) {
    throw new Error("Liskov runtime bootstrap response has an unsupported domain");
  }
  const runtimeEnv = recordOrUndefined(record.runtimeEnv);
  const secrets = recordOrUndefined(record.secrets);
  return {
    ok: true,
    domain,
    ...domain === LISKOV_RUNTIME_BOOTSTRAP_RESPONSE_DOMAIN_V2 ? { applicationUid: requiredString(record, "applicationUid") } : {},
    applicationId: requiredString(record, "applicationId"),
    policyDigest: normalizePolicyDigest(requiredString(record, "policyDigest")),
    deploymentId: requiredString(record, "deploymentId"),
    jobId: requiredString(record, "jobId"),
    processorId: requiredString(record, "processorId"),
    runtimeInstanceId: optionalString(record, "runtimeInstanceId"),
    slipwayUrl: requiredString(record, "slipwayUrl"),
    runtimeEnv: runtimeEnv === void 0 ? void 0 : {
      enabled: optionalBoolean(runtimeEnv, "enabled"),
      url: optionalString(runtimeEnv, "url")
    },
    secrets: secrets === void 0 ? void 0 : {
      required: optionalBoolean(secrets, "required"),
      url: optionalString(secrets, "url")
    }
  };
}
function parseLiskovSecretBootstrapResponse(value) {
  const record = asRecord(value, "Liskov secret bootstrap response");
  const domain = secretBootstrapResponseDomain(record.domain);
  if (record.ok !== true) {
    throw new Error("Liskov secret bootstrap response has an unsupported domain");
  }
  return {
    ok: true,
    domain,
    lockboxUrl: requiredString(record, "lockboxUrl"),
    ...domain === LISKOV_SECRET_BOOTSTRAP_RESPONSE_DOMAIN_V2 ? { applicationUid: requiredString(record, "applicationUid") } : {},
    applicationId: requiredString(record, "applicationId"),
    grantId: requiredString(record, "grantId"),
    policyDigest: normalizePolicyDigest(requiredString(record, "policyDigest")),
    deploymentId: requiredString(record, "deploymentId"),
    jobId: requiredString(record, "jobId"),
    processorId: requiredString(record, "processorId"),
    requestedSecretIds: normalizeRequestedSecretIds(requiredStringArray(record, "requestedSecretIds")),
    fileBaseDir: optionalString(record, "fileBaseDir")
  };
}
function isLiskovSignedBootstrapUnavailableError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /Acurast (job id|processor id|Ed25519 signer|response encryption key) is required/u.test(message);
}
async function postSignedBootstrapRequest(input) {
  assertSecureRuntimeUrl(input.url, input.allowInsecureHttp, input.label);
  const response = await input.fetchImpl(input.url.toString(), {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(input.request)
  });
  const text = await response.text();
  if (!response.ok) {
    const body = parseBootstrapErrorBody(text);
    throw new LiskovSignedBootstrapHttpError({
      label: input.label,
      status: response.status,
      bodyText: text,
      errorCode: body.errorCode,
      retryable: body.retryable
    });
  }
  return parseJson(text, `${input.label} response`);
}
async function retrySignedBootstrapRequest(input, attempt) {
  const retry = liskovSignedBootstrapRetryOptions(input);
  const setTimeoutImpl = input.setTimeoutImpl ?? setTimeout;
  const startedAtMs = input.nowMs?.() ?? Date.now();
  let attemptNumber = 0;
  let nextDelayMs = retry.initialDelayMs;
  for (; ; ) {
    attemptNumber += 1;
    try {
      return await attempt();
    } catch (error) {
      if (!liskovSignedBootstrapErrorIsRetryable(error) || attemptNumber >= retry.maxAttempts) {
        throw error;
      }
      const nowMs = input.nowMs?.() ?? Date.now();
      if (nowMs - startedAtMs + nextDelayMs > retry.maxElapsedMs)
        throw error;
      await sleep(nextDelayMs, setTimeoutImpl);
      nextDelayMs = retry.intervalMs;
    }
  }
}
function liskovSignedBootstrapErrorIsRetryable(error) {
  if (!(error instanceof LiskovSignedBootstrapHttpError))
    return false;
  if (error.retryable === true)
    return true;
  if (error.retryable === false)
    return false;
  if (error.errorCode === "runtime_bootstrap_bad_signature" || error.errorCode === "bad_signature" || error.errorCode === "runtime_bootstrap_job_ambiguous" || error.errorCode === "job_grant_ambiguous") {
    return false;
  }
  if (error.errorCode !== void 0 && error.errorCode.endsWith("_not_found"))
    return true;
  return [404, 409, 425, 429, 500, 502, 503, 504].includes(error.status);
}
function parseBootstrapErrorBody(text) {
  try {
    const record = asRecord(JSON.parse(text), "Liskov bootstrap error");
    return {
      errorCode: optionalString(record, "error"),
      retryable: optionalBoolean(record, "retryable")
    };
  } catch {
    return {};
  }
}
async function sleep(delayMs, setTimeoutImpl) {
  if (delayMs <= 0)
    return;
  await new Promise((resolve) => {
    const timer = setTimeoutImpl(resolve, delayMs);
    timer.unref?.();
  });
}
function nonNegativeInteger(value) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : void 0;
}
function positiveInteger(value) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(1, Math.floor(value)) : void 0;
}
function assertRuntimeBootstrapBinding(input) {
  const expectedDomain = input.request.domain === LISKOV_RUNTIME_BOOTSTRAP_REQUEST_DOMAIN_V2 ? LISKOV_RUNTIME_BOOTSTRAP_RESPONSE_DOMAIN_V2 : LISKOV_RUNTIME_BOOTSTRAP_RESPONSE_DOMAIN_V1;
  if (input.response.domain !== expectedDomain) {
    throw new Error("Liskov runtime bootstrap response attempted a protocol downgrade");
  }
  if (input.response.jobId !== input.request.jobId) {
    throw new Error("Liskov runtime bootstrap response jobId did not match the signed request");
  }
  if (input.response.processorId !== input.request.processorId) {
    throw new Error("Liskov runtime bootstrap response processorId did not match the signed request");
  }
}
function assertSecretBootstrapBinding(input) {
  const expectedDomain = input.request.domain === LISKOV_SECRET_BOOTSTRAP_REQUEST_DOMAIN_V2 ? LISKOV_SECRET_BOOTSTRAP_RESPONSE_DOMAIN_V2 : LISKOV_SECRET_BOOTSTRAP_RESPONSE_DOMAIN_V1;
  if (input.response.domain !== expectedDomain) {
    throw new Error("Liskov secret bootstrap response attempted a protocol downgrade");
  }
  if (input.response.jobId !== input.request.jobId) {
    throw new Error("Liskov secret bootstrap response jobId did not match the signed request");
  }
  if (input.response.processorId !== input.request.processorId) {
    throw new Error("Liskov secret bootstrap response processorId did not match the signed request");
  }
}
function requiredStringArray(record, field) {
  const value = record[field];
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string" && item.length > 0)) {
    throw new Error(`${field} must be a string array`);
  }
  return value;
}
function runtimeBootstrapRequestDomain(value) {
  if (value === LISKOV_RUNTIME_BOOTSTRAP_REQUEST_DOMAIN_V1 || value === LISKOV_RUNTIME_BOOTSTRAP_REQUEST_DOMAIN_V2) {
    return value;
  }
  throw new Error("Liskov runtime bootstrap request has an unsupported domain");
}
function secretBootstrapRequestDomain(value) {
  if (value === LISKOV_SECRET_BOOTSTRAP_REQUEST_DOMAIN_V1 || value === LISKOV_SECRET_BOOTSTRAP_REQUEST_DOMAIN_V2) {
    return value;
  }
  throw new Error("Liskov secret bootstrap request has an unsupported domain");
}
function runtimeBootstrapResponseDomain(value) {
  if (value === LISKOV_RUNTIME_BOOTSTRAP_RESPONSE_DOMAIN_V1 || value === LISKOV_RUNTIME_BOOTSTRAP_RESPONSE_DOMAIN_V2) {
    return value;
  }
  throw new Error("Liskov runtime bootstrap response has an unsupported domain");
}
function secretBootstrapResponseDomain(value) {
  if (value === LISKOV_SECRET_BOOTSTRAP_RESPONSE_DOMAIN_V1 || value === LISKOV_SECRET_BOOTSTRAP_RESPONSE_DOMAIN_V2) {
    return value;
  }
  throw new Error("Liskov secret bootstrap response has an unsupported domain");
}

// node_modules/.pnpm/@proof-computer+liskov-runtime@https+++codeload.github.com+proof-computer+liskov-runtim_f15215979215515ddd7379bdd6f54a67/node_modules/@proof-computer/liskov-runtime/dist/diagnostics.js
var SLIPWAY_RUNTIME_DIAGNOSTIC_DOMAIN = "proof.slipway.runtime-diagnostic.v1";
var LISKOV_RUNTIME_DIAGNOSTIC_DOMAIN_V2 = "proof.liskov.runtime-diagnostic.v2";
var LISKOV_RUNTIME_DIAGNOSTIC_DOMAIN_V3 = "proof.liskov.runtime-diagnostic.v3";
var LISKOV_RUNTIME_DIAGNOSTIC_DOMAIN_V4 = "proof.liskov.runtime-diagnostic.v4";
var LISKOV_RUNTIME_CONTROL_DOMAIN_V1 = "proof.liskov.runtime-control.v1";
var LISKOV_COOPERATIVE_CEASE_CAPABILITY = "cooperative_cease.v1";
var DEFAULT_SLIPWAY_RUNTIME_HEALTH_INTERVAL_MS = 3e4;
var DEFAULT_SLIPWAY_RUNTIME_HEALTH_INITIAL_DELAY_MS = 3e4;
var DEFAULT_SLIPWAY_RUNTIME_DIAGNOSTIC_SEND_TIMEOUT_MS = 1500;
var DEFAULT_SLIPWAY_RUNTIME_DIAGNOSTIC_REMOTE_BACKOFF_MS = 3e4;
var MAX_STAGE_LENGTH = 128;
var MAX_COMPONENT_LENGTH = 96;
var MAX_CODE_LENGTH = 96;
var MAX_MESSAGE_LENGTH = 500;
var MAX_ATTRS = 32;
var MAX_ATTR_KEY_LENGTH = 64;
var MAX_ATTR_VALUE_LENGTH = 256;
function createSlipwayRuntimeDiagnosticEmitter(options = {}) {
  let sequence = 0;
  let remoteDisabledUntilMs = 0;
  let bootstrap = options.bootstrap;
  let closed = false;
  let fatalPromise;
  const ceaseCommands = /* @__PURE__ */ new Map();
  const ignoredControls = /* @__PURE__ */ new Set();
  let emitter;
  const reportCeaseOutcome = (command, state) => {
    if (!state.outcome || state.acknowledgementInFlight)
      return;
    state.acknowledgementInFlight = true;
    const report = state.outcome.status === "succeeded" ? {
      stage: "runtime.ceased",
      status: "succeeded",
      component: "runtime-control",
      attrs: { commandId: command.commandId }
    } : {
      stage: "runtime.cease_failed",
      status: "failed",
      component: "runtime-control",
      code: "cease_handler_failed",
      message: state.outcome.message,
      attrs: { commandId: command.commandId }
    };
    queueMicrotask(() => {
      void emitter.report(report).finally(() => {
        state.acknowledgementInFlight = false;
      });
    });
  };
  const prepare = (event) => {
    const timestampMs = options.nowMs?.() ?? Date.now();
    return redactDiagnostic({
      ...event,
      sequence: sequence++,
      timestampMs
    });
  };
  const deliver = async (diagnostic, terminal) => {
    const local = sendLocalDiagnostic(options, diagnostic);
    const remoteSend = sendRemoteDiagnostic({
      ...options,
      bootstrap,
      diagnostic,
      terminal,
      remoteDisabledUntilMs,
      handleControl(control, binding) {
        const parsed = parseRuntimeCeaseControl(control, binding, options.nowMs?.() ?? Date.now());
        if ("error" in parsed) {
          const fingerprint = JSON.stringify(control);
          if (ignoredControls.has(fingerprint))
            return;
          ignoredControls.add(fingerprint);
          queueMicrotask(() => {
            void emitter.report({
              stage: "runtime.control_ignored",
              status: "failed",
              component: "runtime-control",
              code: parsed.error
            });
          });
          return;
        }
        const command = parsed.command;
        if (!options.onCease)
          return;
        const existing = ceaseCommands.get(command.commandId);
        if (existing) {
          if (diagnostic.stage !== "runtime.ceased" && diagnostic.stage !== "runtime.cease_failed") {
            reportCeaseOutcome(command, existing);
          }
          return;
        }
        const state = { acknowledgementInFlight: false };
        ceaseCommands.set(command.commandId, state);
        queueMicrotask(() => {
          void Promise.resolve().then(() => options.onCease?.(command)).then(() => {
            state.outcome = { status: "succeeded" };
            reportCeaseOutcome(command, state);
          }).catch((error) => {
            state.outcome = { status: "failed", message: safeErrorMessage(error) };
            reportCeaseOutcome(command, state);
          });
        });
      }
    });
    const remote = terminal ? promiseWithTimeout(remoteSend, diagnosticSendTimeoutMs(options), "Terminal Liskov runtime diagnostic attempt", options) : remoteSend;
    const [, remoteResult] = await Promise.allSettled([local, remote]);
    if (remoteResult.status === "rejected" && !terminal) {
      remoteDisabledUntilMs = (options.nowMs?.() ?? Date.now()) + diagnosticRemoteBackoffMs(options);
    }
  };
  emitter = {
    emit(event) {
      if (closed)
        return Promise.resolve();
      return deliver(prepare(event), false);
    },
    report(event) {
      if (event.stage === "runtime.fatal" || event.stage.startsWith("runtime.fatal.")) {
        return Promise.reject(new Error("runtime.fatal.* diagnostics are terminal and must use fatal()"));
      }
      if (closed)
        return Promise.resolve();
      return deliver(prepare({ ...event, ok: event.status !== "failed" }), false);
    },
    fatal(event) {
      if (fatalPromise)
        return fatalPromise;
      closed = true;
      try {
        options.onFatal?.();
      } catch {
      }
      const message = event.message ?? (event.error === void 0 ? void 0 : diagnosticErrorMessage(event.error));
      const diagnostic = prepare({
        stage: `runtime.fatal.${event.kind}`,
        status: "failed",
        ok: false,
        component: event.component,
        code: event.code,
        message,
        error: message,
        attrs: event.attrs
      });
      fatalPromise = deliver(diagnostic, true);
      return fatalPromise;
    },
    configureBootstrap(value) {
      bootstrap = value;
    },
    isClosed() {
      return closed;
    }
  };
  return emitter;
}
function startSlipwayRuntimeHealth(options = {}) {
  const intervalMs = nonNegativeInteger2(options.intervalMs ?? options.bootstrap?.runtimeHealth?.intervalMs) ?? DEFAULT_SLIPWAY_RUNTIME_HEALTH_INTERVAL_MS;
  const initialDelayMs = nonNegativeInteger2(options.initialDelayMs ?? options.bootstrap?.runtimeHealth?.initialDelayMs) ?? DEFAULT_SLIPWAY_RUNTIME_HEALTH_INITIAL_DELAY_MS;
  const setTimeoutImpl = options.setTimeoutImpl ?? setTimeout;
  const clearTimeoutImpl = options.clearTimeoutImpl ?? clearTimeout;
  const emitter = options.emitter ?? createSlipwayRuntimeDiagnosticEmitter(options);
  let stopped = false;
  let timer;
  const sendNow = async () => {
    if (stopped)
      return;
    await emitter.emit({
      stage: "runtime.health",
      status: "info",
      ok: true,
      component: "runtime-health"
    });
  };
  const schedule = (delayMs) => {
    if (stopped || intervalMs <= 0 || !canSendRemoteDiagnostic(options))
      return;
    if (timer)
      clearTimeoutImpl(timer);
    timer = setTimeoutImpl(() => {
      void sendNow().finally(() => schedule(intervalMs));
    }, delayMs);
    timer.unref?.();
  };
  schedule(initialDelayMs);
  return {
    stop() {
      stopped = true;
      if (timer)
        clearTimeoutImpl(timer);
      timer = void 0;
    },
    sendNow
  };
}
function redactDiagnostic(diagnostic) {
  return {
    ...diagnostic,
    stage: boundedRequiredString(diagnostic.stage, MAX_STAGE_LENGTH, "stage"),
    component: boundedOptionalString(diagnostic.component, MAX_COMPONENT_LENGTH),
    code: boundedOptionalString(diagnostic.code, MAX_CODE_LENGTH),
    message: diagnostic.message ? redactDiagnosticMessage(diagnostic.message) : diagnostic.message,
    error: diagnostic.error ? redactDiagnosticMessage(diagnostic.error) : diagnostic.error,
    attrs: redactAttrs(diagnostic.attrs)
  };
}
function slipwayRuntimeDiagnosticRequestMessage(input) {
  return Buffer.from(canonicalJson({
    domain: SLIPWAY_RUNTIME_DIAGNOSTIC_DOMAIN,
    applicationId: input.applicationId,
    policyDigest: input.policyDigest.toLowerCase(),
    deploymentId: input.deploymentId,
    stage: input.stage,
    status: input.status,
    sequence: input.sequence,
    timestampMs: input.timestampMs
  }), "utf8");
}
function canonicalLiskovRuntimeDiagnosticV2Payload(input) {
  const status = input.status;
  if (!["started", "succeeded", "failed", "skipped", "info"].includes(status)) {
    throw new Error("status is not supported");
  }
  if (!Number.isSafeInteger(input.sequence) || input.sequence < 0) {
    throw new Error("sequence must be a non-negative safe integer");
  }
  if (!Number.isSafeInteger(input.timestampMs) || input.timestampMs <= 0) {
    throw new Error("timestampMs must be a positive safe integer");
  }
  const message = boundedOptionalString(input.message ?? void 0, MAX_MESSAGE_LENGTH);
  return {
    jobId: boundedRequiredString(input.jobId, 256, "jobId"),
    processorId: boundedRequiredString(input.processorId, 256, "processorId"),
    stage: boundedRequiredString(input.stage, MAX_STAGE_LENGTH, "stage"),
    status,
    sequence: input.sequence,
    timestampMs: input.timestampMs,
    component: boundedOptionalString(input.component ?? void 0, MAX_COMPONENT_LENGTH) ?? null,
    code: boundedOptionalString(input.code ?? void 0, MAX_CODE_LENGTH) ?? null,
    message: message ? redactDiagnosticMessage(message) : null,
    attrs: redactAttrs(input.attrs ?? void 0) ?? null
  };
}
function liskovRuntimeDiagnosticV2Message(input) {
  return Buffer.from(canonicalJson({
    domain: LISKOV_RUNTIME_DIAGNOSTIC_DOMAIN_V2,
    ...canonicalLiskovRuntimeDiagnosticV2Payload(input)
  }), "utf8");
}
function canonicalLiskovRuntimeDiagnosticV3Payload(input) {
  return {
    ...canonicalLiskovRuntimeDiagnosticV2Payload(input),
    runtimeInstanceId: boundedRequiredString(input.runtimeInstanceId, 256, "runtimeInstanceId")
  };
}
function liskovRuntimeDiagnosticV3Message(input) {
  return Buffer.from(canonicalJson({
    domain: LISKOV_RUNTIME_DIAGNOSTIC_DOMAIN_V3,
    ...canonicalLiskovRuntimeDiagnosticV3Payload(input)
  }), "utf8");
}
function canonicalLiskovRuntimeDiagnosticV4Payload(input) {
  return {
    ...canonicalLiskovRuntimeDiagnosticV3Payload(input),
    applicationUid: boundedRequiredString(input.applicationUid, 256, "applicationUid")
  };
}
function liskovRuntimeDiagnosticV4Message(input) {
  return Buffer.from(canonicalJson({
    domain: LISKOV_RUNTIME_DIAGNOSTIC_DOMAIN_V4,
    ...canonicalLiskovRuntimeDiagnosticV4Payload(input)
  }), "utf8");
}
function canSendRemoteDiagnostic(options) {
  if (options.coreUrl && options.identityProvider)
    return true;
  if (!options.bootstrap)
    return false;
  return Boolean(options.bootstrap.diagnosticsToken) || Boolean(options.identityProvider);
}
async function sendLocalDiagnostic(options, diagnostic) {
  if (!options.diagnostics)
    return;
  await promiseWithTimeout(Promise.resolve(options.diagnostics(diagnostic)), diagnosticSendTimeoutMs(options), "Local Liskov runtime diagnostic callback", options);
}
async function sendRemoteDiagnostic(input) {
  if (!canSendRemoteDiagnostic(input))
    return;
  if (!input.terminal && input.diagnostic.timestampMs < input.remoteDisabledUntilMs)
    return;
  if (input.coreUrl && input.identityProvider) {
    await sendLiskovRuntimeDiagnostic({
      ...input,
      coreUrl: input.coreUrl,
      identityProvider: input.identityProvider
    });
    return;
  }
  if (input.bootstrap)
    await sendSlipwayRuntimeDiagnosticV1({ ...input, bootstrap: input.bootstrap });
}
async function sendLiskovRuntimeDiagnostic(input) {
  const fetchImpl = input.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function")
    return;
  const url = new URL("/api/jobs/runtime-diagnostics", input.coreUrl);
  assertSecureRuntimeUrl(url, input.allowInsecureHttp, "Liskov runtime diagnostics");
  const identity = await input.identityProvider.resolveIdentity({ requireEncryptionKey: false });
  const runtimeInstanceId = input.bootstrap?.runtimeInstanceId;
  const applicationUid = input.bootstrap?.applicationUid;
  const canReceiveV4Control = input.onCease !== void 0 && runtimeInstanceId !== void 0 && applicationUid !== void 0;
  const payload = canonicalLiskovRuntimeDiagnosticV2Payload({
    jobId: identity.jobId,
    processorId: identity.processorId,
    stage: input.diagnostic.stage,
    status: input.diagnostic.status,
    sequence: input.diagnostic.sequence,
    timestampMs: input.diagnostic.timestampMs,
    component: input.diagnostic.component ?? null,
    code: input.diagnostic.code ?? null,
    message: input.diagnostic.message ?? input.diagnostic.error ?? null,
    attrs: {
      ...input.diagnostic.attrs,
      ...canReceiveV4Control ? { capabilities: LISKOV_COOPERATIVE_CEASE_CAPABILITY } : {},
      ...input.diagnostic.valueCount === void 0 ? {} : { valueCount: input.diagnostic.valueCount },
      ...input.diagnostic.revision === void 0 ? {} : { revision: input.diagnostic.revision }
    }
  });
  const v3Payload = runtimeInstanceId === void 0 ? void 0 : canonicalLiskovRuntimeDiagnosticV3Payload({ ...payload, runtimeInstanceId });
  const v4Payload = v3Payload === void 0 || applicationUid === void 0 ? void 0 : canonicalLiskovRuntimeDiagnosticV4Payload({ ...v3Payload, applicationUid });
  const signature = await input.identityProvider.sign(v4Payload !== void 0 ? liskovRuntimeDiagnosticV4Message(v4Payload) : v3Payload === void 0 ? liskovRuntimeDiagnosticV2Message(payload) : liskovRuntimeDiagnosticV3Message(v3Payload));
  const responseBody = await postDiagnostic({ ...input, fetchImpl, url, body: {
    domain: v4Payload !== void 0 ? LISKOV_RUNTIME_DIAGNOSTIC_DOMAIN_V4 : v3Payload === void 0 ? LISKOV_RUNTIME_DIAGNOSTIC_DOMAIN_V2 : LISKOV_RUNTIME_DIAGNOSTIC_DOMAIN_V3,
    ...v4Payload ?? v3Payload ?? payload,
    signature
  } });
  if (v4Payload !== void 0 && typeof responseBody === "object" && responseBody !== null && !Array.isArray(responseBody)) {
    const control = responseBody.control;
    if (control !== void 0 && control !== null) {
      input.handleControl?.(control, {
        applicationUid: v4Payload.applicationUid,
        policyDigest: input.bootstrap?.policyDigest ?? "",
        deploymentId: input.bootstrap?.deploymentId ?? "",
        jobId: v4Payload.jobId,
        runtimeInstanceId: v4Payload.runtimeInstanceId
      });
    }
  }
}
async function sendSlipwayRuntimeDiagnosticV1(input) {
  const fetchImpl = input.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function")
    return;
  const url = new URL("/api/jobs/runtime-diagnostics", input.bootstrap.slipwayUrl);
  assertSecureRuntimeUrl(url, input.bootstrap.allowInsecureHttp, "Slipway runtime diagnostics");
  let identity;
  try {
    identity = await input.identityProvider?.resolveIdentity({ requireEncryptionKey: false });
  } catch {
    identity = void 0;
  }
  let signature;
  if (input.identityProvider) {
    try {
      const message = slipwayRuntimeDiagnosticRequestMessage({
        applicationId: input.bootstrap.applicationId,
        policyDigest: input.bootstrap.policyDigest,
        deploymentId: input.bootstrap.deploymentId,
        stage: input.diagnostic.stage,
        status: input.diagnostic.status,
        sequence: input.diagnostic.sequence,
        timestampMs: input.diagnostic.timestampMs
      });
      signature = await input.identityProvider.sign(message);
    } catch {
      signature = void 0;
    }
  }
  await postDiagnostic({ ...input, fetchImpl, url, body: {
    domain: SLIPWAY_RUNTIME_DIAGNOSTIC_DOMAIN,
    applicationId: input.bootstrap.applicationId,
    policyDigest: input.bootstrap.policyDigest,
    deploymentId: input.bootstrap.deploymentId,
    token: input.bootstrap.diagnosticsToken,
    signature,
    stage: input.diagnostic.stage,
    status: input.diagnostic.status,
    sequence: input.diagnostic.sequence,
    timestampMs: input.diagnostic.timestampMs,
    jobId: identity?.jobId,
    processorAddress: identity?.processorId,
    component: input.diagnostic.component,
    code: input.diagnostic.code,
    message: input.diagnostic.message ?? input.diagnostic.error,
    attrs: {
      ...input.diagnostic.attrs,
      ...input.diagnostic.valueCount === void 0 ? {} : { valueCount: input.diagnostic.valueCount },
      ...input.diagnostic.revision === void 0 ? {} : { revision: input.diagnostic.revision }
    }
  } });
}
async function postDiagnostic(input) {
  const controller = typeof AbortController === "function" ? new AbortController() : void 0;
  const fetchPromise = input.fetchImpl(input.url.toString(), {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    signal: controller?.signal,
    body: JSON.stringify(input.body)
  });
  const response = await promiseWithTimeout(fetchPromise, diagnosticSendTimeoutMs(input), "Liskov runtime diagnostic send", input, () => controller?.abort());
  if (!response.ok) {
    throw new Error(`Liskov runtime diagnostic rejected request: ${response.status} ${(await response.text()).slice(0, 500)}`);
  }
  const text = await response.text();
  if (!text.trim())
    return void 0;
  try {
    return JSON.parse(text);
  } catch {
    return void 0;
  }
}
function parseRuntimeCeaseControl(value, expected, nowMs) {
  if (value === void 0 || value === null)
    return { error: "control_missing" };
  if (typeof value !== "object" || Array.isArray(value))
    return { error: "control_malformed" };
  const envelope = value;
  if (envelope.schema !== LISKOV_RUNTIME_CONTROL_DOMAIN_V1)
    return { error: "control_schema_invalid" };
  if (typeof envelope.command !== "object" || envelope.command === null || Array.isArray(envelope.command)) {
    return { error: "control_command_malformed" };
  }
  const command = envelope.command;
  if (command.kind !== "cease" || typeof command.commandId !== "string" || command.commandId.length === 0 || typeof command.reason !== "string" || !Number.isSafeInteger(command.issuedAtMs) || !Number.isSafeInteger(command.expiresAtMs) || typeof command.binding !== "object" || command.binding === null || Array.isArray(command.binding)) {
    return { error: "control_command_malformed" };
  }
  if (command.expiresAtMs <= nowMs)
    return { error: "control_expired" };
  const binding = command.binding;
  for (const key of ["applicationUid", "policyDigest", "deploymentId", "jobId", "runtimeInstanceId"]) {
    if (binding[key] !== expected[key])
      return { error: "control_binding_mismatch" };
  }
  return { command };
}
function diagnosticSendTimeoutMs(input) {
  return positiveInteger2(input.diagnosticSendTimeoutMs ?? input.bootstrap?.runtimeHealth?.sendTimeoutMs) ?? DEFAULT_SLIPWAY_RUNTIME_DIAGNOSTIC_SEND_TIMEOUT_MS;
}
function diagnosticRemoteBackoffMs(input) {
  return nonNegativeInteger2(input.diagnosticRemoteBackoffMs) ?? DEFAULT_SLIPWAY_RUNTIME_DIAGNOSTIC_REMOTE_BACKOFF_MS;
}
async function promiseWithTimeout(promise, timeoutMs, label, options, onTimeout) {
  const setTimeoutImpl = options.setTimeoutImpl ?? setTimeout;
  const clearTimeoutImpl = options.clearTimeoutImpl ?? clearTimeout;
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeoutImpl(() => {
          onTimeout?.();
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timer)
      clearTimeoutImpl(timer);
  }
}
function positiveInteger2(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : void 0;
}
function nonNegativeInteger2(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : void 0;
}
function charTruncate(value, max) {
  return [...value].slice(0, max).join("");
}
function boundedRequiredString(value, max, label) {
  const normalized = value.trim();
  if (!normalized)
    throw new Error(`${label} must be a string`);
  return charTruncate(normalized, max);
}
function boundedOptionalString(value, max) {
  const normalized = value?.trim();
  return normalized ? charTruncate(normalized, max) : void 0;
}
function sensitiveKey(key) {
  return /(secret|seed|token|key|dek|cipher|signature|password|mnemonic|private)/iu.test(key);
}
function redactAttrs(attrs) {
  if (!attrs)
    return void 0;
  const out = {};
  for (const [rawKey, rawValue] of Object.entries(attrs).slice(0, MAX_ATTRS)) {
    const key = charTruncate(rawKey.trim(), MAX_ATTR_KEY_LENGTH);
    if (!key || sensitiveKey(key))
      continue;
    if (typeof rawValue === "string") {
      out[key] = redactAttrString(key, rawValue);
    } else if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      out[key] = rawValue;
    } else if (typeof rawValue === "boolean" || rawValue === null) {
      out[key] = rawValue;
    }
  }
  return Object.keys(out).length > 0 ? out : void 0;
}
function redactAttrString(key, value) {
  if (sensitiveKey(key) || /^(0x)?[0-9a-f]{64,}$/iu.test(value) || /^[A-Za-z0-9_-]{80,}$/u.test(value)) {
    return "[redacted]";
  }
  return charTruncate(value, MAX_ATTR_VALUE_LENGTH);
}
function redactDiagnosticMessage(value) {
  const bounded = charTruncate(value.trim(), MAX_MESSAGE_LENGTH);
  return bounded.replace(/(0x)?[0-9a-f]{64,}/giu, "[redacted]").replace(/[A-Za-z0-9_-]{80,}/gu, "[redacted]").replace(/\b(secret|seed|token|private[_-]?key|dek|ciphertext|signature)\s*[:=]\s*[^,\s}]+/giu, "$1=[redacted]");
}
function diagnosticErrorMessage(error) {
  return safeErrorMessage(error);
}

// node_modules/.pnpm/@proof-computer+liskov-runtime@https+++codeload.github.com+proof-computer+liskov-runtim_f15215979215515ddd7379bdd6f54a67/node_modules/@proof-computer/liskov-runtime/dist/env-names.js
var LISKOV_BOOTSTRAP_ENV = "LISKOV_BOOTSTRAP";
var LEGACY_LISKOV_BOOTSTRAP_ENV = "PROOF_SLIPWAY_BOOTSTRAP";
var LISKOV_BOOTSTRAP_ENV_NAMES = [
  LISKOV_BOOTSTRAP_ENV,
  LEGACY_LISKOV_BOOTSTRAP_ENV
];
var LOCKBOX_BOOTSTRAP_ENV = "LISKOV_LOCKBOX_BOOTSTRAP";
var LEGACY_LOCKBOX_BOOTSTRAP_ENV = "PROOF_LOCKBOX_BOOTSTRAP";
var LOCKBOX_BOOTSTRAP_ENV_NAMES = [
  LOCKBOX_BOOTSTRAP_ENV,
  LEGACY_LOCKBOX_BOOTSTRAP_ENV
];

// node_modules/.pnpm/@proof-computer+liskov-runtime@https+++codeload.github.com+proof-computer+liskov-runtim_f15215979215515ddd7379bdd6f54a67/node_modules/@proof-computer/liskov-runtime/dist/lockbox.js
var import_node_buffer5 = require("node:buffer");
var import_promises = require("node:fs/promises");
var import_node_path2 = __toESM(require("node:path"), 1);
var LOCKBOX_RUNTIME_JOB_SECRET_REQUEST_DOMAIN_V1 = "proof.lockbox.job-secret-request.v1";
var LOCKBOX_RUNTIME_JOB_SECRET_REQUEST_DOMAIN_V2 = "proof.lockbox.job-secret-request.v2";
var LOCKBOX_RUNTIME_JOB_SECRET_RESPONSE_DOMAIN_V1 = "proof.lockbox.job-secret-response.v1";
var LOCKBOX_RUNTIME_JOB_SECRET_RESPONSE_DOMAIN_V2 = "proof.lockbox.job-secret-response.v2";
var LOCKBOX_RUNTIME_JOB_SECRET_ENCRYPTED_PAYLOAD_DOMAIN_V1 = "proof.lockbox.job-secret-response.encrypted-payload.v1";
var LOCKBOX_RUNTIME_JOB_SECRET_ENCRYPTED_PAYLOAD_DOMAIN_V2 = "proof.lockbox.job-secret-response.encrypted-payload.v2";
var LOCKBOX_RUNTIME_JOB_SECRET_AAD_DOMAIN_V2 = "proof.lockbox.job-secret-response.aad.v2";
function readLockboxRuntimeConfig(options = {}) {
  const compact = getFirstRuntimeEnvValue(LOCKBOX_BOOTSTRAP_ENV_NAMES, options);
  if (compact !== void 0)
    return lockboxRuntimeConfigFromBootstrap(compact, options);
  const lockboxUrl = getRuntimeEnvValue("PROOF_LOCKBOX_URL", options);
  if (!lockboxUrl)
    return void 0;
  const secretIds = getRuntimeEnvValue("PROOF_LOCKBOX_SECRET_IDS", options) ?? getRuntimeEnvValue("PROOF_LOCKBOX_REQUESTED_SECRET_IDS", options);
  return {
    lockboxUrl,
    applicationUid: getRuntimeEnvValue("LISKOV_APPLICATION_UID", options),
    applicationId: requiredRuntimeEnvValue("PROOF_LOCKBOX_APPLICATION_ID", options),
    grantId: requiredRuntimeEnvValue("PROOF_LOCKBOX_GRANT_ID", options),
    policyDigest: normalizePolicyDigest(requiredRuntimeEnvValue("PROOF_LOCKBOX_POLICY_DIGEST", options)),
    deploymentId: requiredRuntimeEnvValue("PROOF_LOCKBOX_DEPLOYMENT_ID", options),
    requestedSecretIds: parseStringArrayOrCsv(secretIds, "PROOF_LOCKBOX_SECRET_IDS"),
    allowInsecureHttp: optionalBooleanEnv("PROOF_LOCKBOX_ALLOW_INSECURE_HTTP", options),
    fileBaseDir: getRuntimeEnvValue("PROOF_LOCKBOX_FILE_BASE_DIR", options),
    requestTtlMs: optionalIntegerEnv("PROOF_LOCKBOX_REQUEST_TTL_MS", options),
    overwriteEnv: optionalBooleanEnv("PROOF_LOCKBOX_OVERWRITE_ENV", options)
  };
}
function lockboxRuntimeConfigFromBootstrap(rawBootstrap, options = {}) {
  const record = asRecord(parseJson(rawBootstrap, LOCKBOX_BOOTSTRAP_ENV), LOCKBOX_BOOTSTRAP_ENV);
  const secretIds = record.s ?? record.secretIds ?? record.requestedSecretIds;
  return {
    lockboxUrl: requiredStringAlias(record, "u", "url", "lockboxUrl"),
    ...bootstrapApplicationUid(record) === void 0 ? {} : { applicationUid: bootstrapApplicationUid(record) },
    applicationId: requiredStringAlias(record, "a", "applicationId"),
    grantId: requiredStringAlias(record, "g", "grantId"),
    policyDigest: normalizePolicyDigest(requiredStringAlias(record, "p", "policyDigest")),
    deploymentId: requiredStringAlias(record, "d", "deploymentId"),
    requestedSecretIds: parseStringArrayOrCsv(secretIds, `${LOCKBOX_BOOTSTRAP_ENV}.s`),
    allowInsecureHttp: Boolean(optionalBooleanEnv("PROOF_LOCKBOX_ALLOW_INSECURE_HTTP", options) ?? record.allowInsecureHttp),
    fileBaseDir: typeof record.f === "string" ? record.f : typeof record.fileBaseDir === "string" ? record.fileBaseDir : void 0,
    requestTtlMs: optionalIntegerEnv("PROOF_LOCKBOX_REQUEST_TTL_MS", options),
    overwriteEnv: optionalBooleanEnv("PROOF_LOCKBOX_OVERWRITE_ENV", options)
  };
}
function bootstrapApplicationUid(record) {
  if (typeof record.uid === "string" && record.uid.length > 0)
    return record.uid;
  if (typeof record.applicationUid === "string" && record.applicationUid.length > 0) {
    return record.applicationUid;
  }
  return void 0;
}
async function buildLockboxRuntimeJobSecretRequest(input) {
  const identity = await input.identityProvider.resolveIdentity({ requireEncryptionKey: true });
  const nowMs = input.nowMs ?? Date.now();
  const domain = input.config.applicationUid ? LOCKBOX_RUNTIME_JOB_SECRET_REQUEST_DOMAIN_V2 : LOCKBOX_RUNTIME_JOB_SECRET_REQUEST_DOMAIN_V1;
  const request = canonicalLockboxRuntimeJobSecretRequest({
    domain,
    applicationUid: input.config.applicationUid,
    applicationId: input.config.applicationId,
    grantId: input.config.grantId,
    policyDigest: input.config.policyDigest,
    jobId: identity.jobId,
    deploymentId: input.config.deploymentId,
    processorId: identity.processorId,
    requestedSecretIds: normalizeRequestedSecretIds(input.config.requestedSecretIds),
    nonce: input.nonce ?? input.config.nonce ?? randomHex(16, input.randomBytes),
    issuedAtMs: nowMs,
    expiresAtMs: nowMs + (input.config.requestTtlMs ?? 6e4),
    responseEncryptionKey: normalizeHexNoPrefix(identity.responseEncryptionKey)
  });
  return {
    ...request,
    signature: await input.identityProvider.sign(lockboxRuntimeJobSecretRequestMessage(request))
  };
}
function canonicalLockboxRuntimeJobSecretRequest(request) {
  const { signature: _signature, ...unsigned } = request;
  const domain = lockboxRequestDomain(unsigned.domain);
  const canonical = {
    domain,
    applicationId: requiredString(unsigned, "applicationId"),
    grantId: requiredString(unsigned, "grantId"),
    policyDigest: normalizePolicyDigest(unsigned.policyDigest),
    jobId: requiredString(unsigned, "jobId"),
    deploymentId: requiredString(unsigned, "deploymentId"),
    processorId: requiredString(unsigned, "processorId"),
    requestedSecretIds: normalizeRequestedSecretIds(unsigned.requestedSecretIds),
    nonce: requiredString(unsigned, "nonce"),
    issuedAtMs: integerTimestamp(unsigned.issuedAtMs, "issuedAtMs"),
    expiresAtMs: integerTimestamp(unsigned.expiresAtMs, "expiresAtMs"),
    responseEncryptionKey: normalizeHexNoPrefix(unsigned.responseEncryptionKey)
  };
  if (domain === LOCKBOX_RUNTIME_JOB_SECRET_REQUEST_DOMAIN_V2) {
    canonical.applicationUid = requiredString(unsigned, "applicationUid");
  }
  return canonical;
}
function lockboxRuntimeJobSecretRequestMessage(request) {
  return import_node_buffer5.Buffer.from(canonicalJson(canonicalLockboxRuntimeJobSecretRequest(request)), "utf8");
}
async function loadLockboxRuntimeSecrets(input) {
  try {
    const fetchImpl = input.fetchImpl ?? globalThis.fetch;
    if (typeof fetchImpl !== "function")
      throw new Error("fetch is required for Lockbox runtime secrets");
    const request = await buildLockboxRuntimeJobSecretRequest({
      identityProvider: input.identityProvider,
      config: input.config,
      nowMs: input.nowMs?.() ?? Date.now(),
      randomBytes: input.randomBytes
    });
    await emit(input.diagnostics, {
      phase: "identity_resolved",
      ok: true,
      applicationId: request.applicationId,
      grantId: request.grantId,
      attrs: {
        hasJobId: Boolean(request.jobId),
        hasProcessorId: Boolean(request.processorId),
        hasResponseEncryptionKey: Boolean(request.responseEncryptionKey)
      }
    });
    await emit(input.diagnostics, {
      phase: "request_signed",
      ok: true,
      applicationId: request.applicationId,
      grantId: request.grantId,
      secretCount: request.requestedSecretIds.length
    });
    const response = await postLockboxRuntimeJobSecretRequest({ ...input, fetchImpl, request });
    const payload = await decryptAndVerifyLockboxRuntimePayload({
      identityProvider: input.identityProvider,
      request,
      response
    });
    await emit(input.diagnostics, {
      phase: "payload_decrypted",
      ok: true,
      applicationId: payload.applicationId,
      grantId: payload.grantId,
      requestId: payload.requestId,
      secretCount: payload.secrets.length,
      attrs: {
        requestId: payload.requestId,
        secretCount: payload.secrets.length
      }
    });
    const installed = await installLockboxRuntimeSecrets({
      payload,
      env: input.env ?? process.env,
      fileBaseDir: input.config.fileBaseDir,
      overwriteEnv: input.config.overwriteEnv ?? false,
      files: input.files
    });
    await emit(input.diagnostics, {
      phase: "secrets_installed",
      ok: true,
      applicationId: payload.applicationId,
      grantId: payload.grantId,
      requestId: payload.requestId,
      secretCount: payload.secrets.length,
      installedEnvCount: installed.env.length,
      installedFileCount: installed.files.length,
      skippedEnvCount: installed.skippedExistingEnv.length,
      attrs: {
        secretCount: payload.secrets.length,
        installedEnvCount: installed.env.length,
        installedFileCount: installed.files.length,
        skippedEnvCount: installed.skippedExistingEnv.length
      }
    });
    return { request, response, installed };
  } catch (error) {
    await emit(input.diagnostics, {
      phase: "bootstrap_failed",
      ok: false,
      applicationId: input.config.applicationId,
      grantId: input.config.grantId,
      errorCode: safeErrorMessage(error)
    });
    throw error;
  }
}
async function decryptAndVerifyLockboxRuntimePayload(input) {
  const encryptedPayload = parseLockboxEncryptedPayload(input.response.encryptedPayload);
  const encryptedPayloadBase = { ...encryptedPayload };
  delete encryptedPayloadBase.encryptedPayloadDigest;
  if (!digestMatches(canonicalJson(encryptedPayloadBase), encryptedPayload.encryptedPayloadDigest)) {
    throw new Error("Lockbox encrypted payload digest mismatch");
  }
  if (input.request.domain === LOCKBOX_RUNTIME_JOB_SECRET_REQUEST_DOMAIN_V2) {
    const aad = lockboxRuntimeResponseAad({ request: input.request, response: input.response });
    if (encryptedPayload.aadDigest !== sha256Digest(aad)) {
      throw new Error("Lockbox encrypted payload AAD binding mismatch");
    }
  }
  const plaintextBytes = await input.identityProvider.decryptGrantPayload(encryptedPayload);
  const plaintextText = import_node_buffer5.Buffer.from(plaintextBytes).toString("utf8");
  if (!digestMatches(plaintextText, encryptedPayload.plaintextDigest)) {
    throw new Error("Lockbox plaintext digest mismatch");
  }
  const payload = parseLockboxPlaintextPayload(parseJson(plaintextText, "Lockbox plaintext payload"));
  assertLockboxPayloadBinding({ request: input.request, response: input.response, payload });
  return payload;
}
async function installLockboxRuntimeSecrets(input) {
  const env = input.env ?? process.env;
  const files = input.files ?? { mkdir: import_promises.mkdir, writeFile: import_promises.writeFile, chmod: import_promises.chmod };
  const installed = { env: [], files: [], skippedExistingEnv: [] };
  for (const secret of input.payload.secrets) {
    const record = installedSecret(secret);
    if (secret.target === "env") {
      const name = validEnvName(secret.name);
      if (env[name] !== void 0 && input.overwriteEnv !== true) {
        installed.skippedExistingEnv.push(record);
        continue;
      }
      env[name] = secret.value;
      installed.env.push(record);
      continue;
    }
    if (!input.fileBaseDir)
      throw new Error("file-target Lockbox secrets require fileBaseDir");
    const targetPath = safeSecretFilePath(input.fileBaseDir, secret.name);
    await files.mkdir(import_node_path2.default.dirname(targetPath), { recursive: true });
    await files.writeFile(targetPath, secret.value, { encoding: "utf8", mode: 384 });
    await files.chmod(targetPath, 384);
    installed.files.push(record);
  }
  return installed;
}
async function postLockboxRuntimeJobSecretRequest(input) {
  const url = new URL("/api/jobs/secret-requests", input.config.lockboxUrl);
  assertSecureRuntimeUrl(url, input.config.allowInsecureHttp, "Lockbox runtime secrets");
  await emit(input.diagnostics, {
    phase: "lockbox_request",
    ok: true,
    applicationId: input.request.applicationId,
    grantId: input.request.grantId,
    secretCount: input.request.requestedSecretIds.length,
    attrs: {
      lockboxHost: url.hostname,
      lockboxProtocol: url.protocol.replace(/:$/u, "")
    }
  });
  const response = await input.fetchImpl(url.toString(), {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(input.request)
  });
  const text = await response.text();
  const body = response.ok ? parseJson(text, "Lockbox response") : parseJsonOrUndefined2(text);
  if (!response.ok) {
    await emit(input.diagnostics, {
      phase: "lockbox_response",
      ok: false,
      status: response.status,
      applicationId: input.request.applicationId,
      grantId: input.request.grantId,
      secretCount: input.request.requestedSecretIds.length,
      attrs: {
        statusCode: response.status,
        errorCode: stringField2(body, "error"),
        retryable: booleanField(body, "retryable")
      }
    });
    throw new Error(`Lockbox rejected secret request: ${response.status} ${text.slice(0, 500)}`);
  }
  const parsed = parseLockboxRuntimeJobSecretResponse(body);
  assertLockboxResponseBinding({ request: input.request, response: parsed });
  await emit(input.diagnostics, {
    phase: "lockbox_response",
    ok: true,
    status: response.status,
    applicationId: parsed.applicationId,
    grantId: parsed.grantId,
    requestId: parsed.requestId,
    secretCount: parsed.secretVersions.length,
    attrs: { statusCode: response.status }
  });
  return parsed;
}
function parseLockboxRuntimeJobSecretResponse(value) {
  const record = asRecord(value, "Lockbox job secret response");
  if (record.ok !== true)
    throw new Error("Lockbox response did not include ok=true");
  const domain = record.domain === void 0 ? void 0 : record.domain === LOCKBOX_RUNTIME_JOB_SECRET_RESPONSE_DOMAIN_V2 ? LOCKBOX_RUNTIME_JOB_SECRET_RESPONSE_DOMAIN_V2 : (() => {
    throw new Error("Lockbox response has an unsupported domain");
  })();
  return {
    ok: true,
    ...domain === void 0 ? {} : { domain },
    requestId: requiredString(record, "requestId"),
    grantId: requiredString(record, "grantId"),
    ...domain === LOCKBOX_RUNTIME_JOB_SECRET_RESPONSE_DOMAIN_V2 ? { applicationUid: requiredString(record, "applicationUid") } : {},
    applicationId: requiredString(record, "applicationId"),
    repository: requiredString(record, "repository"),
    policyDigest: normalizePolicyDigest(requiredString(record, "policyDigest")),
    jobId: requiredString(record, "jobId"),
    deploymentId: requiredString(record, "deploymentId"),
    processorId: requiredString(record, "processorId"),
    requestedSecretIds: normalizeRequestedSecretIds(requiredStringArray2(record, "requestedSecretIds")),
    responseKeyDigest: requiredString(record, "responseKeyDigest"),
    secretVersions: parseSecretVersionMetadata(record.secretVersions),
    encryptedPayload: parseLockboxEncryptedPayload(record.encryptedPayload)
  };
}
function parseLockboxPlaintextPayload(value) {
  const record = asRecord(value, "Lockbox plaintext payload");
  const domain = lockboxResponseDomain(record.domain);
  return {
    domain,
    requestId: requiredString(record, "requestId"),
    grantId: requiredString(record, "grantId"),
    ...domain === LOCKBOX_RUNTIME_JOB_SECRET_RESPONSE_DOMAIN_V2 ? { applicationUid: requiredString(record, "applicationUid") } : {},
    applicationId: requiredString(record, "applicationId"),
    repository: requiredString(record, "repository"),
    policyDigest: normalizePolicyDigest(requiredString(record, "policyDigest")),
    jobId: requiredString(record, "jobId"),
    deploymentId: requiredString(record, "deploymentId"),
    processorId: requiredString(record, "processorId"),
    issuedAtMs: integerTimestamp(requiredNumber(record, "issuedAtMs"), "issuedAtMs"),
    secrets: parsePlaintextSecrets(record.secrets)
  };
}
function parseLockboxEncryptedPayload(value) {
  const record = asRecord(value, "Lockbox encrypted payload");
  const domain = lockboxEncryptedPayloadDomain(record.domain);
  const version = requiredString(record, "version");
  const curveName = requiredString(record, "curveName");
  const expectedVersion = domain === LOCKBOX_RUNTIME_JOB_SECRET_ENCRYPTED_PAYLOAD_DOMAIN_V2 ? "acurast-p256-hkdf-aes-256-gcm-v2" : "acurast-p256-hkdf-aes-256-gcm-v1";
  if (version !== expectedVersion)
    throw new Error("Lockbox encrypted payload has an unsupported version");
  if (curveName !== "secp256r1")
    throw new Error("Lockbox encrypted payload has an unsupported curve");
  return {
    domain,
    version,
    curveName,
    senderPublicKey: requiredString(record, "senderPublicKey"),
    saltHex: requiredString(record, "saltHex"),
    ciphertextHex: requiredString(record, "ciphertextHex"),
    plaintextDigest: requiredString(record, "plaintextDigest"),
    ...domain === LOCKBOX_RUNTIME_JOB_SECRET_ENCRYPTED_PAYLOAD_DOMAIN_V2 ? { aadDigest: requiredString(record, "aadDigest") } : {},
    encryptedPayloadDigest: requiredString(record, "encryptedPayloadDigest")
  };
}
function assertLockboxResponseBinding(input) {
  const request = canonicalLockboxRuntimeJobSecretRequest(input.request);
  const response = input.response;
  const expectedDomain = request.domain === LOCKBOX_RUNTIME_JOB_SECRET_REQUEST_DOMAIN_V2 ? LOCKBOX_RUNTIME_JOB_SECRET_RESPONSE_DOMAIN_V2 : void 0;
  if (response.domain !== expectedDomain) {
    throw new Error("Lockbox response attempted a protocol downgrade");
  }
  const expected = [
    ...request.domain === LOCKBOX_RUNTIME_JOB_SECRET_REQUEST_DOMAIN_V2 ? [[response.applicationUid, request.applicationUid, "applicationUid"]] : [],
    [response.grantId, request.grantId, "grantId"],
    [response.applicationId, request.applicationId, "applicationId"],
    [response.policyDigest, request.policyDigest, "policyDigest"],
    [response.jobId, request.jobId, "jobId"],
    [response.deploymentId, request.deploymentId, "deploymentId"],
    [response.processorId, request.processorId, "processorId"],
    [response.requestedSecretIds.join(","), request.requestedSecretIds.join(","), "requestedSecretIds"]
  ];
  for (const [actual, wanted, label] of expected) {
    if (actual !== wanted)
      throw new Error(`Lockbox response ${label} did not match the signed request`);
  }
}
function assertLockboxPayloadBinding(input) {
  assertLockboxResponseBinding({ request: input.request, response: input.response });
  const request = canonicalLockboxRuntimeJobSecretRequest(input.request);
  const expectedPayloadDomain = request.domain === LOCKBOX_RUNTIME_JOB_SECRET_REQUEST_DOMAIN_V2 ? LOCKBOX_RUNTIME_JOB_SECRET_RESPONSE_DOMAIN_V2 : LOCKBOX_RUNTIME_JOB_SECRET_RESPONSE_DOMAIN_V1;
  if (input.payload.domain !== expectedPayloadDomain) {
    throw new Error("Lockbox plaintext payload attempted a protocol downgrade");
  }
  const expected = [
    ...request.domain === LOCKBOX_RUNTIME_JOB_SECRET_REQUEST_DOMAIN_V2 ? [[input.payload.applicationUid, request.applicationUid, "applicationUid"]] : [],
    [input.payload.requestId, input.response.requestId, "requestId"],
    [input.payload.grantId, request.grantId, "grantId"],
    [input.payload.applicationId, request.applicationId, "applicationId"],
    [input.payload.policyDigest, request.policyDigest, "policyDigest"],
    [input.payload.jobId, request.jobId, "jobId"],
    [input.payload.deploymentId, request.deploymentId, "deploymentId"],
    [input.payload.processorId, request.processorId, "processorId"]
  ];
  for (const [actual, wanted, label] of expected) {
    if (actual !== wanted)
      throw new Error(`Lockbox plaintext payload ${label} did not match the signed request`);
  }
  const requested = new Set(request.requestedSecretIds);
  for (const secret of input.payload.secrets) {
    if (!requested.has(secret.secretId)) {
      throw new Error("Lockbox plaintext payload included a secret that was not requested");
    }
  }
}
function parsePlaintextSecrets(value) {
  if (!Array.isArray(value))
    throw new Error("Lockbox plaintext payload secrets must be an array");
  return value.map((item) => {
    const record = asRecord(item, "Lockbox plaintext secret");
    const target = requiredString(record, "target");
    if (target !== "env" && target !== "file")
      throw new Error("Lockbox plaintext secret target must be env or file");
    return {
      secretId: requiredString(record, "secretId"),
      versionId: requiredString(record, "versionId"),
      target,
      name: requiredString(record, "name"),
      required: requiredBoolean(record, "required"),
      bundleId: requiredString(record, "bundleId"),
      value: requiredString(record, "value")
    };
  });
}
function parseSecretVersionMetadata(value) {
  if (!Array.isArray(value))
    throw new Error("Lockbox response secretVersions must be an array");
  return value.map((item) => {
    const record = asRecord(item, "Lockbox secret version metadata");
    const target = requiredString(record, "target");
    if (target !== "env" && target !== "file")
      throw new Error("Lockbox secret version target must be env or file");
    return {
      secretId: requiredString(record, "secretId"),
      versionId: requiredString(record, "versionId"),
      target,
      name: requiredString(record, "name"),
      required: requiredBoolean(record, "required"),
      bundleId: requiredString(record, "bundleId"),
      encryptedPayloadDigest: typeof record.encryptedPayloadDigest === "string" ? record.encryptedPayloadDigest : void 0
    };
  });
}
function requiredStringArray2(record, field) {
  const value = record[field];
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`${field} must be a string array`);
  }
  return value;
}
function stringField2(value, field) {
  const record = value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
  const fieldValue = record[field];
  return typeof fieldValue === "string" && fieldValue.length > 0 ? fieldValue : null;
}
function booleanField(value, field) {
  const record = value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
  const fieldValue = record[field];
  return typeof fieldValue === "boolean" ? fieldValue : null;
}
function parseJsonOrUndefined2(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return void 0;
  }
}
function safeSecretFilePath(baseDir, name) {
  const cleanName = validSecretFileName(name);
  const base = import_node_path2.default.resolve(baseDir);
  const target = import_node_path2.default.resolve(base, cleanName);
  const relative = import_node_path2.default.relative(base, target);
  if (relative === "" || relative.startsWith("..") || import_node_path2.default.isAbsolute(relative)) {
    throw new Error("file secret path escapes the configured base directory");
  }
  return target;
}
function validSecretFileName(name) {
  if (name.length === 0 || name.includes("\0"))
    throw new Error("file secret name is invalid");
  return name;
}
function installedSecret(secret) {
  return {
    secretId: secret.secretId,
    versionId: secret.versionId,
    target: secret.target,
    name: secret.name,
    bundleId: secret.bundleId
  };
}
async function emit(diagnostics, event) {
  await Promise.resolve(diagnostics?.(event));
}
function lockboxRuntimeResponseAad(input) {
  const request = canonicalLockboxRuntimeJobSecretRequest(input.request);
  if (request.domain !== LOCKBOX_RUNTIME_JOB_SECRET_REQUEST_DOMAIN_V2) {
    throw new Error("Lockbox response AAD v2 requires a v2 request");
  }
  return canonicalJson({
    domain: LOCKBOX_RUNTIME_JOB_SECRET_AAD_DOMAIN_V2,
    requestId: input.response.requestId,
    applicationUid: request.applicationUid,
    applicationId: request.applicationId,
    grantId: request.grantId,
    policyDigest: request.policyDigest,
    jobId: request.jobId,
    deploymentId: request.deploymentId,
    processorId: request.processorId
  });
}
function lockboxRequestDomain(value) {
  if (value === LOCKBOX_RUNTIME_JOB_SECRET_REQUEST_DOMAIN_V1 || value === LOCKBOX_RUNTIME_JOB_SECRET_REQUEST_DOMAIN_V2) {
    return value;
  }
  throw new Error("Lockbox request has an unsupported domain");
}
function lockboxResponseDomain(value) {
  if (value === LOCKBOX_RUNTIME_JOB_SECRET_RESPONSE_DOMAIN_V1 || value === LOCKBOX_RUNTIME_JOB_SECRET_RESPONSE_DOMAIN_V2) {
    return value;
  }
  throw new Error("Lockbox plaintext payload has an unsupported domain");
}
function lockboxEncryptedPayloadDomain(value) {
  if (value === LOCKBOX_RUNTIME_JOB_SECRET_ENCRYPTED_PAYLOAD_DOMAIN_V1 || value === LOCKBOX_RUNTIME_JOB_SECRET_ENCRYPTED_PAYLOAD_DOMAIN_V2) {
    return value;
  }
  throw new Error("Lockbox encrypted payload has an unsupported domain");
}

// node_modules/.pnpm/@proof-computer+liskov-runtime@https+++codeload.github.com+proof-computer+liskov-runtim_f15215979215515ddd7379bdd6f54a67/node_modules/@proof-computer/liskov-runtime/dist/runtime-env.js
var import_node_buffer6 = require("node:buffer");
var SLIPWAY_RUNTIME_ENV_REQUEST_DOMAIN_V1 = "proof.slipway.runtime-env-request.v1";
var SLIPWAY_RUNTIME_ENV_REQUEST_DOMAIN_V2 = "proof.liskov.runtime-env-request.v2";
var SLIPWAY_RUNTIME_ENV_RESPONSE_DOMAIN_V1 = "proof.slipway.runtime-env-response.v1";
var SLIPWAY_RUNTIME_ENV_RESPONSE_DOMAIN_V2 = "proof.liskov.runtime-env-response.v2";
function readSlipwayRuntimeEnvConfig(options = {}) {
  const raw = getFirstRuntimeEnvValue(LISKOV_BOOTSTRAP_ENV_NAMES, options);
  if (!raw)
    return void 0;
  return slipwayRuntimeEnvConfigFromBootstrap(raw, options);
}
function slipwayRuntimeEnvConfigFromBootstrap(rawBootstrap, options = {}) {
  const record = asRecord(JSON.parse(rawBootstrap), LISKOV_BOOTSTRAP_ENV);
  return {
    slipwayUrl: requiredStringAlias(record, "u", "url", "slipwayUrl"),
    ...bootstrapApplicationUid2(record) === void 0 ? {} : { applicationUid: bootstrapApplicationUid2(record) },
    applicationId: requiredStringAlias(record, "a", "applicationId"),
    policyDigest: normalizePolicyDigest(requiredStringAlias(record, "p", "policyDigest")),
    deploymentId: requiredStringAlias(record, "d", "deploymentId"),
    diagnosticsToken: diagnosticsTokenFromBootstrap(record),
    runtimeHealth: runtimeHealthConfigFromBootstrap(record, options),
    allowInsecureHttp: Boolean(optionalBooleanEnv("PROOF_SLIPWAY_RUNTIME_ENV_ALLOW_INSECURE_HTTP", options) ?? record.allowInsecureHttp),
    requestTtlMs: optionalIntegerEnv("PROOF_SLIPWAY_RUNTIME_ENV_REQUEST_TTL_MS", options),
    nonce: getRuntimeEnvValue("PROOF_SLIPWAY_RUNTIME_ENV_NONCE", options)
  };
}
function bootstrapApplicationUid2(record) {
  if (typeof record.uid === "string" && record.uid.length > 0)
    return record.uid;
  if (typeof record.applicationUid === "string" && record.applicationUid.length > 0) {
    return record.applicationUid;
  }
  return void 0;
}
async function buildSlipwayRuntimeEnvRequest(input) {
  const identity = await input.identityProvider.resolveIdentity({ requireEncryptionKey: false });
  const nowMs = input.nowMs ?? Date.now();
  const domain = input.config.applicationUid ? SLIPWAY_RUNTIME_ENV_REQUEST_DOMAIN_V2 : SLIPWAY_RUNTIME_ENV_REQUEST_DOMAIN_V1;
  const request = canonicalSlipwayRuntimeEnvRequest({
    domain,
    applicationUid: input.config.applicationUid,
    applicationId: input.config.applicationId,
    policyDigest: input.config.policyDigest,
    jobId: identity.jobId,
    deploymentId: input.config.deploymentId,
    processorId: identity.processorId,
    nonce: input.nonce ?? input.config.nonce ?? randomHex(16, input.randomBytes),
    issuedAtMs: nowMs,
    expiresAtMs: nowMs + (input.config.requestTtlMs ?? 6e4)
  });
  return {
    ...request,
    signature: await input.identityProvider.sign(slipwayRuntimeEnvRequestMessage(request))
  };
}
function canonicalSlipwayRuntimeEnvRequest(request) {
  const { signature: _signature, ...unsigned } = request;
  const domain = runtimeEnvRequestDomain(unsigned.domain);
  const canonical = {
    domain,
    applicationId: requiredString(unsigned, "applicationId"),
    policyDigest: normalizePolicyDigest(unsigned.policyDigest),
    jobId: requiredString(unsigned, "jobId"),
    deploymentId: requiredString(unsigned, "deploymentId"),
    processorId: requiredString(unsigned, "processorId"),
    nonce: requiredString(unsigned, "nonce"),
    issuedAtMs: integerTimestamp(unsigned.issuedAtMs, "issuedAtMs"),
    expiresAtMs: integerTimestamp(unsigned.expiresAtMs, "expiresAtMs")
  };
  if (domain === SLIPWAY_RUNTIME_ENV_REQUEST_DOMAIN_V2) {
    canonical.applicationUid = requiredString(unsigned, "applicationUid");
  }
  return canonical;
}
function slipwayRuntimeEnvRequestMessage(request) {
  return import_node_buffer6.Buffer.from(canonicalJson(canonicalSlipwayRuntimeEnvRequest(request)), "utf8");
}
async function loadSlipwayRuntimeEnv(input) {
  try {
    const fetchImpl = input.fetchImpl ?? globalThis.fetch;
    if (typeof fetchImpl !== "function")
      throw new Error("fetch is required for Slipway runtime env bootstrap");
    const identity = await input.identityProvider.resolveIdentity({ requireEncryptionKey: false });
    await emit2(input.diagnostics, {
      phase: "identity_resolved",
      ok: true,
      applicationId: input.config.applicationId,
      attrs: {
        hasJobId: Boolean(identity.jobId),
        hasProcessorId: Boolean(identity.processorId)
      }
    });
    const request = await buildSlipwayRuntimeEnvRequest({
      identityProvider: input.identityProvider,
      config: input.config,
      nowMs: input.nowMs?.() ?? Date.now(),
      randomBytes: input.randomBytes
    });
    await emit2(input.diagnostics, { phase: "request_signed", ok: true, applicationId: request.applicationId });
    const response = await postSlipwayRuntimeEnvRequest({ ...input, fetchImpl, request });
    assertSlipwayRuntimeEnvBinding({ request, response });
    const installed = installSlipwayRuntimeEnv({ response, env: input.env ?? process.env });
    await emit2(input.diagnostics, {
      phase: "env_installed",
      ok: true,
      applicationId: response.applicationId,
      revision: response.revision,
      valueCount: installed.length,
      attrs: { valueCount: installed.length }
    });
    void identity;
    return { request, response, installed };
  } catch (error) {
    await emit2(input.diagnostics, {
      phase: "runtime_env_request",
      ok: false,
      applicationId: input.config.applicationId,
      errorCode: safeErrorMessage(error)
    });
    throw error;
  }
}
function installSlipwayRuntimeEnv(input) {
  if (![SLIPWAY_RUNTIME_ENV_RESPONSE_DOMAIN_V1, SLIPWAY_RUNTIME_ENV_RESPONSE_DOMAIN_V2].includes(input.response.domain) || input.response.ok !== true) {
    throw new Error("Slipway runtime env response did not include ok=true");
  }
  const env = input.env ?? process.env;
  const installed = [];
  for (const [name, value] of Object.entries(input.response.values)) {
    env[validEnvName(name)] = value;
    installed.push(name);
  }
  return installed.sort((left, right) => left.localeCompare(right));
}
function startSlipwayRuntimeEnvRefresh(input) {
  const setTimeoutImpl = input.setTimeoutImpl ?? setTimeout;
  const clearTimeoutImpl = input.clearTimeoutImpl ?? clearTimeout;
  let stopped = false;
  let timer;
  let inflight;
  const refreshNow = async () => {
    inflight ??= loadSlipwayRuntimeEnv(input).finally(() => {
      inflight = void 0;
    });
    return inflight;
  };
  const schedule = () => {
    if (stopped)
      return;
    if (timer)
      clearTimeoutImpl(timer);
    timer = setTimeoutImpl(() => {
      void refreshNow().catch((error) => emit2(input.diagnostics, {
        phase: "refresh_failed",
        ok: false,
        applicationId: input.config.applicationId,
        errorCode: safeErrorMessage(error)
      })).finally(schedule);
    }, 3e4);
    timer.unref?.();
  };
  schedule();
  return {
    stop() {
      stopped = true;
      if (timer)
        clearTimeoutImpl(timer);
    },
    refreshNow
  };
}
async function postSlipwayRuntimeEnvRequest(input) {
  const url = new URL("/api/jobs/runtime-env", input.config.slipwayUrl);
  assertSecureRuntimeUrl(url, input.config.allowInsecureHttp, "Slipway runtime env");
  await emit2(input.diagnostics, {
    phase: "runtime_env_request",
    ok: true,
    applicationId: input.request.applicationId,
    attrs: {
      slipwayHost: url.hostname,
      slipwayProtocol: url.protocol.replace(/:$/u, "")
    }
  });
  const response = await input.fetchImpl(url.toString(), {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(input.request)
  });
  const text = await response.text();
  const body = JSON.parse(text);
  if (!response.ok) {
    await emit2(input.diagnostics, {
      phase: "runtime_env_response",
      ok: false,
      status: response.status,
      applicationId: input.request.applicationId,
      attrs: { statusCode: response.status }
    });
    throw new Error(`Slipway runtime env rejected request: ${response.status} ${text.slice(0, 500)}`);
  }
  const parsed = parseSlipwayRuntimeEnvResponse(body);
  await emit2(input.diagnostics, {
    phase: "runtime_env_response",
    ok: true,
    status: response.status,
    applicationId: parsed.applicationId,
    revision: parsed.revision,
    valueCount: Object.keys(parsed.values).length,
    attrs: { statusCode: response.status }
  });
  return parsed;
}
function parseSlipwayRuntimeEnvResponse(value) {
  const record = asRecord(value, "Slipway runtime env response");
  const domain = runtimeEnvResponseDomain(record.domain);
  if (record.ok !== true) {
    throw new Error("Slipway runtime env response has an unsupported domain");
  }
  return {
    ok: true,
    domain,
    requestId: requiredString(record, "requestId"),
    ...domain === SLIPWAY_RUNTIME_ENV_RESPONSE_DOMAIN_V2 ? { applicationUid: requiredString(record, "applicationUid") } : {},
    applicationId: requiredString(record, "applicationId"),
    policyDigest: normalizePolicyDigest(requiredString(record, "policyDigest")),
    jobId: requiredString(record, "jobId"),
    deploymentId: requiredString(record, "deploymentId"),
    processorId: requiredString(record, "processorId"),
    revision: requiredString(record, "revision"),
    issuedAtMs: integerTimestamp(record.issuedAtMs, "issuedAtMs"),
    expiresAtMs: integerTimestamp(record.expiresAtMs, "expiresAtMs"),
    refreshAfterMs: integerTimestamp(record.refreshAfterMs, "refreshAfterMs"),
    values: stringRecord(asRecord(record.values, "values"), "values")
  };
}
function assertSlipwayRuntimeEnvBinding(input) {
  const expectedDomain = input.request.domain === SLIPWAY_RUNTIME_ENV_REQUEST_DOMAIN_V2 ? SLIPWAY_RUNTIME_ENV_RESPONSE_DOMAIN_V2 : SLIPWAY_RUNTIME_ENV_RESPONSE_DOMAIN_V1;
  if (input.response.domain !== expectedDomain) {
    throw new Error("Slipway runtime env response attempted a protocol downgrade");
  }
  const expected = [
    ...input.request.domain === SLIPWAY_RUNTIME_ENV_REQUEST_DOMAIN_V2 ? [[input.response.applicationUid, input.request.applicationUid, "applicationUid"]] : [],
    [input.response.applicationId, input.request.applicationId, "applicationId"],
    [input.response.policyDigest, input.request.policyDigest, "policyDigest"],
    [input.response.jobId, input.request.jobId, "jobId"],
    [input.response.deploymentId, input.request.deploymentId, "deploymentId"],
    [input.response.processorId, input.request.processorId, "processorId"]
  ];
  for (const [actual, wanted, label] of expected) {
    if (actual !== wanted)
      throw new Error(`Slipway runtime env response ${label} did not match the signed request`);
  }
}
function runtimeEnvRequestDomain(value) {
  if (value === SLIPWAY_RUNTIME_ENV_REQUEST_DOMAIN_V1 || value === SLIPWAY_RUNTIME_ENV_REQUEST_DOMAIN_V2) {
    return value;
  }
  throw new Error("Slipway runtime env request has an unsupported domain");
}
function runtimeEnvResponseDomain(value) {
  if (value === SLIPWAY_RUNTIME_ENV_RESPONSE_DOMAIN_V1 || value === SLIPWAY_RUNTIME_ENV_RESPONSE_DOMAIN_V2) {
    return value;
  }
  throw new Error("Slipway runtime env response has an unsupported domain");
}
function diagnosticsTokenFromBootstrap(record) {
  const diagnostics = recordOrUndefined(record.x) ?? recordOrUndefined(record.diagnostics);
  const token = diagnostics?.t ?? diagnostics?.token;
  return typeof token === "string" && token.length > 0 ? token : void 0;
}
function runtimeHealthConfigFromBootstrap(record, options) {
  const diagnostics = recordOrUndefined(record.x) ?? recordOrUndefined(record.diagnostics);
  const health = recordOrUndefined(diagnostics?.h) ?? recordOrUndefined(diagnostics?.health);
  const config = {
    intervalMs: optionalNonNegativeIntegerEnv("PROOF_SLIPWAY_RUNTIME_HEALTH_INTERVAL_MS", options) ?? nonNegativeIntegerField(health, "i", "intervalMs"),
    initialDelayMs: optionalNonNegativeIntegerEnv("PROOF_SLIPWAY_RUNTIME_HEALTH_INITIAL_DELAY_MS", options) ?? nonNegativeIntegerField(health, "d", "initialDelayMs"),
    sendTimeoutMs: optionalIntegerEnv("PROOF_SLIPWAY_RUNTIME_DIAGNOSTIC_SEND_TIMEOUT_MS", options) ?? positiveIntegerField(health, "to", "timeoutMs", "sendTimeoutMs")
  };
  return Object.values(config).some((value) => value !== void 0) ? config : void 0;
}
function nonNegativeIntegerField(record, ...names) {
  for (const name of names) {
    const value = record?.[name];
    if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0)
      return value;
  }
  return void 0;
}
function positiveIntegerField(record, ...names) {
  for (const name of names) {
    const value = record?.[name];
    if (typeof value === "number" && Number.isSafeInteger(value) && value > 0)
      return value;
  }
  return void 0;
}
async function emit2(diagnostics, event) {
  await Promise.resolve(diagnostics?.(event));
}

// node_modules/.pnpm/@proof-computer+liskov-runtime@https+++codeload.github.com+proof-computer+liskov-runtim_f15215979215515ddd7379bdd6f54a67/node_modules/@proof-computer/liskov-runtime/dist/index.js
var SlipwayRuntimeNotReadyError = class extends Error {
  status;
  constructor(status) {
    super(`Slipway runtime is not ready: ${status.blockers.map((blocker) => blocker.code).join(", ")}`);
    this.name = "SlipwayRuntimeNotReadyError";
    this.status = status;
  }
};
async function resolveSignedRuntimeBootstrap(input) {
  const signedOptions = {
    env: input.env,
    std: input.std,
    environment: input.environment,
    identityProvider: input.identityProvider,
    fetchImpl: input.fetchImpl,
    nowMs: input.nowMs,
    randomBytes: input.randomBytes,
    setTimeoutImpl: input.setTimeoutImpl,
    coreUrl: input.bootstrap?.coreUrl,
    secretsUrl: input.bootstrap?.secretsUrl,
    allowInsecureHttp: input.bootstrap?.allowInsecureHttp,
    requestTtlMs: input.bootstrap?.requestTtlMs,
    retry: input.bootstrap?.retry
  };
  const urls = liskovSignedBootstrapUrls(signedOptions);
  await allowBootstrapHostnames(input.std, [urlHostOrNull(urls.coreUrl), urlHostOrNull(urls.secretsUrl)]);
  input.setFailureStage("runtime_bootstrap");
  const runtimeBootstrap = await loadSignedRuntimeBootstrapOrSkip(input.mode, signedOptions);
  if (!runtimeBootstrap)
    return;
  if (runtimeBootstrap.runtimeEnvConfig !== void 0) {
    input.setSlipwayConfig(runtimeBootstrap.runtimeEnvConfig);
  }
  if (input.hasLockboxConfig && input.mode !== "signed")
    return;
  if (input.requestedSecretsMode === "off")
    return;
  const shouldDiscoverSecrets = runtimeBootstrap.secretsRequired || input.requestedSecretsMode === "required" || input.requestedSecretsMode === "background";
  if (!shouldDiscoverSecrets)
    return;
  await allowBootstrapHostnames(input.std, [urlHostOrNull(runtimeBootstrap.secretsUrl)]);
  const secretsRequired = runtimeBootstrap.secretsRequired || input.requestedSecretsMode === "required";
  input.setFailureStage("secret_bootstrap");
  const secretBootstrap = await loadSignedSecretBootstrapOrSkip(input.mode, { ...signedOptions, secretsUrl: runtimeBootstrap.secretsUrl }, secretsRequired);
  if (secretBootstrap !== void 0)
    input.setLockboxConfig(secretBootstrap.lockboxConfig);
}
async function loadSignedRuntimeBootstrapOrSkip(mode, options) {
  try {
    return await loadLiskovRuntimeBootstrap(options);
  } catch (error) {
    if (mode === "auto" && isLiskovSignedBootstrapUnavailableError(error))
      return void 0;
    throw error;
  }
}
async function loadSignedSecretBootstrapOrSkip(mode, options, required) {
  try {
    return await loadLiskovSecretBootstrap(options);
  } catch (error) {
    if (!required)
      return void 0;
    throw error;
  }
}
async function bootstrapSlipwayRuntime(options = {}) {
  const env = options.env ?? process.env;
  const home = resolveSlipwayHome({ home: options.home, env });
  const std = resolveRuntimeStd(options.std);
  const signedBootstrapMode = options.bootstrap?.mode ?? "auto";
  const lookup = { env, std, environment: options.environment };
  const legacyBootstrapLookup = signedBootstrapMode === "off" ? lookup : { env, std };
  const identityLookup = signedBootstrapMode === "off" ? lookup : { env, std };
  const identityProvider = options.identityProvider ?? createAcurastRuntimeAdapter(identityLookup);
  let slipwayConfig = readSlipwayRuntimeEnvConfig(legacyBootstrapLookup);
  let lockboxConfig = readLockboxRuntimeConfig(legacyBootstrapLookup);
  const startedAtMs = options.nowMs?.() ?? Date.now();
  const signedUrls = liskovSignedBootstrapUrls({
    env,
    std,
    environment: options.environment,
    coreUrl: options.bootstrap?.coreUrl,
    secretsUrl: options.bootstrap?.secretsUrl
  });
  const shouldResolveSignedBootstrap = signedBootstrapMode !== "off" && (signedBootstrapMode === "signed" || slipwayConfig === void 0 && lockboxConfig === void 0 || lockboxConfig === void 0 && options.secrets?.mode !== void 0 && options.secrets.mode !== "off");
  const fatalCleanup = [];
  let failureStage = "runtime_bootstrap";
  const diagnostics = createSlipwayRuntimeDiagnosticEmitter({
    bootstrap: slipwayConfig,
    coreUrl: shouldResolveSignedBootstrap ? signedUrls.coreUrl : void 0,
    allowInsecureHttp: shouldResolveSignedBootstrap ? liskovSignedBootstrapAllowInsecureHttp({
      env,
      std,
      allowInsecureHttp: options.bootstrap?.allowInsecureHttp
    }) : void 0,
    identityProvider,
    fetchImpl: options.fetchImpl,
    nowMs: options.nowMs,
    diagnostics: options.diagnostics,
    onCease: options.onCease,
    diagnosticSendTimeoutMs: options.diagnosticSendTimeoutMs ?? options.runtimeHealth?.sendTimeoutMs,
    diagnosticRemoteBackoffMs: options.diagnosticRemoteBackoffMs,
    setTimeoutImpl: options.setTimeoutImpl,
    clearTimeoutImpl: options.clearTimeoutImpl,
    onFatal: () => {
      for (const stop of fatalCleanup)
        stop();
    }
  });
  try {
    if (shouldResolveSignedBootstrap) {
      await resolveSignedRuntimeBootstrap({
        mode: signedBootstrapMode,
        env,
        std,
        identityProvider,
        fetchImpl: options.fetchImpl,
        nowMs: options.nowMs,
        randomBytes: options.randomBytes,
        setTimeoutImpl: options.setTimeoutImpl,
        bootstrap: options.bootstrap,
        requestedSecretsMode: options.secrets?.mode,
        hasLockboxConfig: lockboxConfig !== void 0,
        setSlipwayConfig: (config) => {
          slipwayConfig = config;
        },
        setLockboxConfig: (config) => {
          lockboxConfig = config;
        },
        setFailureStage: (stage) => {
          failureStage = stage;
        }
      });
    }
    diagnostics.configureBootstrap(slipwayConfig);
    failureStage = "runtime_env";
    const secretsMode = options.secrets?.mode ?? (lockboxConfig === void 0 ? "off" : "required");
    const loggingMode = options.logging?.mode ?? "background";
    await allowBootstrapHostnames(std, [
      urlHostOrNull(slipwayConfig?.slipwayUrl),
      urlHostOrNull(lockboxConfig?.lockboxUrl),
      ...blackboxLogHostnames((name) => env[name])
    ]);
    await diagnostics.emit({
      stage: "runtime.start",
      status: "info",
      ok: true,
      component: "runtime-bootstrap",
      attrs: {
        ...runtimeCapabilityAttrs(legacyBootstrapLookup, options.fetchImpl),
        ...runtimeBootstrapAttrs(legacyBootstrapLookup, slipwayConfig, lockboxConfig)
      }
    });
    let refreshHandle;
    let runtimeHealthHandle;
    let runtimeEnv;
    let managedLoggingConfigReady = !(lockboxConfig?.overwriteEnv === true && lockboxConfig.requestedSecretIds.includes("blackbox-log-config"));
    const logging = createSlipwayRuntimeLoggingController({
      env,
      std,
      mode: loggingMode,
      required: loggingMode === "required",
      startedAtMs,
      earlyBufferMaxRecords: options.logging?.earlyBufferMaxRecords ?? 100,
      fetchImpl: options.fetchImpl,
      spoolMode: options.logging?.spoolMode,
      spoolDir: options.logging?.spoolDir,
      timeoutMs: options.logging?.timeoutMs,
      nowMs: options.nowMs,
      onError: options.logging?.onError,
      diagnostics,
      allowHostnames: (hostnames) => allowBootstrapHostnames(std, hostnames),
      canAttach: () => managedLoggingConfigReady,
      baseRecord: () => compactRuntimeRecord({
        applicationUid: runtimeEnv?.response.applicationUid ?? slipwayConfig?.applicationUid ?? lockboxConfig?.applicationUid,
        applicationId: options.appId ?? runtimeEnv?.response.applicationId ?? slipwayConfig?.applicationId ?? lockboxConfig?.applicationId,
        deploymentId: runtimeEnv?.response.deploymentId ?? slipwayConfig?.deploymentId ?? lockboxConfig?.deploymentId,
        component: options.component,
        revision: options.revision ?? runtimeEnv?.response.revision
      })
    });
    const bridgeRuntimeEnvDiagnostics = async (event) => {
      await diagnostics.emit(slipwayRuntimeEnvDiagnostic(event));
    };
    const bridgeLockboxDiagnostics = async (event) => {
      await diagnostics.emit(lockboxRuntimeDiagnostic(event));
    };
    const secrets = createSlipwayRuntimeSecretsController({
      env,
      mode: secretsMode,
      startedAtMs,
      config: lockboxConfig,
      retry: options.secrets?.retry,
      identityProvider,
      fetchImpl: options.fetchImpl,
      nowMs: options.nowMs,
      randomBytes: options.randomBytes,
      diagnostics,
      lockboxDiagnostics: bridgeLockboxDiagnostics,
      setTimeoutImpl: options.setTimeoutImpl,
      clearTimeoutImpl: options.clearTimeoutImpl,
      onLoaded: async () => {
        managedLoggingConfigReady = true;
        await logging.refresh();
      }
    });
    fatalCleanup.push(() => secrets.stop());
    if (slipwayConfig !== void 0) {
      refreshHandle = startSlipwayRuntimeEnvRefresh({
        identityProvider,
        config: slipwayConfig,
        env,
        fetchImpl: options.fetchImpl,
        nowMs: options.nowMs,
        randomBytes: options.randomBytes,
        diagnostics: bridgeRuntimeEnvDiagnostics,
        setTimeoutImpl: options.setTimeoutImpl,
        clearTimeoutImpl: options.clearTimeoutImpl
      });
      fatalCleanup.push(() => refreshHandle?.stop());
      await diagnostics.emit({
        phase: "slipway_runtime_env",
        stage: "slipway.runtime_env.request",
        status: "started",
        ok: true
      });
      runtimeEnv = await refreshHandle.refreshNow();
    } else {
      await diagnostics.emit({
        phase: "skipped",
        stage: "slipway.runtime_env.request",
        status: "skipped",
        ok: true
      });
    }
    if (secretsMode === "required") {
      failureStage = "lockbox";
      await secrets.loadRequired();
    } else if (secretsMode === "background") {
      secrets.startBackground();
    }
    failureStage = "logging";
    await logging.refresh();
    if (slipwayConfig !== void 0) {
      runtimeHealthHandle = startSlipwayRuntimeHealth({
        bootstrap: slipwayConfig,
        emitter: diagnostics,
        // ADR-0003 Phase 5b: the health-loop scheduler gates on "can we authenticate a remote
        // check-in?" — which is now token OR signature. Pass the identity provider so the loop
        // still runs (and signs) when the bootstrap carries no diagnostics token.
        identityProvider,
        intervalMs: options.runtimeHealth?.intervalMs,
        initialDelayMs: options.runtimeHealth?.initialDelayMs,
        diagnosticSendTimeoutMs: options.diagnosticSendTimeoutMs ?? options.runtimeHealth?.sendTimeoutMs,
        setTimeoutImpl: options.setTimeoutImpl,
        clearTimeoutImpl: options.clearTimeoutImpl
      });
      fatalCleanup.push(() => runtimeHealthHandle?.stop());
    }
    return {
      home,
      diagnostics,
      get runtimeEnv() {
        return runtimeEnv;
      },
      get lockbox() {
        return secrets.result();
      },
      get runtimeHealth() {
        return runtimeHealthHandle;
      },
      env: {
        get(name) {
          return getFirstRuntimeEnvValue([name], lookup);
        },
        require(name) {
          const value = getFirstRuntimeEnvValue([name], lookup);
          if (value === void 0)
            throw new Error(`Slipway runtime env ${name} is required`);
          return value;
        }
      },
      status() {
        return runtimeStatus({
          home,
          startedAtMs,
          appId: options.appId,
          revision: options.revision,
          slipwayConfig,
          lockboxConfig,
          runtimeEnv,
          secretsStatus: secrets.status(),
          loggingStatus: logging.status()
        });
      },
      async whenReady() {
        const status = runtimeStatus({
          home,
          startedAtMs,
          appId: options.appId,
          revision: options.revision,
          slipwayConfig,
          lockboxConfig,
          runtimeEnv,
          secretsStatus: secrets.status(),
          loggingStatus: logging.status()
        });
        if (status.ready)
          return status;
        throw new SlipwayRuntimeNotReadyError(status);
      },
      async log(event, details = {}, logOptions = {}) {
        if (diagnostics.isClosed())
          return;
        await logging.log(event, details, logOptions);
      },
      async flush() {
        return logging.flush();
      },
      stop() {
        refreshHandle?.stop();
        runtimeHealthHandle?.stop();
        secrets.stop();
      },
      async refreshNow() {
        const result = await refreshHandle?.refreshNow();
        if (result !== void 0)
          runtimeEnv = result;
        await secrets.refreshNow();
        await logging.refresh();
        return result;
      }
    };
  } catch (error) {
    await diagnostics.fatal({
      kind: "bootstrap",
      code: classifyBootstrapFailure(error, failureStage),
      component: options.component ?? "runtime-bootstrap",
      error
    });
    throw error;
  }
}
function classifyBootstrapFailure(error, stage) {
  const message = safeErrorMessage(error);
  if (/response encryption key is required/iu.test(message)) {
    return "lockbox_response_key_missing";
  }
  if (stage === "runtime_bootstrap") {
    if (error instanceof LiskovSignedBootstrapHttpError) {
      return validatedRuntimeErrorCode(error.errorCode) ?? "runtime_bootstrap_rejected";
    }
    return "runtime_bootstrap_failed";
  }
  if (stage === "secret_bootstrap")
    return "secret_bootstrap_failed";
  if (stage === "runtime_env")
    return "runtime_env_request_failed";
  if (stage === "lockbox")
    return "lockbox_secret_request_failed";
  return "runtime_logging_required_failed";
}
function validatedRuntimeErrorCode(value) {
  return value && /^[a-z][a-z0-9_]{0,95}$/u.test(value) ? value : void 0;
}
var DEFAULT_SECRETS_RETRY_INITIAL_DELAY_MS = 0;
var DEFAULT_SECRETS_RETRY_INTERVAL_MS = 5e3;
var DEFAULT_SECRETS_RETRY_MAX_ELAPSED_MS = 6e4;
var DEFAULT_SECRETS_RETRY_MAX_ATTEMPTS = 12;
function createSlipwayRuntimeSecretsController(input) {
  const retry = normalizeSecretsRetryOptions(input.retry);
  const setTimeoutImpl = input.setTimeoutImpl ?? setTimeout;
  const clearTimeoutImpl = input.clearTimeoutImpl ?? clearTimeout;
  let stopped = false;
  let timer;
  let result;
  let loadPromise;
  let attempts = 0;
  let firstAttemptAtMs;
  let exhausted = false;
  let lastErrorMessage;
  function resultValue() {
    return result;
  }
  async function loadRequired() {
    if (input.mode === "off")
      return void 0;
    if (!input.config) {
      const message = "Slipway required secrets config is not available";
      lastErrorMessage = message;
      exhausted = true;
      await emitSecretsDiagnostic({
        stage: "lockbox.secret_request",
        status: "failed",
        ok: false,
        code: "lockbox_config_missing",
        message,
        error: message
      });
      throw new Error(message);
    }
    return loadOnce({ throwOnFailure: true, scheduleRetry: false, manual: false });
  }
  function startBackground() {
    if (input.mode !== "background" || !input.config || stopped || result || timer)
      return;
    scheduleRetry(retry.initialDelayMs);
  }
  async function refreshNow() {
    if (input.mode === "off" || !input.config || stopped || result || exhausted)
      return result;
    clearScheduledTimer();
    return loadOnce({ throwOnFailure: input.mode === "required", scheduleRetry: input.mode === "background", manual: true });
  }
  async function loadOnce(options) {
    if (!input.config || stopped || result)
      return result;
    if (loadPromise)
      return loadPromise;
    loadPromise = loadOnceUnshared(options).finally(() => {
      loadPromise = void 0;
    });
    return loadPromise;
  }
  async function loadOnceUnshared(options) {
    attempts += 1;
    firstAttemptAtMs ??= nowMs();
    await emitSecretsDiagnostic({
      stage: "lockbox.secret_request",
      status: "started",
      ok: true,
      code: "lockbox_secret_request_started",
      attrs: compactDiagnosticAttrs({
        requestedSecretCount: input.config?.requestedSecretIds.length,
        attempt: attempts,
        maxAttempts: retry.maxAttempts,
        mode: input.mode,
        manual: options.manual
      })
    });
    try {
      const loaded = await loadLockboxRuntimeSecrets({
        identityProvider: input.identityProvider,
        config: input.config,
        env: input.env,
        fetchImpl: input.fetchImpl,
        nowMs: input.nowMs,
        randomBytes: input.randomBytes,
        diagnostics: input.lockboxDiagnostics
      });
      result = loaded;
      exhausted = false;
      lastErrorMessage = void 0;
      clearScheduledTimer();
      const installedEnvCount = loaded.installed.env.length;
      const installedFileCount = loaded.installed.files.length;
      const skippedEnvCount = loaded.installed.skippedExistingEnv.length;
      const secretCount = installedEnvCount + installedFileCount;
      await emitSecretsDiagnostic({
        stage: "lockbox.secret_request",
        status: "succeeded",
        ok: true,
        code: "lockbox_secret_request_succeeded",
        valueCount: secretCount,
        attrs: compactDiagnosticAttrs({
          secretCount,
          installedEnvCount,
          installedFileCount,
          skippedEnvCount,
          attempt: attempts
        })
      });
      await input.onLoaded?.(loaded);
      return loaded;
    } catch (error) {
      lastErrorMessage = safeErrorMessage(error);
      const nextDelayMs = options.scheduleRetry ? nextRetryDelayMs() : void 0;
      exhausted = options.scheduleRetry && nextDelayMs === void 0;
      await emitSecretsDiagnostic({
        stage: nextDelayMs === void 0 ? "lockbox.secret_request" : "lockbox.secret_request.retry",
        status: "failed",
        ok: false,
        code: nextDelayMs === void 0 ? "lockbox_secret_request_failed" : "lockbox_secret_request_retrying",
        message: lastErrorMessage,
        error: lastErrorMessage,
        attrs: compactDiagnosticAttrs({
          attempt: attempts,
          maxAttempts: retry.maxAttempts,
          elapsedMs: nowMs() - (firstAttemptAtMs ?? nowMs()),
          nextDelayMs,
          mode: input.mode,
          manual: options.manual
        })
      });
      if (nextDelayMs !== void 0)
        scheduleRetry(nextDelayMs);
      if (options.throwOnFailure)
        throw error;
      return void 0;
    }
  }
  function status() {
    if (input.mode === "off") {
      return capabilityStatus({
        state: "off",
        required: false,
        sinceMs: input.startedAtMs
      });
    }
    if (!input.config) {
      const required = input.mode === "required";
      return capabilityStatus({
        state: required ? "failed" : "off",
        required,
        sinceMs: input.startedAtMs,
        code: required ? "lockbox_config_missing" : void 0,
        message: required ? "Slipway required secrets config is not available" : void 0
      });
    }
    const secretCount = result ? result.installed.env.length + result.installed.files.length : void 0;
    if (result) {
      return capabilityStatus({
        state: "ready",
        required: input.mode === "required",
        sinceMs: input.startedAtMs,
        valueCount: secretCount
      });
    }
    if (lastErrorMessage && exhausted) {
      return capabilityStatus({
        state: input.mode === "required" ? "failed" : "failed",
        required: input.mode === "required",
        sinceMs: input.startedAtMs,
        code: "lockbox_secret_request_failed",
        message: lastErrorMessage
      });
    }
    if (lastErrorMessage) {
      return capabilityStatus({
        state: input.mode === "required" ? "failed" : "degraded",
        required: input.mode === "required",
        sinceMs: input.startedAtMs,
        code: input.mode === "required" ? "lockbox_secret_request_failed" : "lockbox_secret_request_retrying",
        message: lastErrorMessage
      });
    }
    return capabilityStatus({
      state: "pending",
      required: input.mode === "required",
      sinceMs: input.startedAtMs,
      code: "lockbox_secret_request_pending",
      message: "Slipway secrets have not been installed yet"
    });
  }
  function nextRetryDelayMs() {
    if (attempts >= retry.maxAttempts)
      return void 0;
    const elapsedMs = nowMs() - (firstAttemptAtMs ?? nowMs());
    if (elapsedMs + retry.intervalMs > retry.maxElapsedMs)
      return void 0;
    return retry.intervalMs;
  }
  function scheduleRetry(delayMs) {
    if (stopped || result || input.mode !== "background" || !input.config || exhausted)
      return;
    clearScheduledTimer();
    timer = setTimeoutImpl(() => {
      timer = void 0;
      void loadOnce({ throwOnFailure: false, scheduleRetry: true, manual: false });
    }, delayMs);
    timer.unref?.();
  }
  function clearScheduledTimer() {
    if (!timer)
      return;
    clearTimeoutImpl(timer);
    timer = void 0;
  }
  function nowMs() {
    return input.nowMs?.() ?? Date.now();
  }
  async function emitSecretsDiagnostic(event) {
    await input.diagnostics.emit({
      phase: "lockbox_secrets",
      component: "runtime-secrets",
      ...event
    });
  }
  return {
    status,
    result: resultValue,
    loadRequired,
    startBackground,
    refreshNow,
    stop() {
      stopped = true;
      clearScheduledTimer();
    }
  };
}
function normalizeSecretsRetryOptions(retry) {
  const initialDelayMs = nonNegativeInteger3(retry?.initialDelayMs) ?? DEFAULT_SECRETS_RETRY_INITIAL_DELAY_MS;
  const intervalMs = nonNegativeInteger3(retry?.intervalMs) ?? DEFAULT_SECRETS_RETRY_INTERVAL_MS;
  const maxElapsedMs = nonNegativeInteger3(retry?.maxElapsedMs) ?? DEFAULT_SECRETS_RETRY_MAX_ELAPSED_MS;
  const maxAttempts = positiveInteger3(retry?.maxAttempts) ?? DEFAULT_SECRETS_RETRY_MAX_ATTEMPTS;
  return { initialDelayMs, intervalMs, maxElapsedMs, maxAttempts };
}
function nonNegativeInteger3(value) {
  if (typeof value !== "number" || !Number.isFinite(value))
    return void 0;
  return Math.max(0, Math.floor(value));
}
function positiveInteger3(value) {
  if (typeof value !== "number" || !Number.isFinite(value))
    return void 0;
  return Math.max(1, Math.floor(value));
}
function createSlipwayRuntimeLoggingController(input) {
  const getConfigValue = (name) => input.env[name];
  const earlyLogs = [];
  let droppedEarlyLogs = 0;
  let logger;
  let attachedFingerprint;
  let attachErrorCode;
  let attachErrorMessage;
  let writeErrorMessage;
  let writeErrorCount = 0;
  let refreshPromise;
  let drainPromise;
  const currentFingerprint = () => blackboxLogConfigFingerprint(getConfigValue);
  async function refresh() {
    if (input.mode === "off")
      return 0;
    refreshPromise ??= refreshOnce().finally(() => {
      refreshPromise = void 0;
    });
    return refreshPromise;
  }
  async function refreshOnce() {
    if (input.canAttach?.() === false) {
      logger = void 0;
      attachedFingerprint = void 0;
      attachErrorCode = void 0;
      attachErrorMessage = void 0;
      writeErrorMessage = void 0;
      return 0;
    }
    const fingerprint = currentFingerprint();
    if (!fingerprint) {
      logger = void 0;
      attachedFingerprint = void 0;
      attachErrorCode = void 0;
      attachErrorMessage = void 0;
      return 0;
    }
    if (logger && attachedFingerprint === fingerprint) {
      return drainEarlyLogs();
    }
    logger = void 0;
    attachedFingerprint = void 0;
    attachErrorCode = void 0;
    attachErrorMessage = void 0;
    writeErrorMessage = void 0;
    await attachLogger(fingerprint);
    return drainEarlyLogs();
  }
  async function attachLogger(fingerprint) {
    await emitLoggingDiagnostic({
      stage: "slipway.logging.attach",
      status: "started",
      ok: true,
      code: "slipway_logging_attach_started",
      attrs: compactDiagnosticAttrs({ fingerprint })
    });
    try {
      readBlackboxLogConfig(getConfigValue);
    } catch (error) {
      recordAttachError("slipway_logging_config_invalid", error);
      return;
    }
    try {
      await input.allowHostnames(blackboxLogHostnames(getConfigValue));
      logger = createBlackboxRemoteLogger({
        getConfigValue,
        fetchImpl: input.fetchImpl,
        timeoutMs: input.timeoutMs,
        std: input.std,
        spoolMode: input.spoolMode,
        spoolDir: input.spoolDir,
        baseRecord: input.baseRecord,
        onError(error, event) {
          recordWriteError(error, event);
        }
      });
      attachedFingerprint = fingerprint;
      attachErrorCode = void 0;
      attachErrorMessage = void 0;
      await emitLoggingDiagnostic({
        stage: "slipway.logging.attach",
        status: "succeeded",
        ok: true,
        code: "slipway_logging_attached",
        attrs: compactDiagnosticAttrs({ fingerprint })
      });
    } catch (error) {
      recordAttachError("slipway_logging_attach_failed", error);
    }
  }
  function recordAttachError(code, error) {
    attachErrorCode = code;
    attachErrorMessage = safeErrorMessage(error);
    void emitLoggingDiagnostic({
      stage: "slipway.logging.attach",
      status: "failed",
      ok: false,
      code,
      message: attachErrorMessage,
      error: attachErrorMessage,
      attrs: compactDiagnosticAttrs({ fingerprint: currentFingerprint() })
    });
  }
  function recordWriteError(error, event) {
    writeErrorCount += 1;
    writeErrorMessage = safeErrorMessage(error);
    try {
      input.onError?.(error, event);
    } catch {
    }
    void emitLoggingDiagnostic({
      stage: "slipway.logging.write",
      status: "failed",
      ok: false,
      code: "slipway_logging_write_failed",
      message: writeErrorMessage,
      error: writeErrorMessage,
      attrs: compactDiagnosticAttrs({ event, fingerprint: attachedFingerprint ?? currentFingerprint() })
    });
  }
  async function emitLoggingDiagnostic(event) {
    await input.diagnostics.emit({
      phase: "slipway_logging",
      component: "runtime-logging",
      ...event
    });
  }
  function bufferLog(record) {
    if (earlyLogs.length >= input.earlyBufferMaxRecords) {
      droppedEarlyLogs += 1;
      void emitLoggingDiagnostic({
        stage: "slipway.logging.buffer",
        status: "failed",
        ok: false,
        code: "slipway_logging_buffer_dropped",
        message: "Slipway logging early buffer is full",
        attrs: compactDiagnosticAttrs({
          event: record.event,
          earlyBufferMaxRecords: input.earlyBufferMaxRecords
        })
      });
      return;
    }
    earlyLogs.push(record);
  }
  async function writeRecord(record) {
    if (!logger)
      return false;
    const errorsBefore = writeErrorCount;
    try {
      await logger(record.event, detailsForBufferedLog(record));
    } catch (error) {
      recordWriteError(error, record.event);
      return false;
    }
    if (writeErrorCount === errorsBefore) {
      writeErrorMessage = void 0;
      return true;
    }
    return false;
  }
  async function drainEarlyLogs() {
    if (!logger || earlyLogs.length === 0)
      return 0;
    drainPromise ??= drainEarlyLogsOnce().finally(() => {
      drainPromise = void 0;
    });
    return drainPromise;
  }
  async function drainEarlyLogsOnce() {
    let flushed = 0;
    while (logger && earlyLogs.length > 0) {
      const record = earlyLogs.shift();
      await writeRecord(record);
      flushed += 1;
    }
    if (flushed > 0) {
      await emitLoggingDiagnostic({
        stage: "slipway.logging.buffer",
        status: "succeeded",
        ok: true,
        code: "slipway_logging_buffer_drained",
        valueCount: flushed,
        attrs: compactDiagnosticAttrs({ fingerprint: attachedFingerprint })
      });
    }
    return flushed;
  }
  function status() {
    const fingerprint = currentFingerprint();
    if (input.mode === "off") {
      return capabilityStatus({
        state: "off",
        required: false,
        sinceMs: input.startedAtMs,
        fingerprint,
        valueCount: earlyLogs.length
      });
    }
    if (!fingerprint) {
      const hasBufferedRecords = earlyLogs.length > 0 || droppedEarlyLogs > 0;
      return capabilityStatus({
        state: input.required || hasBufferedRecords ? "pending" : "off",
        required: input.required,
        sinceMs: input.startedAtMs,
        fingerprint,
        valueCount: earlyLogs.length,
        code: input.required || hasBufferedRecords ? "slipway_logging_config_missing" : void 0,
        message: input.required || hasBufferedRecords ? "Slipway logging config is not available yet" : void 0
      });
    }
    if (attachErrorMessage) {
      return capabilityStatus({
        state: input.required ? "failed" : "degraded",
        required: input.required,
        sinceMs: input.startedAtMs,
        fingerprint,
        valueCount: earlyLogs.length,
        code: attachErrorCode ?? "slipway_logging_attach_failed",
        message: attachErrorMessage
      });
    }
    if (!logger || attachedFingerprint !== fingerprint) {
      return capabilityStatus({
        state: "pending",
        required: input.required,
        sinceMs: input.startedAtMs,
        fingerprint,
        valueCount: earlyLogs.length,
        code: "slipway_logging_attach_pending",
        message: "Slipway logging config changed and has not been attached yet"
      });
    }
    if (writeErrorMessage) {
      return capabilityStatus({
        state: input.required ? "failed" : "degraded",
        required: input.required,
        sinceMs: input.startedAtMs,
        fingerprint,
        valueCount: earlyLogs.length,
        code: "slipway_logging_write_failed",
        message: writeErrorMessage
      });
    }
    if (droppedEarlyLogs > 0) {
      return capabilityStatus({
        state: input.required ? "failed" : "degraded",
        required: input.required,
        sinceMs: input.startedAtMs,
        fingerprint,
        valueCount: earlyLogs.length,
        code: "slipway_logging_buffer_dropped",
        message: "Slipway logging dropped early records before attach"
      });
    }
    return capabilityStatus({
      state: "ready",
      required: input.required,
      sinceMs: input.startedAtMs,
      fingerprint,
      valueCount: earlyLogs.length
    });
  }
  return {
    status,
    refresh,
    async log(event, details = {}, options = {}) {
      if (input.mode === "off")
        return;
      await refresh();
      const record = {
        timestamp: new Date(input.nowMs?.() ?? Date.now()).toISOString(),
        event,
        details,
        severity: options.severity ?? "info",
        labels: options.labels
      };
      if (logger && attachedFingerprint === currentFingerprint()) {
        await writeRecord(record);
        return;
      }
      bufferLog(record);
    },
    async flush() {
      const errorsBefore = writeErrorCount;
      const flushedFromRefresh = await refresh();
      const flushed = flushedFromRefresh + await drainEarlyLogs();
      const currentStatus = status();
      const okState = currentStatus.state === "ready" || currentStatus.state === "off";
      return {
        ok: okState && earlyLogs.length === 0 && droppedEarlyLogs === 0 && writeErrorCount === errorsBefore,
        state: currentStatus.state,
        flushed,
        pending: earlyLogs.length,
        dropped: droppedEarlyLogs,
        message: currentStatus.message
      };
    }
  };
}
function detailsForBufferedLog(record) {
  return {
    ...record.details ?? {},
    _slipwayRuntime: compactRuntimeRecord({
      loggedAt: record.timestamp,
      severity: record.severity,
      labels: record.labels
    })
  };
}
function runtimeStatus(input) {
  const runtimeEnvStatus = capabilityStatus({
    state: input.slipwayConfig === void 0 ? "off" : input.runtimeEnv ? "ready" : "pending",
    required: input.slipwayConfig !== void 0,
    sinceMs: input.startedAtMs,
    revision: input.runtimeEnv?.response.revision,
    valueCount: input.runtimeEnv ? Object.keys(input.runtimeEnv.installed).length : void 0
  });
  const diagnosticsStatus = capabilityStatus({
    state: "ready",
    required: false,
    sinceMs: input.startedAtMs
  });
  const switchboardStatus = capabilityStatus({
    state: "off",
    required: false,
    sinceMs: input.startedAtMs
  });
  const capabilities = {
    runtimeEnv: runtimeEnvStatus,
    secrets: input.secretsStatus,
    logging: input.loggingStatus,
    diagnostics: diagnosticsStatus,
    switchboard: switchboardStatus
  };
  const blockers = readinessBlockers(capabilities);
  return {
    ok: blockers.length === 0,
    ready: blockers.length === 0,
    home: input.home,
    applicationUid: input.runtimeEnv?.response.applicationUid ?? input.slipwayConfig?.applicationUid ?? input.lockboxConfig?.applicationUid,
    applicationId: input.appId ?? input.runtimeEnv?.response.applicationId ?? input.slipwayConfig?.applicationId ?? input.lockboxConfig?.applicationId,
    deploymentId: input.runtimeEnv?.response.deploymentId ?? input.slipwayConfig?.deploymentId ?? input.lockboxConfig?.deploymentId,
    revision: input.revision ?? input.runtimeEnv?.response.revision,
    blockers,
    capabilities
  };
}
function capabilityStatus(input) {
  return input;
}
function readinessBlockers(capabilities) {
  return Object.entries(capabilities).filter(([, status]) => status.required && status.state !== "ready").map(([capability, status]) => ({
    capability,
    code: status.code ?? `${capability}_not_ready`,
    message: status.message ?? `${capability} is ${status.state}`
  }));
}
function slipwayRuntimeEnvDiagnostic(event) {
  const base = {
    phase: event.phase === "refresh_failed" ? "refresh_failed" : "slipway_runtime_env",
    ok: event.ok,
    valueCount: event.valueCount,
    revision: event.revision,
    attrs: event.attrs
  };
  switch (event.phase) {
    case "identity_resolved":
      return { ...base, stage: "slipway.runtime_env.identity", status: "succeeded" };
    case "request_signed":
      return { ...base, stage: "slipway.runtime_env.signed", status: "succeeded" };
    case "runtime_env_request":
      return event.ok ? { ...base, stage: "slipway.runtime_env.fetch", status: "started" } : {
        ...base,
        stage: "slipway.runtime_env.request",
        status: "failed",
        code: "runtime_env_request_failed",
        message: event.errorCode,
        error: event.errorCode
      };
    case "runtime_env_response":
      return { ...base, stage: "slipway.runtime_env.response", status: event.ok ? "succeeded" : "failed" };
    case "env_installed":
      return { ...base, stage: "slipway.runtime_env.applied", status: "succeeded" };
    case "refresh_failed":
      return {
        ...base,
        stage: "slipway.runtime_env.refresh",
        status: "failed",
        code: "runtime_env_refresh_failed",
        message: event.errorCode,
        error: event.errorCode
      };
  }
}
function lockboxRuntimeDiagnostic(event) {
  const base = {
    phase: "lockbox_secrets",
    ok: event.ok,
    valueCount: event.secretCount,
    attrs: event.attrs
  };
  switch (event.phase) {
    case "identity_resolved":
      return { ...base, stage: "lockbox.secret_request.identity", status: "succeeded" };
    case "request_signed":
      return { ...base, stage: "lockbox.secret_request.signed", status: "succeeded" };
    case "lockbox_request":
      return { ...base, stage: "lockbox.secret_request.fetch", status: "started" };
    case "lockbox_response":
      return { ...base, stage: "lockbox.secret_request.response", status: event.ok ? "succeeded" : "failed" };
    case "payload_decrypted":
      return { ...base, stage: "lockbox.secret_request.decrypted", status: "succeeded" };
    case "secrets_installed":
      return { ...base, stage: "lockbox.secret_request.installed", status: "succeeded" };
    case "bootstrap_failed":
      return {
        ...base,
        stage: "lockbox.secret_request",
        status: "failed",
        code: "lockbox_secret_request_failed",
        message: event.errorCode,
        error: event.errorCode
      };
  }
}
function runtimeCapabilityAttrs(lookup, fetchImpl) {
  const std = lookup.std;
  return {
    hasFetch: typeof fetchImpl === "function" || typeof globalThis.fetch === "function",
    hasStdEnv: Boolean(std?.env),
    hasStdJob: Boolean(std?.job),
    hasJobId: Boolean(getFirstRuntimeEnvValue(DEFAULT_JOB_ID_ENV_NAMES, lookup) ?? stringifyRuntimeValue3(std?.job?.getId?.())),
    hasEncryptionKeys: typeof std?.job?.getEncryptionKeys === "function",
    hasDeviceAddress: Boolean(getFirstRuntimeEnvValue(DEFAULT_PROCESSOR_ID_ENV_NAMES, lookup) ?? stringifyRuntimeValue3(std?.device?.getAddress?.())),
    hasEd25519Signer: typeof std?.signers?.ed25519?.sign === "function",
    hasSecp256r1Encrypt: typeof std?.signers?.secp256r1?.encrypt === "function",
    hasSecp256r1Decrypt: typeof std?.signers?.secp256r1?.decrypt === "function"
  };
}
function runtimeBootstrapAttrs(lookup, slipwayConfig, lockboxConfig) {
  return {
    hasSlipwayBootstrap: Boolean(slipwayConfig),
    hasSlipwayDiagnosticsToken: Boolean(slipwayConfig?.diagnosticsToken),
    hasLockboxBootstrap: Boolean(lockboxConfig),
    slipwayBootstrapSource: runtimeEnvSource(LISKOV_BOOTSTRAP_ENV_NAMES, lookup),
    lockboxBootstrapSource: runtimeEnvSource(LOCKBOX_BOOTSTRAP_ENV_NAMES, lookup),
    slipwayHost: urlHostOrNull(slipwayConfig?.slipwayUrl),
    lockboxHost: urlHostOrNull(lockboxConfig?.lockboxUrl),
    applicationUid: slipwayConfig?.applicationUid ?? lockboxConfig?.applicationUid ?? null,
    applicationId: slipwayConfig?.applicationId ?? lockboxConfig?.applicationId ?? null,
    deploymentId: slipwayConfig?.deploymentId ?? lockboxConfig?.deploymentId ?? null
  };
}
function compactRuntimeRecord(input) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== void 0));
}
function compactDiagnosticAttrs(input) {
  const attrs = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== void 0));
  return Object.keys(attrs).length > 0 ? attrs : void 0;
}
function runtimeEnvSource(names, lookup) {
  for (const name of names) {
    if (lookup.env[name])
      return "process";
    if (lookup.std?.env?.[name])
      return "std";
    if (lookup.environment?.(name) !== void 0)
      return "environment";
  }
  return "none";
}
async function allowBootstrapHostnames(std, hostnames) {
  void std;
  void hostnames;
}
function urlHostOrNull(value) {
  if (!value)
    return null;
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}
function stringifyRuntimeValue3(value) {
  if (typeof value === "string" && value.length > 0)
    return value;
  if (value === void 0 || value === null)
    return void 0;
  return JSON.stringify(value);
}

// node_modules/.pnpm/@proof-computer+liskov-runtime@https+++codeload.github.com+proof-computer+liskov-runtim_f15215979215515ddd7379bdd6f54a67/node_modules/@proof-computer/liskov-runtime/dist/encrypted-code.js
var import_node_crypto4 = require("node:crypto");
var import_promises2 = require("node:fs/promises");
var import_node_module = require("node:module");
var import_node_path3 = __toESM(require("node:path"), 1);
var import_node_url = require("node:url");
var ENCRYPTED_CODE_DOMAIN = "proof.liskov.encrypted-code.v1";
var ENCRYPTED_CODE_KEY_ENV = "LISKOV_CODE_KEY";
var MAX_ENCRYPTED_CODE_BYTES = 16 * 1024 * 1024;
function parseEncryptedCodeDescriptor(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("encrypted_code_descriptor_invalid");
  }
  const record = value;
  const fields = ["domain", "algorithm", "keySecretId", "iv", "authTag", "plaintextDigest", "ciphertextDigest"];
  if (Object.keys(record).length !== fields.length || fields.some((field) => typeof record[field] !== "string")) {
    throw new Error("encrypted_code_descriptor_invalid");
  }
  if (record.domain !== ENCRYPTED_CODE_DOMAIN || record.algorithm !== "aes-256-gcm" || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/u.test(record.keySecretId) || !/^sha256:[0-9a-f]{64}$/u.test(record.plaintextDigest) || !/^sha256:[0-9a-f]{64}$/u.test(record.ciphertextDigest) || record.plaintextDigest === record.ciphertextDigest) {
    throw new Error("encrypted_code_descriptor_invalid");
  }
  decodeCanonicalBase64(record.iv, 12);
  decodeCanonicalBase64(record.authTag, 16);
  return record;
}
function encryptedCodeAad(descriptor) {
  return Buffer.from(`${ENCRYPTED_CODE_DOMAIN}
${descriptor.keySecretId}
${descriptor.plaintextDigest}`, "utf8");
}
function decryptEncryptedCode(ciphertext, key, metadata) {
  const descriptor = parseEncryptedCodeDescriptor(metadata);
  if (ciphertext.length === 0 || ciphertext.length > MAX_ENCRYPTED_CODE_BYTES || digest(ciphertext) !== descriptor.ciphertextDigest) {
    throw new Error("encrypted_code_ciphertext_mismatch");
  }
  const keyBytes = decodeCanonicalBase64(key, 32);
  try {
    const decipher = (0, import_node_crypto4.createDecipheriv)("aes-256-gcm", keyBytes, decodeCanonicalBase64(descriptor.iv, 12));
    decipher.setAAD(encryptedCodeAad(descriptor));
    decipher.setAuthTag(decodeCanonicalBase64(descriptor.authTag, 16));
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    if (digest(plaintext) !== descriptor.plaintextDigest) {
      plaintext.fill(0);
      throw new Error("encrypted_code_plaintext_mismatch");
    }
    return plaintext;
  } catch {
    throw new Error("encrypted_code_decryption_failed");
  } finally {
    keyBytes.fill(0);
  }
}
async function startEncryptedApplication(input) {
  const { runtime } = input;
  let directory;
  let filename;
  let loadModule;
  let plaintext;
  let phase = "descriptor";
  try {
    const descriptor = parseEncryptedCodeDescriptor(input.descriptor);
    phase = "readiness";
    await runtime.whenReady();
    phase = "key_release";
    const release = runtime.lockbox;
    const status = runtime.status();
    const delivered = release?.installed.env.filter((secret) => secret.secretId === descriptor.keySecretId && secret.name === ENCRYPTED_CODE_KEY_ENV);
    if (release === void 0 || status.applicationUid === void 0 || release.response.applicationUid !== status.applicationUid || release.response.deploymentId !== status.deploymentId || delivered?.length !== 1 || !release.response.secretVersions.some((secret) => secret.secretId === delivered[0].secretId && secret.versionId === delivered[0].versionId && secret.target === "env" && secret.name === ENCRYPTED_CODE_KEY_ENV)) {
      throw new Error("encrypted_code_key_release_required");
    }
    phase = "ciphertext";
    const ciphertext = await (0, import_promises2.readFile)(input.ciphertextPath);
    phase = "verification";
    plaintext = decryptEncryptedCode(ciphertext, runtime.env.require(ENCRYPTED_CODE_KEY_ENV), descriptor);
    phase = "directory";
    await (0, import_promises2.mkdir)(runtime.home, { recursive: true, mode: 448 });
    directory = await (0, import_promises2.mkdtemp)(import_node_path3.default.join(runtime.home, "encrypted-code-"));
    filename = import_node_path3.default.resolve(directory, "application.cjs");
    phase = "module_write";
    await (0, import_promises2.writeFile)(filename, plaintext, { mode: 384, flag: "wx" });
    plaintext.fill(0);
    plaintext = void 0;
    phase = "module_load";
    loadModule = (0, import_node_module.createRequire)((0, import_node_url.pathToFileURL)(filename));
    const module2 = loadModule(filename);
    phase = "entrypoint";
    const start = module2.start ?? module2.default?.start;
    if (typeof start !== "function")
      throw new Error("encrypted_code_start_missing");
    phase = "verified_event";
    await runtime.diagnostics.report({
      stage: "application.encrypted_code.loaded",
      status: "succeeded",
      code: "encrypted_code_verified",
      attrs: {
        plaintextDigest: descriptor.plaintextDigest,
        ciphertextDigest: descriptor.ciphertextDigest
      }
    });
    phase = "application_start";
    await start(runtime);
  } catch {
    await runtime.diagnostics.report({
      stage: `application.encrypted_code.refused.${phase}`,
      status: "failed",
      code: "encrypted_code_failure_detail",
      attrs: { phase }
    });
    await runtime.diagnostics.fatal({
      kind: "application_start",
      code: "encrypted_code_start_failed",
      message: `Encrypted application could not be verified and started (${phase})`,
      attrs: { phase }
    });
    throw new Error("encrypted_code_start_failed");
  } finally {
    plaintext?.fill(0);
    if (filename !== void 0 && loadModule !== void 0)
      delete loadModule.cache[filename];
    if (directory !== void 0)
      await (0, import_promises2.rm)(directory, { recursive: true, force: true });
  }
}
function digest(bytes) {
  return `sha256:${(0, import_node_crypto4.createHash)("sha256").update(bytes).digest("hex")}`;
}
function decodeCanonicalBase64(value, size) {
  const bytes = Buffer.from(value, "base64");
  if (bytes.length !== size || bytes.toString("base64") !== value) {
    throw new Error("encrypted_code_base64_invalid");
  }
  return bytes;
}

// actions/ipfs-pin/src/encrypted-loader.ts
async function run() {
  const descriptor = JSON.parse(await (0, import_promises3.readFile)(import_node_path4.default.join(__dirname, "encrypted-code.json"), "utf8"));
  const runtime = await bootstrapSlipwayRuntime({
    home: import_node_path4.default.join(__dirname, ".liskov"),
    bootstrap: { mode: "signed" },
    secrets: { mode: "required" },
    component: "encrypted-application"
  });
  try {
    await startEncryptedApplication({ runtime, descriptor, ciphertextPath: import_node_path4.default.join(__dirname, "encrypted-code.bin") });
  } catch {
    runtime.stop();
    process.exitCode = 1;
  }
}
void run().catch(() => {
  console.error("encrypted_code_bootstrap_failed");
  process.exitCode = 1;
});
