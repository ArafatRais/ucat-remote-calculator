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
    // First run (or the tab was closed): open and load it. Document PiP
    // needs to be requested right at the moment of a click, so this click
    // is used up just getting the tab ready — the *next* icon click (once
    // it's loaded) is the one that actually pops the floating window.
    const tab = await chrome.tabs.create({ url: CALC_URL, active: true });
    await chrome.storage.session.set({ calcTabId: tab.id });
    return;
  }

  // Document Picture-in-Picture requires the requesting tab to actually be
  // the focused one — a background/inactive tab never gets the activation
  // needed to open it, no matter how many times you click. Bring it to the
  // front first, then trigger the toggle in that same click.
  await chrome.tabs.update(existingTab.id, { active: true });
  await chrome.windows.update(existingTab.windowId, { focused: true });

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
