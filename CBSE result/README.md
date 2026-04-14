# CBSE 2026 Result Notifier (Chrome Extension)

This extension checks `https://results.cbse.nic.in/` every 15 minutes and shows a Chrome notification when it detects a possible **2026 CBSE board (Class 10/12) result** announcement in areas like current events/news sections.

## Install

1. Open Chrome and go to `chrome://extensions/`.
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked**.
4. Select this folder: `CBSE result`.

## Use

- Click the extension icon and use **Check Now** to run an immediate check.
- Keep Chrome open in the background so periodic checks continue.
- When announcement is detected, you get a Chrome notification.
- When announcement is detected, it also plays an alert sound and auto-opens the results page in a new tab.
- Optional: enable Telegram alerts in popup by entering bot token and chat IDs.

## Telegram Setup

1. Create a bot with [@BotFather](https://t.me/BotFather) and copy the bot token.
2. Start a chat with your bot (send `/start` once from each Telegram account that should receive alerts).
3. Get each account's chat ID (or group chat ID) and put them comma-separated in **Chat IDs**.
4. In extension popup:
   - enable **Telegram alert**
   - paste **Bot Token**
   - paste **Chat IDs**
5. Click **Save Telegram Settings**.
6. Click **Check Now** to verify.

If Telegram is enabled but token/chat IDs are missing or invalid, the popup status shows the error in **Last error**.

## Notes

- Detection is keyword-based and focused on board-result context (Class 10/12, secondary/senior school) so CTET-only entries are ignored.
- If CBSE changes page structure or wording, update `detect2026ResultAnnouncement` in `background.js`.
