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

// The extension only opens/focuses the calculator tab. Popping it into a
// floating window is done with the "Pop out" button on the page itself —
// a real, direct click there is a genuine user gesture, which is what
// Document Picture-in-Picture actually requires. Trying to trigger that
// via a script injected from the extension (in response to the toolbar
// icon click) didn't reliably count as a valid gesture in testing.
chrome.action.onClicked.addListener(async () => {
  const existingTab = await findExistingTab();

  if (existingTab) {
    await chrome.tabs.update(existingTab.id, { active: true });
    await chrome.windows.update(existingTab.windowId, { focused: true });
    return;
  }

  const tab = await chrome.tabs.create({ url: CALC_URL, active: true });
  await chrome.storage.session.set({ calcTabId: tab.id });
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const stored = await chrome.storage.session.get("calcTabId");
  if (stored.calcTabId === tabId) {
    await chrome.storage.session.remove("calcTabId");
  }
});
