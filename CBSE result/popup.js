function formatDate(value) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function renderStatus(state) {
  const matchStatus = document.getElementById("matchStatus");
  const lastChecked = document.getElementById("lastChecked");
  const errorLine = document.getElementById("errorLine");

  if (state.lastCheckMatched) {
    matchStatus.textContent = "Status: 2026 result keyword match detected.";
    matchStatus.style.color = "#0b8043";
  } else {
    matchStatus.textContent = "Status: no 2026 result announcement detected yet.";
    matchStatus.style.color = "#b06000";
  }

  lastChecked.textContent = `Last checked: ${formatDate(state.lastCheckedAt)}`;
  errorLine.textContent = state.lastError ? `Last error: ${state.lastError}` : "";
}

function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      resolve(response || {});
    });
  });
}

function getTelegramFormPayload() {
  return {
    telegramEnabled: document.getElementById("telegramEnabled").checked,
    telegramBotToken: document.getElementById("telegramBotToken").value.trim(),
    telegramChatIds: document.getElementById("telegramChatIds").value.trim()
  };
}

function applyTelegramConfig(config) {
  document.getElementById("telegramEnabled").checked = Boolean(config.telegramEnabled);
  document.getElementById("telegramBotToken").value = config.telegramBotToken || "";
  document.getElementById("telegramChatIds").value = config.telegramChatIds || "";
}

async function refresh() {
  const [state, telegramConfig] = await Promise.all([
    sendMessage({ type: "get-status" }),
    sendMessage({ type: "get-telegram-config" })
  ]);
  renderStatus(state);
  applyTelegramConfig(telegramConfig);
}

document.getElementById("checkNow").addEventListener("click", async () => {
  const button = document.getElementById("checkNow");
  button.disabled = true;
  button.textContent = "Checking...";
  const state = await sendMessage({ type: "check-now" });
  renderStatus(state);
  button.disabled = false;
  button.textContent = "Check Now";
});

document.getElementById("saveTelegramConfig").addEventListener("click", async () => {
  const status = document.getElementById("telegramSaveStatus");
  status.textContent = "Saving...";
  const payload = getTelegramFormPayload();
  const response = await sendMessage({
    type: "save-telegram-config",
    payload
  });
  if (response.ok) {
    status.textContent = "Telegram settings saved.";
  } else {
    status.textContent = "Could not save settings.";
  }
});

refresh();
