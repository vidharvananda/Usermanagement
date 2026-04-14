const TARGET_URL = "https://results.cbse.nic.in/";
const ALARM_NAME = "cbse-result-check";
const CHECK_INTERVAL_MINUTES = 15;
const OFFSCREEN_DOCUMENT_PATH = "offscreen.html";

function makeNotificationIcon() {
  const canvas = new OffscreenCanvas(128, 128);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#1a73e8";
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 42px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("CBSE", 64, 64);
  return canvas.convertToBlob({ type: "image/png" }).then((blob) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  });
}

function cleanText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function detect2026ResultAnnouncement(pageText) {
  const has2026 = /\b2026\b/i.test(pageText);
  const hasResultWords = /\b(result|results|examination result|exam result|board result)\b/i.test(pageText);
  const hasAnnouncementArea = /\b(current events|news and events|latest updates)\b/i.test(pageText);
  const isBoardContext = /\b(class[\s-]*(10|x|12|xii)|secondary school|senior school|board exam)\b/i.test(
    pageText
  );
  const isLikelyCtetOnly = /\bctet|teacher eligibility\b/i.test(pageText) && !isBoardContext;

  return has2026 && hasResultWords && hasAnnouncementArea && isBoardContext && !isLikelyCtetOnly;
}

async function ensureOffscreenDocument() {
  if (!chrome.offscreen?.createDocument) {
    return;
  }

  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);
  if (chrome.runtime.getContexts) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [offscreenUrl]
    });
    if (contexts.length > 0) {
      return;
    }
  }

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_PATH,
    reasons: ["AUDIO_PLAYBACK"],
    justification: "Play an alert tone when CBSE 2026 result is detected."
  });
}

async function playAlertSound() {
  try {
    await ensureOffscreenDocument();
    await chrome.runtime.sendMessage({ type: "play-alert-sound" });
  } catch (_error) {
    // Notification still appears even if sound fails.
  }
}

function parseChatIds(value) {
  return String(value || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

async function sendTelegramAlerts() {
  const state = await chrome.storage.local.get([
    "telegramEnabled",
    "telegramBotToken",
    "telegramChatIds"
  ]);

  if (!state.telegramEnabled) {
    return;
  }

  const botToken = String(state.telegramBotToken || "").trim();
  const chatIds = parseChatIds(state.telegramChatIds || "");

  if (!botToken || chatIds.length === 0) {
    throw new Error("Telegram is enabled but bot token or chat IDs are missing.");
  }

  const text =
    "CBSE 2026 result alert: A likely board result announcement was detected on results.cbse.nic.in.";

  for (const chatId of chatIds) {
    const response = await fetch(`https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Telegram send failed: ${response.status} ${errorText}`);
    }
  }
}

async function checkWebsite() {
  try {
    const response = await fetch(TARGET_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const text = cleanText(html);
    const announcementDetected = detect2026ResultAnnouncement(text);

    const state = await chrome.storage.local.get(["alreadyNotified"]);
    const alreadyNotified = Boolean(state.alreadyNotified);

    if (announcementDetected && !alreadyNotified) {
      const iconUrl = await makeNotificationIcon();
      await chrome.notifications.create({
        type: "basic",
        iconUrl,
        title: "CBSE 2026 Result Update",
        message: "A 2026 result announcement may be live on results.cbse.nic.in. Click to open.",
        priority: 2,
        requireInteraction: true
      });
      await playAlertSound();
      await chrome.tabs.create({ url: TARGET_URL });
      await sendTelegramAlerts();
      await chrome.storage.local.set({ alreadyNotified: true });
    }

    if (!announcementDetected && alreadyNotified) {
      await chrome.storage.local.set({ alreadyNotified: false });
    }

    await chrome.storage.local.set({
      lastCheckedAt: new Date().toISOString(),
      lastCheckMatched: announcementDetected,
      lastError: null
    });
  } catch (error) {
    await chrome.storage.local.set({
      lastCheckedAt: new Date().toISOString(),
      lastError: String(error)
    });
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  chrome.alarms.create(ALARM_NAME, {
    periodInMinutes: CHECK_INTERVAL_MINUTES
  });
  await checkWebsite();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(ALARM_NAME, {
    periodInMinutes: CHECK_INTERVAL_MINUTES
  });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    await checkWebsite();
  }
});

chrome.notifications.onClicked.addListener(() => {
  chrome.tabs.create({ url: TARGET_URL });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "check-now") {
    checkWebsite().then(async () => {
      const state = await chrome.storage.local.get([
        "lastCheckedAt",
        "lastCheckMatched",
        "lastError"
      ]);
      sendResponse(state);
    });
    return true;
  }

  if (message?.type === "get-status") {
    chrome.storage.local
      .get(["lastCheckedAt", "lastCheckMatched", "lastError"])
      .then((state) => sendResponse(state));
    return true;
  }

  if (message?.type === "save-telegram-config") {
    const payload = message.payload || {};
    chrome.storage.local
      .set({
        telegramEnabled: Boolean(payload.telegramEnabled),
        telegramBotToken: String(payload.telegramBotToken || "").trim(),
        telegramChatIds: String(payload.telegramChatIds || "").trim()
      })
      .then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message?.type === "get-telegram-config") {
    chrome.storage.local
      .get(["telegramEnabled", "telegramBotToken", "telegramChatIds"])
      .then((state) => {
        sendResponse({
          telegramEnabled: Boolean(state.telegramEnabled),
          telegramBotToken: state.telegramBotToken || "",
          telegramChatIds: state.telegramChatIds || ""
        });
      });
    return true;
  }

  return false;
});
