#!/usr/bin/env node
/**
 * One-command deployment: Firebase (Firestore + rules + anonymous auth + web app) and Vercel.
 *
 *   VERCEL_TOKEN=...                          # required  (vercel.com/account/tokens)
 *   PORTFOLIO_FIREBASE_SERVICE_ACCOUNT='{…}'  # optional  (service-account JSON of the dedicated project)
 *   npm run deploy -- [--dry-run] [--skip-firebase] [--project portfolio-builder] [--location me-central2]
 *
 * Optional env: VERCEL_TEAM_ID (deploy into a team), FIRESTORE_LOCATION, GITHUB_REPO (owner/name to link
 * for automatic deployments, default HadiTAG7/Building-portfolio-).
 *
 * Every step is idempotent, so the script can be re-run after a partial failure. Secrets are never printed.
 */
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { JWT } from "google-auth-library";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const DRY_RUN = flag("dry-run");
const PROJECT_NAME = option("project", "portfolio-builder");
const LOCATION = option("location", process.env.FIRESTORE_LOCATION || "me-central2");
const TEAM_ID = process.env.VERCEL_TEAM_ID || "";
const GITHUB_REPO = process.env.GITHUB_REPO || "HadiTAG7/Building-portfolio-";
const WEB_APP_NAME = "portfolio-builder-web";

