#!/usr/bin/env node
/**
 * Regenerate packages/sdk/src/schema.d.ts from a versioned OpenAPI document
 * published by ipago/platform.
 *
 * The pre-split generator read ../../apps/api. This script never reads a path
 * outside the repository. It downloads a platform release, pins that document
 * at packages/sdk/openapi/openapi.json, and runs openapi-typescript.
 *
 * Usage:
 *   pnpm generate:sdk <platform-release>
 *   pnpm generate:sdk --from-pin
 *
 * <platform-release> is a git tag on ipago/platform, for example v1.4.0.
 * Download order:
 *   1. GitHub release asset openapi.json (uses the releases API when
 *      PLATFORM_READ_TOKEN is set, so a private platform repo works)
 *   2. https://github.com/ipago/platform/releases/download/<tag>/openapi.json
 *   3. raw openapi.json, openapi/openapi.json, or apps/api/openapi.json at that tag
 *
 * --from-pin regenerates from the committed spec and does not use the network.
 * PLATFORM_READ_TOKEN is read from the environment and is never written to disk.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const specPath = path.join(root, "packages/sdk/openapi/openapi.json");
const outPath = path.join(root, "packages/sdk/src/schema.d.ts");
const pinPath = path.join(root, "packages/sdk/openapi/pin.json");
const sdkPackagePath = path.join(root, "packages/sdk/package.json");

const repo = "ipago/platform";

function fail(message) {
  console.error(message);
  process.exit(1);
}

function usage() {
  console.log(`Usage:
  pnpm generate:sdk <platform-release>
  pnpm generate:sdk --from-pin

<platform-release> is a git tag on ${repo}, for example v1.4.0.
--from-pin regenerates src/schema.d.ts from packages/sdk/openapi/openapi.json.`);
}

function generatorSpec() {
  const pkg = JSON.parse(fs.readFileSync(sdkPackagePath, "utf8"));
  const version = pkg.devDependencies?.["openapi-typescript"];
  if (!version) fail("@ipago/sdk is missing the openapi-typescript devDependency");
  return `openapi-typescript@${version}`;
}

function readPin() {
  return JSON.parse(fs.readFileSync(pinPath, "utf8"));
}

function writePin(release) {
  const pin = {
    repository: repo,
    release,
    spec: "openapi.json",
    generator: generatorSpec(),
  };
  fs.writeFileSync(pinPath, `${JSON.stringify(pin, null, 2)}\n`);
}

function assertOpenApi(body) {
  let json;
  try {
    json = JSON.parse(body);
  } catch {
    throw new Error("response was not JSON");
  }
  if (!json || typeof json !== "object" || typeof json.openapi !== "string" || !json.paths) {
    throw new Error("JSON is not an OpenAPI document");
  }
  return json;
}

async function fetchText(url, headers) {
  const response = await fetch(url, { headers, redirect: "follow" });
  return { response, body: response.ok ? await response.text() : "" };
}

async function downloadRelease(release) {
  const token = process.env.PLATFORM_READ_TOKEN || "";
  const headers = { "User-Agent": "ipago-js", Accept: "application/vnd.github+json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers["X-GitHub-Api-Version"] = "2022-11-28";
  }
  const tried = [];

  if (token) {
    const api = `https://api.github.com/repos/${repo}/releases/tags/${encodeURIComponent(release)}`;
    const { response, body } = await fetchText(api, headers);
    tried.push(`${api} -> ${response.status}`);
    if (response.ok) {
      let data;
      try {
        data = JSON.parse(body);
      } catch {
        data = {};
        tried.push(`${api} -> response was not a release payload`);
      }
      const asset = (data.assets ?? []).find((item) => item.name === "openapi.json");
      if (asset?.url) {
        const assetResult = await fetchText(asset.url, {
          ...headers,
          Accept: "application/octet-stream",
        });
        tried.push(`release asset openapi.json -> ${assetResult.response.status}`);
        if (assetResult.response.ok) {
          try {
            assertOpenApi(assetResult.body);
            return assetResult.body;
          } catch {
            tried.push("release asset openapi.json was not an OpenAPI document");
          }
        }
      }
    }
  }

  const urls = [
    `https://github.com/${repo}/releases/download/${encodeURIComponent(release)}/openapi.json`,
    `https://raw.githubusercontent.com/${repo}/${encodeURIComponent(release)}/openapi.json`,
    `https://raw.githubusercontent.com/${repo}/${encodeURIComponent(release)}/openapi/openapi.json`,
    `https://raw.githubusercontent.com/${repo}/${encodeURIComponent(release)}/apps/api/openapi.json`,
  ];
  for (const url of urls) {
    const { response, body } = await fetchText(url, headers);
    tried.push(`${url} -> ${response.status}`);
    if (!response.ok) continue;
    try {
      assertOpenApi(body);
      return body;
    } catch {
      // A 200 HTML page is not a spec. Try the next location.
    }
  }

  throw new Error(
    `Could not download an OpenAPI document from ${repo} release ${release}.\n${tried.join("\n")}\n` +
      "Set PLATFORM_READ_TOKEN if the platform repository is private.",
  );
}

function generate() {
  const pin = readPin();
  const expected = generatorSpec();
  if (pin.generator !== expected) {
    fail(`pin.json generator is ${pin.generator}, but @ipago/sdk depends on ${expected}`);
  }
  const result = spawnSync(
    "pnpm",
    ["--filter", "@ipago/sdk", "exec", "openapi-typescript", specPath, "-o", outPath],
    { cwd: root, stdio: "inherit" },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const arg = process.argv[2];
if (!arg || arg === "-h" || arg === "--help") {
  usage();
  process.exit(arg ? 0 : 1);
}

try {
  if (arg === "--from-pin") {
    if (!fs.existsSync(specPath)) fail(`missing pinned spec at ${specPath}`);
    generate();
  } else {
    if (process.argv.length > 3) fail("pass one platform release tag, or --from-pin");
    if (!/^[A-Za-z0-9._+-]+$/.test(arg)) {
      fail("platform release must be a tag such as v1.4.0");
    }
    const body = await downloadRelease(arg);
    fs.writeFileSync(specPath, body.endsWith("\n") ? body : `${body}\n`);
    writePin(arg);
    generate();
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
