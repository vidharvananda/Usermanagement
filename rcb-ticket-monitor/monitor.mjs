#!/usr/bin/env node
/**
 * Polls https://shop.royalchallengers.com/ticket (logged in) and sends a desktop
 * notification when ticket purchase UI appears. Adjust selectors in .env to match
 * the live site after you inspect it in DevTools.
 *
 * Usage:
 *   npm install && npm run install-browser
 *   cp .env.example .env   # then edit .env
 *   npm run login-once     # optional: headed login to save storage state (mobile OTP or email)
 *   npm start
 */

import "dotenv/config";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import notifier from "node-notifier";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TICKET_URL = "https://shop.royalchallengers.com/ticket";
const LOGIN_URL = "https://shop.royalchallengers.com/auth?callbackUrl=/rcbian/mypage";
const STORAGE_PATH = path.join(__dirname, ".auth-state.json");
const FLAG_LOGIN_ONLY = process.argv.includes("--login-only");

const email = process.env.RCB_EMAIL ?? "";
const password = process.env.RCB_PASSWORD ?? "";
const AUTO_OTP = String(process.env.RCB_AUTO_OTP ?? "false").toLowerCase() === "true";
const OTP_REGEX = process.env.RCB_OTP_REGEX ?? "\\b\\d{4,8}\\b";
const OTP_TIMEOUT_SEC = Math.max(10, Number(process.env.RCB_OTP_TIMEOUT_SEC ?? 75) || 75);
const OTP_POLL_SEC = Math.max(1, Number(process.env.RCB_OTP_POLL_SEC ?? 2) || 2);
const OTP_TEXT_HINT = (process.env.RCB_OTP_TEXT_HINT ?? "").trim().toLowerCase();

function looksLikePlaceholderCredentials(emailRaw, passwordRaw) {
  const e = (emailRaw ?? "").trim().toLowerCase();
  const p = (passwordRaw ?? "").trim();
  if (!e || !p) return false;
  if (e === "you@example.com" && p === "your_password") return true;
  return false;
}
/** Digits / + / spaces as you would type on the site (e.g. +91 98765 43210) */
const mobile = (process.env.RCB_MOBILE ?? "").trim();
/** If unset during login, you are prompted on stdin (works with OTP delivered to Mac via iPhone). */
const otpFromEnv = (process.env.RCB_OTP ?? "").trim();
const pollSec = Math.max(15, Number(process.env.POLL_INTERVAL_SEC ?? 60) || 60);
const headless = String(process.env.HEADLESS ?? "true").toLowerCase() !== "false";

const availabilitySelector = (process.env.AVAILABILITY_SELECTOR ?? "").trim();
const availabilityTextRegex = (process.env.AVAILABILITY_TEXT_REGEX ?? "").trim();
const blockedSelector = (process.env.BLOCKED_SELECTOR ?? "").trim();
const blockedTextRegex = (process.env.BLOCKED_TEXT_REGEX ?? "").trim();

let lastAvailable = null;

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const execFileAsync = promisify(execFile);

function buildBlockedRegex() {
  if (!blockedTextRegex) return null;
  try {
    return new RegExp(blockedTextRegex, "i");
  } catch {
    console.error("Invalid BLOCKED_TEXT_REGEX; ignoring.");
    return null;
  }
}

function buildAvailRegex() {
  if (!availabilityTextRegex) return null;
  try {
    return new RegExp(availabilityTextRegex, "i");
  } catch {
    console.error("Invalid AVAILABILITY_TEXT_REGEX; ignoring.");
    return null;
  }
}

async function notify(title, message) {
  notifier.notify({ title, message, sound: true, wait: false });
  console.log(`[notify] ${title}: ${message}`);
}

async function promptForOtp() {
  if (otpFromEnv) {
    return otpFromEnv;
  }
  if (AUTO_OTP) {
    const autoOtp = await waitForOtpFromMacMessages();
    if (autoOtp) {
      console.log("Auto-captured OTP from Mac Messages.");
      return autoOtp;
    }
    console.warn("Could not auto-read OTP in time; falling back to manual input.");
  }
  if (!process.stdin.isTTY) {
    console.error(
      "RCB_OTP is not set and stdin is not a TTY — set RCB_OTP in the environment for this run, or run login from an interactive terminal."
    );
    return "";
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const otp = (await rl.question("Enter the OTP sent to your phone: ")).trim();
    return otp;
  } finally {
    rl.close();
  }
}

function extractOtpFromText(text) {
  if (!text) return "";
  try {
    const re = new RegExp(OTP_REGEX, "i");
    const m = text.match(re);
    return m?.[0]?.trim() ?? "";
  } catch {
    const fallback = text.match(/\b\d{4,8}\b/);
    return fallback?.[0] ?? "";
  }
}