const log = (msg) => console.log(`• ${msg}`);
const warn = (msg) => console.warn(`! ${msg}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class HttpError extends Error {
  constructor(status, body, url) {
    super(`${status} ${url}: ${typeof body === "string" ? body : JSON.stringify(body)}`.slice(0, 600));
    this.status = status;
    this.body = body;
  }
}

async function http(url, { method = "GET", token, body, headers = {} } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = text;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    /* keep text */
  }
  if (!res.ok) throw new HttpError(res.status, data, url.replace(/\?.*$/, ""));
  return data;
}

/* ------------------------------------------------------------------ Firebase */

async function googleToken(sa) {
  const client = new JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ["https://www.googleapis.com/auth/cloud-platform", "https://www.googleapis.com/auth/firebase"],
  });
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Could not obtain a Google access token from the service account");
  return token;
}

async function waitOperation(token, url, name) {
  for (let i = 0; i < 90; i++) {
    const op = await http(`${url}/${name}`, { token });
    if (op.done) {
      if (op.error) throw new Error(`Operation failed: ${JSON.stringify(op.error)}`);
      return op.response ?? op;
    }
    await sleep(2000);
  }
  throw new Error(`Timed out waiting for ${name}`);
}

async function setupFirebase(sa) {
  const token = await googleToken(sa);
  const project = sa.project_id;
  log(`Firebase project: ${project}`);

  // 1. APIs used by the site.
  const services = ["firebase.googleapis.com", "firestore.googleapis.com", "firebaserules.googleapis.com", "identitytoolkit.googleapis.com"];
  try {
    const op = await http(`https://serviceusage.googleapis.com/v1/projects/${project}/services:batchEnable`, {
      method: "POST",
      token,
      body: { serviceIds: services },
    });
    if (op.name && !op.done) await waitOperation(token, "https://serviceusage.googleapis.com/v1", op.name);
    log("APIs enabled");
  } catch (e) {
    warn(`Could not enable APIs automatically (${e.status ?? e.message}); continuing in case they are already on`);
  }

  // 2. Make sure the Google Cloud project is a Firebase project.
  try {
    await http(`https://firebase.googleapis.com/v1beta1/projects/${project}`, { token });
  } catch (e) {
    if (e.status !== 404 && e.status !== 403) throw e;
    log("Adding Firebase to the project");
    const op = await http(`https://firebase.googleapis.com/v1beta1/projects/${project}:addFirebase`, { method: "POST", token, body: {} });
    await waitOperation(token, "https://firebase.googleapis.com/v1beta1", op.name);
  }

  // 3. Web app + its public config.
  const apps = await http(`https://firebase.googleapis.com/v1beta1/projects/${project}/webApps`, { token });
  let app = (apps.apps ?? []).find((a) => a.displayName === WEB_APP_NAME);
  if (!app) {
    log("Registering the web app");
    const op = await http(`https://firebase.googleapis.com/v1beta1/projects/${project}/webApps`, {
      method: "POST",
      token,
      body: { displayName: WEB_APP_NAME },
    });
    app = await waitOperation(token, "https://firebase.googleapis.com/v1beta1", op.name);
  }
  const config = await http(`https://firebase.googleapis.com/v1beta1/projects/${project}/webApps/${app.appId}/config`, { token });
  log(`Web app: ${app.appId}`);

  // 4. Firestore (default) database. Its location is permanent.
  const dbUrl = `https://firestore.googleapis.com/v1/projects/${project}/databases`;
  try {
    const db = await http(`${dbUrl}/(default)`, { token });
    log(`Firestore already exists (${db.locationId})`);
  } catch (e) {
    if (e.status !== 404) throw e;
    let created = false;
    for (const locationId of [LOCATION, "eur3"]) {
      try {
        log(`Creating Firestore in ${locationId}`);
        const op = await http(`${dbUrl}?databaseId=(default)`, { method: "POST", token, body: { type: "FIRESTORE_NATIVE", locationId } });
        await waitOperation(token, "https://firestore.googleapis.com/v1", op.name);
        created = true;
        break;
      } catch (err) {
        warn(`Firestore in ${locationId} failed: ${err.message.slice(0, 200)}`);
      }
    }
    if (!created) throw new Error("Could not create the Firestore database");
  }

  // 5. Security rules.
  const source = readFileSync(join(ROOT, "firestore.rules"), "utf8");
  const ruleset = await http(`https://firebaserules.googleapis.com/v1/projects/${project}/rulesets`, {
    method: "POST",
    token,
    body: { source: { files: [{ name: "firestore.rules", content: source }] } },
  });
  const releaseName = `projects/${project}/releases/cloud.firestore`;
  try {
    await http(`https://firebaserules.googleapis.com/v1/${releaseName}`, {
      method: "PATCH",
      token,
      body: { release: { name: releaseName, rulesetName: ruleset.name } },
    });
  } catch (e) {
    if (e.status !== 404) throw e;
    await http(`https://firebaserules.googleapis.com/v1/projects/${project}/releases`, {
      method: "POST",
      token,
      body: { name: releaseName, rulesetName: ruleset.name },
    });
  }
  log("Firestore rules deployed");

  // 6. Anonymous sign-in (identifies who saved which library entry).
  const authConfigUrl = `https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/config`;
  try {
    await http(authConfigUrl, { token });
  } catch (e) {
    if (e.status !== 404 && e.status !== 400) throw e;
    log("Initialising Firebase Authentication");
    await http(`https://identitytoolkit.googleapis.com/v2/projects/${project}/identityPlatform:initializeAuth`, { method: "POST", token, body: {} });
  }
  await http(`${authConfigUrl}?updateMask=signIn.anonymous.enabled`, {
    method: "PATCH",
    token,
    body: { signIn: { anonymous: { enabled: true } } },
  });
  log("Anonymous sign-in enabled");

  return {
    token,
    project,
    env: {
      NEXT_PUBLIC_FIREBASE_API_KEY: config.apiKey,
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: config.authDomain,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: config.projectId,
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: config.storageBucket ?? "",
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: config.messagingSenderId ?? "",
      NEXT_PUBLIC_FIREBASE_APP_ID: config.appId,
    },
  };
}

async function authorizeDomains(firebase, domains) {
  const url = `https://identitytoolkit.googleapis.com/admin/v2/projects/${firebase.project}/config`;
  const current = await http(url, { token: firebase.token });
  const merged = [...new Set([...(current.authorizedDomains ?? []), ...domains])];
  await http(`${url}?updateMask=authorizedDomains`, { method: "PATCH", token: firebase.token, body: { authorizedDomains: merged } });
  log(`Authorized domains: ${domains.join(", ")}`);
}

/* -------------------------------------------------------------------- Vercel */

const vercelUrl = (path) => `https://api.vercel.com${path}${TEAM_ID ? `${path.includes("?") ? "&" : "?"}teamId=${TEAM_ID}` : ""}`;

