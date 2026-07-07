const CALC_URL = "https://arafatrais.github.io/ucat-remote-calculator/";

async function findExistingTab() {
  const stored = await chrome.storage.session.get("calcTabId");
  const tabId = stored.calcTabId;
  if (!tabId) return null;
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab && tab.url && tab.url.indexOf(CALC_URL) === 0) return tab;
  } catch (e) {
    // Tab no longer exists.
  }
  return null;
}

chrome.action.onClicked.addListener(async () => {
  const existingTab = await findExistingTab();

  if (!existingTab) {
    // First run (or the tab was closed): open and load it in the background.
    // This click's user-activation gets used up here, not on requestWindow(),
    // since Document Picture-in-Picture needs to be called right at the
    // moment of a click — the *next* icon click (once this tab has loaded)
    // is the one that actually pops the floating window.
    const tab = await chrome.tabs.create({ url: CALC_URL, active: false, pinned: true });
    await chrome.storage.session.set({ calcTabId: tab.id });

    chrome.action.setBadgeBackgroundColor({ color: "#2f6fed" });
    chrome.action.setBadgeText({ text: "..." });

    const onUpdated = (updatedTabId, info) => {
      if (updatedTabId === tab.id && info.status === "complete") {
        chrome.action.setBadgeText({ text: "" });
        chrome.tabs.onUpdated.removeListener(onUpdated);
      }
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: existingTab.id },
      func: () => {
        if (window.__ucatTogglePip) window.__ucatTogglePip();
      },
    });
  } catch (err) {
    console.error("UCAT floating calculator: failed to toggle", err);
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const stored = await chrome.storage.session.get("calcTabId");
  if (stored.calcTabId === tabId) {
    await chrome.storage.session.remove("calcTabId");
  }
});