async function readLatestOtpFromMacMessages() {
  const dbPath = path.join(os.homedir(), "Library", "Messages", "chat.db");
  const sql = `
SELECT COALESCE(text, ''), COALESCE(hex(attributedBody), '')
FROM message
ORDER BY date DESC
LIMIT 80;
`;
  const { stdout } = await execFileAsync("sqlite3", [dbPath, sql], {
    timeout: 4000,
    maxBuffer: 1024 * 1024,
  });
  const rows = (stdout ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const candidates = [];
  for (const row of rows) {
    const [plainText = "", attributedHex = ""] = row.split("|", 2);
    if (plainText) {
      candidates.push(plainText);
    }
    if (attributedHex) {
      try {
        const decoded = Buffer.from(attributedHex, "hex")
          .toString("utf8")
          // Keep printable chars; attributed payload has a lot of binary noise.
          .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ");
        candidates.push(decoded);
      } catch {
        // ignore malformed blobs
      }
    }
  }

  for (const text of candidates) {
    const lowered = text.toLowerCase();
    if (OTP_TEXT_HINT && !lowered.includes(OTP_TEXT_HINT)) continue;
    if (!/(otp|code|verification|one[- ]?time|password|\b\d{4,8}\b)/i.test(text)) continue;
    const otp = extractOtpFromText(text);
    if (otp) {
      return otp;
    }
  }
  return "";
}

async function waitForOtpFromMacMessages() {
  const deadline = Date.now() + OTP_TIMEOUT_SEC * 1000;
  while (Date.now() < deadline) {
    try {
      const otp = await readLatestOtpFromMacMessages();
      if (otp) return otp;
    } catch (error) {
      const msg = String(error?.message ?? "");
      if (msg.includes("unable to open database file") || msg.includes("permission")) {
        console.warn(
          "Auto OTP read needs macOS Full Disk Access for the terminal/Node process (Messages DB)."
        );
        return "";
      }
    }
    await delay(OTP_POLL_SEC * 1000);
  }
  return "";
}

async function openAccountLoginIfNeeded(page) {
  const alreadyOut = page.getByRole("link", { name: /logout/i });
  if ((await alreadyOut.count()) > 0) {
    console.log("Already logged in (Logout visible).");
    return true;
  }

  const account = page.getByRole("link", { name: /my account/i }).first();
  if ((await account.count()) > 0) {
    await account.click();
    await delay(2000);
  }

  const signIn = page.getByRole("link", { name: /sign in|log in|login/i }).first();
  if ((await signIn.count()) > 0) {
    await signIn.click();
    await delay(1500);
  }

  return false;
}

async function trySwitchToMobileLogin(page) {
  const mobileTab = page
    .getByRole("button", { name: /mobile|phone|sms|otp/i })
    .or(page.getByRole("tab", { name: /mobile|phone|sms|otp/i }))
    .or(page.getByText(/login with (phone|mobile|otp)/i))
    .first();
  if ((await mobileTab.count()) > 0 && (await mobileTab.isVisible().catch(() => false))) {
    await mobileTab.click();
    await delay(800);
  }
}

async function tryMobileOtpLogin(page) {
  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await delay(3000);

  if (await openAccountLoginIfNeeded(page)) {
    return;
  }

  await trySwitchToMobileLogin(page);

  const mobileInput = page
    .locator(
      'input[type="tel"], input[name*="phone" i]:not([name*="otp" i]), input[name*="mobile" i]:not([name*="otp" i]), input[id*="phone" i]:not([id*="otp" i]), input[id*="mobile" i], input[placeholder*="phone" i]:not([placeholder*="otp" i]), input[placeholder*="mobile" i]'
    )
    .first();

  if ((await mobileInput.count()) === 0) {
    console.warn(
      "Could not find a phone number field. Use HEADLESS=false, complete login manually, then re-run with --login-only to save session."
    );
    return;
  }

  await mobileInput.click();
  await mobileInput.fill(mobile);

  const sendOtp = page
    .getByRole("button", { name: /send otp|get otp|request otp|resend otp|continue|next/i })
    .first();
  if ((await sendOtp.count()) > 0 && (await sendOtp.isVisible().catch(() => false))) {
    await sendOtp.click();
  } else {
    await mobileInput.press("Enter");
  }

  await delay(1500);

  const otpInput = page
    .locator(
      'input[autocomplete="one-time-code"], input[name*="otp" i], input[id*="otp" i], input[placeholder*="otp" i], input[placeholder*="verification" i], input[inputmode="numeric"][name*="otp" i]'
    )
    .first();

  try {
    await otpInput.waitFor({ state: "visible", timeout: 45_000 });
  } catch {
    console.warn(
      "OTP field did not appear in time. Check the page or run with HEADLESS=false and finish login by hand."
    );
    return;
  }

  const otp = await promptForOtp();
  if (!otp) {
    return;
  }

  await otpInput.fill(otp);

  const verify = page
    .getByRole("button", { name: /verify|submit|continue|sign in|log in|login|confirm/i })
    .first();
  if ((await verify.count()) > 0 && (await verify.isVisible().catch(() => false))) {
    await verify.click();
  } else {
    await otpInput.press("Enter");
  }

  await delay(5000);
  await page.context().storageState({ path: STORAGE_PATH });
  console.log("Saved session to .auth-state.json");
}

async function tryEmailPasswordLogin(page) {
  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await delay(3000);

  if (await openAccountLoginIfNeeded(page)) {
    return;
  }

  const emailInput = page.locator('input[type="email"], input[name*="email" i], input[id*="email" i]').first();
  const passInput = page.locator('input[type="password"]').first();

  if ((await emailInput.count()) === 0 || (await passInput.count()) === 0) {
    console.warn(
      "Could not find email/password fields (many sites use phone + OTP only). Set RCB_MOBILE in .env, or open with HEADLESS=false and log in manually, then re-run with --login-only to save session."
    );
    return;
  }

  await emailInput.fill(email);
  await passInput.fill(password);

  const submit = page.getByRole("button", { name: /sign in|log in|login|submit/i }).first();
  if ((await submit.count()) > 0) {
    await submit.click();
  } else {
    await passInput.press("Enter");
  }

  await delay(5000);
  await page.context().storageState({ path: STORAGE_PATH });
  console.log("Saved session to .auth-state.json");
}

async function tryLogin(page) {
  if (mobile) {
    await tryMobileOtpLogin(page);
    return;
  }

  if (looksLikePlaceholderCredentials(email, password)) {
    console.warn(
      "RCB_EMAIL / RCB_PASSWORD are still the .env.example placeholders — the shop uses mobile OTP. Set RCB_MOBILE to your phone number (same format as on the site), then run login-once again."
    );
    return;
  }

  if (!email || !password) {
    console.warn("Set RCB_MOBILE for OTP login, or RCB_EMAIL + RCB_PASSWORD — skipping automated login.");
    return;
  }

  await tryEmailPasswordLogin(page);
}

async function detectAvailability(page) {
  const bodyText = await page.locator("body").innerText().catch(() => "");

  const blockedRe = buildBlockedRegex();
  if (blockedRe && blockedRe.test(bodyText)) {
    return false;
  }

  if (blockedSelector) {
    const blocked = page.locator(blockedSelector).first();
    if ((await blocked.count()) > 0 && (await blocked.isVisible().catch(() => false))) {
      return false;
    }
  }

  if (availabilitySelector) {
    const el = page.locator(availabilitySelector).first();
    return (await el.count()) > 0 && (await el.isVisible().catch(() => false));
  }

  const availRe = buildAvailRegex();
  if (availRe && availRe.test(bodyText)) {
    return true;
  }

  return false;
}

async function runCheck(browser) {
  const hasState = await fs
    .access(STORAGE_PATH)
    .then(() => true)
    .catch(() => false);

  const context = await browser.newContext(
    hasState
      ? { storageState: STORAGE_PATH }
      : {
          userAgent:
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        }
  );

  const page = await context.newPage();
  try {
    await page.goto(TICKET_URL, { waitUntil: "networkidle", timeout: 120_000 }).catch(() =>
      page.goto(TICKET_URL, { waitUntil: "domcontentloaded", timeout: 120_000 })
    );
    await delay(4000);

    if (!hasState || (await page.getByRole("link", { name: /logout/i }).count()) === 0) {
      await tryLogin(page);
    }

    const available = await detectAvailability(page);
    const ts = new Date().toISOString();
    console.log(`[${ts}] tickets available: ${available}`);

    if (lastAvailable === false && available === true) {
      await notify("RCB tickets", "Ticket purchase may be open — check the shop tab.");
    }
    lastAvailable = available;
  } finally {
    await context.close();
  }
}

async function main() {
  if (!FLAG_LOGIN_ONLY && !availabilitySelector && !availabilityTextRegex) {
    console.error("Set AVAILABILITY_SELECTOR or AVAILABILITY_TEXT_REGEX in .env (inspect the live ticket page).");
    process.exit(1);
  }

  const browser = await chromium.launch({ headless, channel: "chrome" }).catch(() =>
    chromium.launch({ headless })
  );

  if (FLAG_LOGIN_ONLY) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await tryLogin(page);
    await browser.close();
    return;
  }

  await notify("RCB monitor", `Started — polling every ${pollSec}s`);

  for (;;) {
    try {
      await runCheck(browser);
    } catch (e) {
      console.error("Check failed:", e?.message ?? e);
    }
    await new Promise((r) => setTimeout(r, pollSec * 1000));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