async function ensureVercelProject(token) {
  try {
    const p = await http(vercelUrl(`/v9/projects/${PROJECT_NAME}`), { token });
    log(`Vercel project exists: ${p.name}`);
    return p;
  } catch (e) {
    if (e.status !== 404) throw e;
  }
  log(`Creating Vercel project ${PROJECT_NAME}`);
  try {
    // Linking the GitHub repo gives automatic deployments on every push (needs the Vercel GitHub app).
    return await http(vercelUrl("/v11/projects"), {
      method: "POST",
      token,
      body: { name: PROJECT_NAME, framework: "nextjs", gitRepository: { type: "github", repo: GITHUB_REPO } },
    });
  } catch (e) {
    warn(`Could not link ${GITHUB_REPO} (${e.status}); creating the project without Git — deploys will come from this script`);
    return http(vercelUrl("/v11/projects"), { method: "POST", token, body: { name: PROJECT_NAME, framework: "nextjs" } });
  }
}

async function setVercelEnv(token, projectId, env) {
  const entries = Object.entries(env).filter(([, v]) => v);
  if (!entries.length) return;
  await http(vercelUrl(`/v10/projects/${projectId}/env?upsert=true`), {
    method: "POST",
    token,
    body: entries.map(([key, value]) => ({ key, value, type: "plain", target: ["production", "preview", "development"] })),
  });
  log(`Vercel env set: ${entries.map(([k]) => k).join(", ")}`);
}

function run(cmd, cmdArgs, env) {
  return new Promise((resolve, reject) => {
    let out = "";
    const child = spawn(cmd, cmdArgs, { cwd: ROOT, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.on("data", (d) => {
      out += d;
      process.stdout.write(d);
    });
    child.stderr.on("data", (d) => process.stderr.write(d));
    child.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`${cmd} exited with ${code}`))));
  });
}

async function deployVercel(token, project) {
  // Link the working copy to the project so the CLI never prompts.
  mkdirSync(join(ROOT, ".vercel"), { recursive: true });
  writeFileSync(join(ROOT, ".vercel", "project.json"), JSON.stringify({ projectId: project.id, orgId: project.accountId }, null, 2));
  const cliArgs = ["--yes", "vercel@latest", "deploy", "--prod", "--yes", "--token", token];
  if (TEAM_ID) cliArgs.push("--scope", TEAM_ID);
  const out = await run("npx", cliArgs, { VERCEL_ORG_ID: project.accountId, VERCEL_PROJECT_ID: project.id });
  const url = out.match(/https:\/\/[^\s]+\.vercel\.app/g)?.pop();
  return url;
}

/* ---------------------------------------------------------------------- main */

async function main() {
  const vercelToken = process.env.VERCEL_TOKEN;
  const saRaw = flag("skip-firebase") ? "" : process.env.PORTFOLIO_FIREBASE_SERVICE_ACCOUNT || "";
  let sa = null;
  if (saRaw) {
    try {
      sa = JSON.parse(saRaw);
    } catch {
      throw new Error("PORTFOLIO_FIREBASE_SERVICE_ACCOUNT is not valid JSON");
    }
    if (sa.type !== "service_account" || !sa.project_id || !sa.private_key) throw new Error("PORTFOLIO_FIREBASE_SERVICE_ACCOUNT is not a service-account key");
  }

  console.log("Plan:");
  console.log(`  Vercel project : ${PROJECT_NAME}${TEAM_ID ? ` (team ${TEAM_ID})` : ""} — ${vercelToken ? "token found" : "VERCEL_TOKEN missing"}`);
  console.log(`  Firebase       : ${sa ? `${sa.project_id} (Firestore ${LOCATION}, rules, anonymous auth)` : "skipped (no PORTFOLIO_FIREBASE_SERVICE_ACCOUNT)"}`);
  if (DRY_RUN) return;
  if (!vercelToken) throw new Error("VERCEL_TOKEN is required");

  const firebase = sa ? await setupFirebase(sa) : null;
  const project = await ensureVercelProject(vercelToken);
  if (firebase) await setVercelEnv(vercelToken, project.id, firebase.env);
  const deploymentUrl = await deployVercel(vercelToken, project);

  const domains = await http(vercelUrl(`/v9/projects/${project.id}/domains`), { token: vercelToken }).catch(() => ({ domains: [] }));
  const hosts = (domains.domains ?? []).map((d) => d.name);
  if (firebase && hosts.length) await authorizeDomains(firebase, hosts);

  console.log("\nDone.");
  if (hosts.length) console.log(`  Production: ${hosts.map((h) => `https://${h}`).join("  ")}`);
  if (deploymentUrl) console.log(`  Deployment: ${deploymentUrl}`);
}

main().catch((e) => {
  console.error(`\n✗ ${e.message}`);
  process.exit(1);
});
