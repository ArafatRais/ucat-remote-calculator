(function () {
  "use strict";

  // ---------- Calculator engine (TI-108 style: chain calculation, no running-total display) ----------

  var state = {
    displayValue: "0",
    firstOperand: null,
    operator: null,
    waitingForSecondOperand: false,
    memory: 0,
  };

  var lastOperatorForRepeat = null;
  var lastOperandForRepeat = null;
  var memoryJustRecalled = false;

  var amHost = false;
  var hostOnly = false; // true = only the host may operate the calculator

  var OP_SYMBOL = { add: "+", subtract: "−", multiply: "×", divide: "÷" };
  var historyEntries = [];

  function calculate(first, second, operator) {
    switch (operator) {
      case "add": return first + second;
      case "subtract": return first - second;
      case "multiply": return first * second;
      case "divide": return second === 0 ? NaN : first / second;
      default: return second;
    }
  }

  function formatNumber(value) {
    if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) return "Error";
    var str = String(Math.round(value * 1e10) / 1e10);
    if (str.replace(/[-.]/g, "").length > 10) {
      str = value.toPrecision(8).toString();
    }
    return str;
  }

  function resetAfterError() {
    state.displayValue = "0";
    state.firstOperand = null;
    state.operator = null;
    state.waitingForSecondOperand = false;
  }

  function inputDigit(digit) {
    if (state.displayValue === "Error") resetAfterError();
    if (state.waitingForSecondOperand) {
      state.displayValue = digit;
      state.waitingForSecondOperand = false;
    } else {
      state.displayValue = state.displayValue === "0" ? digit : state.displayValue + digit;
    }
  }

  function inputDecimal() {
    if (state.displayValue === "Error") resetAfterError();
    if (state.waitingForSecondOperand) {
      state.displayValue = "0.";
      state.waitingForSecondOperand = false;
      return;
    }
    if (!state.displayValue.includes(".")) {
      state.displayValue += ".";
    }
  }

  function handleOperator(nextOperator) {
    if (state.displayValue === "Error") resetAfterError();
    var inputValue = parseFloat(state.displayValue);

    if (state.operator && state.waitingForSecondOperand) {
      state.operator = nextOperator;
      return;
    }

    if (state.firstOperand === null) {
      state.firstOperand = inputValue;
    } else if (state.operator) {
      var result = calculate(state.firstOperand, inputValue, state.operator);
      state.displayValue = formatNumber(result);
      state.firstOperand = typeof result === "number" && !Number.isNaN(result) ? result : null;
    }

    state.waitingForSecondOperand = true;
    state.operator = nextOperator;
  }

  function handleEquals() {
    if (state.displayValue === "Error") { resetAfterError(); return; }

    if (state.operator === null) {
      if (lastOperatorForRepeat !== null && lastOperandForRepeat !== null) {
        var a = parseFloat(state.displayValue);
        var repeatResult = calculate(a, lastOperandForRepeat, lastOperatorForRepeat);
        state.displayValue = formatNumber(repeatResult);
        logHistory(formatNumber(a) + " " + OP_SYMBOL[lastOperatorForRepeat] + " " + formatNumber(lastOperandForRepeat) + " = " + formatNumber(repeatResult));
      }
      return;
    }

    var second = state.waitingForSecondOperand ? state.firstOperand : parseFloat(state.displayValue);
    var result = calculate(state.firstOperand, second, state.operator);

    logHistory(formatNumber(state.firstOperand) + " " + OP_SYMBOL[state.operator] + " " + formatNumber(second) + " = " + formatNumber(result));

    lastOperatorForRepeat = state.operator;
    lastOperandForRepeat = second;

    state.displayValue = formatNumber(result);
    state.firstOperand = null;
    state.operator = null;
    state.waitingForSecondOperand = true;
  }

  function handleOnClear() {
    if (state.displayValue !== "0") {
      state.displayValue = "0";
      state.waitingForSecondOperand = false;
    } else {
      state.firstOperand = null;
      state.operator = null;
      state.waitingForSecondOperand = false;
      lastOperatorForRepeat = null;
      lastOperandForRepeat = null;
    }
  }

  function toggleSign() {
    if (state.displayValue === "Error" || state.displayValue === "0") return;
    state.displayValue = state.displayValue.startsWith("-")
      ? state.displayValue.slice(1)
      : "-" + state.displayValue;
  }

  function sqrtOp() {
    var v = parseFloat(state.displayValue);
    if (v < 0) { state.displayValue = "Error"; return; }
    var result = Math.sqrt(v);
    state.displayValue = formatNumber(result);
    state.waitingForSecondOperand = true;
    logHistory("√" + formatNumber(v) + " = " + formatNumber(result));
  }

  function percentOp() {
    var v = parseFloat(state.displayValue);
    if (state.operator && state.firstOperand !== null) {
      if (state.operator === "add") {
        var addResult = state.firstOperand + state.firstOperand * (v / 100);
        logHistory(formatNumber(state.firstOperand) + " + " + formatNumber(v) + "% = " + formatNumber(addResult));
        state.displayValue = formatNumber(addResult);
        state.firstOperand = null; state.operator = null; state.waitingForSecondOperand = true;
      } else if (state.operator === "subtract") {
        var subResult = state.firstOperand - state.firstOperand * (v / 100);
        logHistory(formatNumber(state.firstOperand) + " − " + formatNumber(v) + "% = " + formatNumber(subResult));
        state.displayValue = formatNumber(subResult);
        state.firstOperand = null; state.operator = null; state.waitingForSecondOperand = true;
      } else {
        state.displayValue = formatNumber(v / 100);
      }
    } else {
      state.displayValue = formatNumber(v / 100);
    }
  }

  function memoryAdd() { state.memory += parseFloat(state.displayValue) || 0; }
  function memorySubtract() { state.memory -= parseFloat(state.displayValue) || 0; }

  function memoryRecallClear() {
    if (memoryJustRecalled) {
      state.memory = 0;
      state.displayValue = "0";
      memoryJustRecalled = false;
    } else {
      state.displayValue = formatNumber(state.memory);
      state.waitingForSecondOperand = true;
      memoryJustRecalled = true;
    }
  }

  var ACTIONS = {
    add: function () { handleOperator("add"); },
    subtract: function () { handleOperator("subtract"); },
    multiply: function () { handleOperator("multiply"); },
    divide: function () { handleOperator("divide"); },
    equals: handleEquals,
    clear: handleOnClear,
    sign: toggleSign,
    sqrt: sqrtOp,
    percent: percentOp,
    decimal: inputDecimal,
    mrc: memoryRecallClear,
    mplus: memoryAdd,
    mminus: memorySubtract,
  };

  // ---------- Rendering ----------

  var displayMainEl = document.getElementById("displayMain");
  var memIndicatorEl = document.getElementById("memIndicator");
  var historyListEl = document.getElementById("historyList");
  var lockedBannerEl = document.getElementById("lockedBanner");

  function formatForDisplay(value) {
    if (value === "Error") return "Error";
    return value.includes(".") ? value : value + ".";
  }

  function render() {
    displayMainEl.textContent = formatForDisplay(state.displayValue);
    memIndicatorEl.classList.toggle("hidden", !state.memory);
  }

  function logHistory(text) {
    historyEntries.unshift(text);
    if (historyEntries.length > 300) historyEntries.length = 300;
    renderHistory();
  }

  function renderHistory() {
    historyListEl.innerHTML = "";
    if (historyEntries.length === 0) {
      var empty = document.createElement("li");
      empty.className = "history-empty";
      empty.textContent = "No calculations yet";
      historyListEl.appendChild(empty);
      return;
    }
    historyEntries.forEach(function (entry) {
      var li = document.createElement("li");
      li.textContent = entry;
      historyListEl.appendChild(li);
    });
  }

  function applyLock() {
    var locked = hostOnly && !amHost;
    document.querySelectorAll(".key").forEach(function (btn) { btn.disabled = locked; });
    lockedBannerEl.classList.toggle("hidden", !locked);
  }

  function flashKey(selector) {
    var el = document.querySelector(selector);
    if (!el) return;
    el.classList.add("flash-remote");
    setTimeout(function () { el.classList.remove("flash-remote"); }, 220);
  }

  function keySelectorFor(actionOrDigit, isDigit) {
    return isDigit ? '[data-digit="' + actionOrDigit + '"]' : '[data-action="' + actionOrDigit + '"]';
  }

  function perform(actionOrDigit, isDigit, isRemote) {
    if (actionOrDigit !== "mrc") memoryJustRecalled = false;

    if (isDigit) {
      inputDigit(actionOrDigit);
    } else {
      var fn = ACTIONS[actionOrDigit];
      if (fn) fn();
    }
    render();

    if (isRemote) {
      flashKey(keySelectorFor(actionOrDigit, isDigit));
    } else {
      broadcastAction(actionOrDigit, isDigit);
    }
  }

  document.querySelectorAll(".key").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var digit = btn.getAttribute("data-digit");
      var action = btn.getAttribute("data-action");
      if (digit) {
        perform(digit, true);
      } else if (action) {
        perform(action, false);
      }
    });
  });

  document.addEventListener("keydown", function (e) {
    if (e.target.tagName === "INPUT") return;
    if (hostOnly && !amHost) return;
    if (e.key >= "0" && e.key <= "9") { perform(e.key, true); return; }
    if (e.key === ".") { perform("decimal", false); return; }
    if (e.key === "+") { perform("add", false); return; }
    if (e.key === "-") { perform("subtract", false); return; }
    if (e.key === "*") { perform("multiply", false); return; }
    if (e.key === "/") { e.preventDefault(); perform("divide", false); return; }
    if (e.key === "%") { perform("percent", false); return; }
    if (e.key === "Enter" || e.key === "=") { perform("equals", false); return; }
    if (e.key === "Escape" || e.key === "Backspace" || e.key === "Delete") { perform("clear", false); return; }
    if (e.key.toLowerCase() === "x") { perform("sqrt", false); return; }
    if (e.key.toLowerCase() === "c") { perform("mrc", false); return; }
    if (e.key.toLowerCase() === "p") { perform("mplus", false); return; }
    if (e.key.toLowerCase() === "m") { perform("mminus", false); return; }
  });

  render();
  renderHistory();

  // ---------- Peer sync ----------

  var CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L ambiguity
  function generateCode() {
    var code = "";
    for (var i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    return code;
  }

  var peer = null;
  var conn = null;

  var statusPill = document.getElementById("statusPill");
  var statusText = document.getElementById("statusText");
  var sessionPanel = document.getElementById("sessionPanel");
  var waitingCard = document.getElementById("waitingCard");
  var startCard = document.querySelector(".session-card:not(#waitingCard)");
  var startBtn = document.getElementById("startBtn");
  var joinBtn = document.getElementById("joinBtn");
  var codeInput = document.getElementById("codeInput");
  var sessionError = document.getElementById("sessionError");
  var roomCodeText = document.getElementById("roomCodeText");
  var linkOutput = document.getElementById("linkOutput");
  var copyLinkBtn = document.getElementById("copyLinkBtn");
  var dismissWaitingBtn = document.getElementById("dismissWaitingBtn");
  var hostControlsEl = document.getElementById("hostControls");
  var allowTuteeToggle = document.getElementById("allowTuteeToggle");

  function setStatus(mode, text) {
    statusPill.className = "status-pill status-" + mode;
    statusText.textContent = text;
  }

  function showError(msg) {
    sessionError.textContent = msg;
    sessionError.classList.remove("hidden");
  }

  function hideSessionPanel() {
    sessionPanel.classList.add("hidden");
  }

  function showWaitingCard(code) {
    startCard.classList.add("hidden");
    waitingCard.classList.remove("hidden");
    roomCodeText.textContent = code;
    var url = new URL(window.location.href);
    url.search = "?room=" + code;
    linkOutput.value = url.toString();
  }

  function setupConnection(connection, isHost) {
    conn = connection;
    setStatus("waiting", "Connecting…");

    conn.on("open", function () {
      setStatus("connected", "Connected");
      hideSessionPanel();
      // The host's calculator may already be mid-use (e.g. while waiting for
      // the tutee to join) — send a one-time snapshot so the joiner catches up.
      // After this, both sides only ever exchange individual key presses, so a
      // stale snapshot can never clobber a newer result on either side.
      if (isHost) conn.send({ type: "sync", state: state, hostOnly: hostOnly, history: historyEntries });
    });

    conn.on("data", function (payload) {
      if (payload.type === "sync") {
        state = payload.state;
        hostOnly = !!payload.hostOnly;
        historyEntries = payload.history || [];
        render();
        renderHistory();
        applyLock();
        return;
      }
      if (payload.type === "mode") {
        hostOnly = !!payload.hostOnly;
        applyLock();
        return;
      }
      perform(payload.value, payload.isDigit, true);
    });

    conn.on("close", function () {
      setStatus("offline", "Disconnected");
    });

    conn.on("error", function () {
      setStatus("offline", "Connection error");
    });
  }

  function broadcastAction(value, isDigit) {
    if (conn && conn.open) {
      conn.send({ value: value, isDigit: isDigit });
    }
  }

  allowTuteeToggle.addEventListener("change", function () {
    hostOnly = !allowTuteeToggle.checked;
    if (conn && conn.open) conn.send({ type: "mode", hostOnly: hostOnly });
    applyLock();
  });

  function startSession() {
    var roomCode = generateCode();
    setStatus("waiting", "Starting session…");
    startBtn.disabled = true;
    amHost = true;
    hostControlsEl.classList.remove("hidden");

    peer = new Peer(roomCode);

    peer.on("open", function () {
      showWaitingCard(roomCode);
      setStatus("waiting", "Waiting for tutee…");
    });

    peer.on("connection", function (connection) {
      setupConnection(connection, true);
    });

    peer.on("error", function (err) {
      startBtn.disabled = false;
      if (err.type === "unavailable-id") {
        startSession(); // retry with a fresh code on the rare collision
      } else {
        showError("Could not start session (" + err.type + "). Please try again.");
        setStatus("offline", "Not connected");
      }
    });
  }

  function joinSession(code) {
    code = (code || "").trim().toUpperCase();
    if (!code) { showError("Enter a session code."); return; }

    amHost = false;
    sessionError.classList.add("hidden");
    joinBtn.disabled = true;
    setStatus("waiting", "Connecting…");

    peer = new Peer();

    peer.on("open", function () {
      var connection = peer.connect(code, { reliable: true });
      setupConnection(connection, false);
    });

    peer.on("error", function (err) {
      joinBtn.disabled = false;
      setStatus("offline", "Not connected");
      if (err.type === "peer-unavailable") {
        showError("No session found with that code. Check it and try again.");
      } else {
        showError("Could not connect (" + err.type + "). Please try again.");
      }
    });
  }

  startBtn.addEventListener("click", startSession);
  joinBtn.addEventListener("click", function () { joinSession(codeInput.value); });
  codeInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") joinSession(codeInput.value);
  });
  codeInput.addEventListener("input", function () {
    codeInput.value = codeInput.value.toUpperCase();
  });

  copyLinkBtn.addEventListener("click", function () {
    linkOutput.select();
    navigator.clipboard && navigator.clipboard.writeText(linkOutput.value);
    copyLinkBtn.textContent = "Copied!";
    setTimeout(function () { copyLinkBtn.textContent = "Copy link"; }, 1500);
  });

  dismissWaitingBtn.addEventListener("click", hideSessionPanel);

  // Auto-join if a room code is in the URL
  var params = new URLSearchParams(window.location.search);
  var roomParam = params.get("room");
  if (roomParam) {
    codeInput.value = roomParam.toUpperCase();
    joinSession(roomParam);
  }
})();
