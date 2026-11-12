/**
 * ============================================================================
 * SMART MANHOLE MONITORING SYSTEM - JAVASCRIPT CONTROLLER
 * Real-Time Safety & Unauthorized Access Detection
 * ============================================================================
 * 
 * Works DIRECTLY by double-clicking index.html (file:// protocol supported)
 * No Node.js, no bundler, no terminal required!
 * ============================================================================
 */

/* ============================================================================
   1. USER FIREBASE CONFIGURATION
   ============================================================================ */

/**
 * PASTE YOUR FIREBASE WEB CONFIGURATION HERE:
 * Get this from: Firebase Console -> Project Settings -> General -> "Your apps" (</>)
 */
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC2Uynd6QLm1NMPmD2Mmbvq0UxNh4TxHk8",
  authDomain: "smartmanhole-fedfc.firebaseapp.com",
  databaseURL: "https://smartmanhole-fedfc-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "smartmanhole-fedfc",
  storageBucket: "smartmanhole-fedfc.firebasestorage.app",
  messagingSenderId: "31767674654",
  appId: "1:31767674654:web:13d25fdb06975fd39e930f",
  measurementId: "G-H4BT5ZDKDS"
};

/**
 * DATABASE PATH: Change this variable if your ESP32 pushes to a different node.
 */
const DB_PATH = "sensorData";

/**
 * THRESHOLD & GENERAL CONFIGURATION
 */
const CONFIG = {
  DEFAULT_TILT_THRESHOLD: 25.0,  // MPU6050 angle > 25° indicates tilted/opened lid
  DEFAULT_GAS_THRESHOLD: 400,    // MQ135 gas reading > 400 indicates toxic sewer gas
  MAX_DATA_POINTS: 15,           // Number of samples shown in chart and table
  PRIORITIZE_INCOMING_STATUS: true // Preserves model predictions sent from ESP32
};

let currentTiltThreshold = CONFIG.DEFAULT_TILT_THRESHOLD;
let currentGasThreshold = CONFIG.DEFAULT_GAS_THRESHOLD;

/* ============================================================================
   2. DOM ELEMENT REFERENCES
   ============================================================================ */
const elements = {
  connectionPill: document.getElementById("connection-status-pill"),
  connectionText: document.getElementById("connection-status-text"),
  valTilt: document.getElementById("val-tilt-angle"),
  valGas: document.getElementById("val-gas-level"),
  valStatus: document.getElementById("val-manhole-status"),
  statusBadge: document.getElementById("status-badge-main"),
  statusCard: document.getElementById("card-status"),
  statusReason: document.getElementById("status-reason-text"),
  valUpdated: document.getElementById("val-last-updated"),
  lblRelativeTime: document.getElementById("lbl-relative-time"),
  dataSourceBadge: document.getElementById("data-source-badge"),
  barTiltFill: document.getElementById("bar-tilt-fill"),
  barGasFill: document.getElementById("bar-gas-fill"),
  tiltDeltaBadge: document.getElementById("tilt-delta"),
  gasDeltaBadge: document.getElementById("gas-delta"),
  lblTiltThreshold: document.getElementById("lbl-tilt-threshold"),
  lblGasThreshold: document.getElementById("lbl-gas-threshold"),
  alertsList: document.getElementById("alerts-list"),
  btnClearAlerts: document.getElementById("btn-clear-alerts"),
  tableBody: document.getElementById("telemetry-table-body"),
  tableRowCount: document.getElementById("table-row-count"),
  toggleSettingsBtn: document.getElementById("toggle-settings-btn"),
  settingsPanel: document.getElementById("settings-panel"),
  inputTiltThreshold: document.getElementById("input-tilt-threshold"),
  inputGasThreshold: document.getElementById("input-gas-threshold"),
  btnSaveThresholds: document.getElementById("btn-save-thresholds"),
  btnResetThresholds: document.getElementById("btn-reset-thresholds"),
  toggleSimBtn: document.getElementById("toggle-sim-btn")
};

let telemetryHistory = [];
let recentAlerts = [];
let isSimulating = false;
let simulationInterval = null;
// ML prediction and movement duration
let movementStartTime = null;
let currentDuration = 0;
const ML_API_URL = "http://127.0.0.1:5000/predict";

function calculateMovementDuration(tilt) {
  if (tilt > currentTiltThreshold) {
    if (movementStartTime === null) {
      movementStartTime = Date.now();
    }

    currentDuration = Math.round(
      (Date.now() - movementStartTime) / 1000
    );
  } else {
    movementStartTime = null;
    currentDuration = 0;
  }

  return currentDuration;
}

async function getMLPrediction(tilt, gas, duration) {
  try {
    const response = await fetch(ML_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        tilt_angle: tilt,
        gas_level: gas,
        duration: duration
      })
    });

    if (!response.ok) {
      throw new Error("ML API request failed");
    }

    const result = await response.json();

    console.log("ML Prediction:", result.prediction);

    return result.prediction;

  } catch (error) {
    console.error("ML Prediction Error:", error);
    return null;
  }
}

/* ============================================================================
   3. CHART.JS REAL-TIME DUAL-AXIS LINE GRAPH
   ============================================================================ */
const ctx = document.getElementById("liveSensorChart").getContext("2d");

const liveChart = new Chart(ctx, {
  type: "line",
  data: {
    labels: [],
    datasets: [
      {
        label: "Tilt Angle (°)",
        data: [],
        borderColor: "#06b6d4",
        backgroundColor: "rgba(6, 182, 212, 0.12)",
        borderWidth: 2.5,
        tension: 0.35,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 6,
        yAxisID: "yTilt"
      },
      {
        label: "Gas Level (PPM)",
        data: [],
        borderColor: "#f59e0b",
        backgroundColor: "rgba(245, 158, 11, 0.10)",
        borderWidth: 2.5,
        tension: 0.35,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 6,
        yAxisID: "yGas"
      }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        labels: {
          color: "#94a3b8",
          font: { family: "'Inter', sans-serif", size: 12 }
        }
      },
      tooltip: {
        backgroundColor: "#162032",
        titleColor: "#f3f4f6",
        bodyColor: "#94a3b8",
        borderColor: "#2e4168",
        borderWidth: 1
      }
    },
    scales: {
      x: {
        grid: { color: "rgba(255, 255, 255, 0.05)" },
        ticks: { color: "#64748b", font: { family: "'JetBrains Mono', monospace", size: 10 } }
      },
      yTilt: {
        type: "linear",
        position: "left",
        suggestedMin: 0,
        suggestedMax: 60,
        title: { display: true, text: "Tilt Angle (°)", color: "#06b6d4", font: { weight: "600", size: 11 } },
        grid: { color: "rgba(255, 255, 255, 0.05)" },
        ticks: { color: "#06b6d4" }
      },
      yGas: {
        type: "linear",
        position: "right",
        suggestedMin: 100,
        suggestedMax: 800,
        title: { display: true, text: "Gas Level (PPM)", color: "#f59e0b", font: { weight: "600", size: 11 } },
        grid: { drawOnChartArea: false },
        ticks: { color: "#f59e0b" }
      }
    }
  }
});

/* ============================================================================
   4. STATUS CLASSIFICATION LOGIC
   ============================================================================ */
function classifyManholeStatus(tilt, gas, incomingStatus) {
  // If hardware / ML model sent an explicit status, prioritize it
  if (CONFIG.PRIORITIZE_INCOMING_STATUS && incomingStatus && typeof incomingStatus === "string") {
    const s = incomingStatus.trim().toUpperCase();
    if (s.includes("SUSPICIOUS")) {
  return {
    statusText: "SUSPICIOUS",
    level: "danger",
    reason: "AI Prediction: Suspicious manhole activity detected"
  };
}

if (s.includes("ACCIDENTAL")) {
  return {
    statusText: "ACCIDENTAL",
    level: "warning",
    reason: "AI Prediction: Possible accidental movement"
  };
}

if (s.includes("MAINTENANCE")) {
  return {
    statusText: "MAINTENANCE",
    level: "warning",
    reason: "AI Prediction: Maintenance activity detected"
  };
}
    if (s.includes("UNAUTHORIZED") || s.includes("ACCESS") || s.includes("LIFT")) {
      return { statusText: "UNAUTHORIZED ACCESS", level: "danger", reason: "Model Classified: Manhole opened without authorization" };
    } else if (s.includes("HIGH ALERT") || s.includes("CRITICAL")) {
      return { statusText: "HIGH ALERT", level: "danger", reason: "Model Classified: Simultaneous abnormal tilt and gas leak" };
    } else if (s.includes("GAS") || s.includes("WARNING")) {
      return { statusText: "GAS WARNING", level: "warning", reason: "Model Classified: Elevated toxic/flammable gas concentration" };
    } else if (s.includes("NORMAL") || s.includes("SAFE")) {
      return { statusText: "NORMAL", level: "normal", reason: "All parameters within safe operating limits" };
    }
  }

  // Fallback / Initial Prototype Threshold Classification
  const isTiltAbnormal = typeof tilt === "number" && !isNaN(tilt) && tilt > currentTiltThreshold;
  const isGasAbnormal = typeof gas === "number" && !isNaN(gas) && gas > currentGasThreshold;

  if (isTiltAbnormal && isGasAbnormal) {
    return {
      statusText: "HIGH ALERT",
      level: "danger",
      reason: `Critical: Tilt exceeds ${currentTiltThreshold}° and Gas exceeds ${currentGasThreshold} PPM`
    };
  } else if (isTiltAbnormal) {
    return {
      statusText: "UNAUTHORIZED ACCESS",
      level: "danger",
      reason: `Cover tilted ${tilt.toFixed(1)}° (Limit: ${currentTiltThreshold}°)`
    };
  } else if (isGasAbnormal) {
    return {
      statusText: "GAS WARNING",
      level: "warning",
      reason: `Gas level at ${Math.round(gas)} PPM (Limit: ${currentGasThreshold} PPM)`
    };
  } else {
    return {
      statusText: "NORMAL",
      level: "normal",
      reason: "All parameters within safe operating limits"
    };
  }
}

/* ============================================================================
   5. UI UPDATE FUNCTIONS
   ============================================================================ */
  async function updateDashboardWithReading(reading) {
  if (!reading || typeof reading !== "object") return;

  const rawTilt = reading.tiltAngle !== undefined ? reading.tiltAngle : reading.tilt;
  const rawGas = reading.gasValue !== undefined ? reading.gasValue : reading.gas;
  const rawTimestamp = reading.timestamp || reading.time || new Date().toLocaleTimeString();
  const rawStatus = reading.status || null;

  const tilt = typeof rawTilt === "number" ? rawTilt : parseFloat(rawTilt);
  const gas = typeof rawGas === "number" ? rawGas : parseFloat(rawGas);

  const isValidTilt = !isNaN(tilt);
  const isValidGas = !isNaN(gas);
  const duration = calculateMovementDuration(
  isValidTilt ? tilt : 0
);

let mlPrediction = null;

if (isValidTilt && isValidGas) {
  mlPrediction = await getMLPrediction(
    tilt,
    gas,
    duration
  );
}

  const classification = classifyManholeStatus(
    isValidTilt ? tilt : 0, 
    isValidGas ? gas : 0, 
    mlPrediction || rawStatus
  );

  // Update Tilt Card
  if (isValidTilt) {
    elements.valTilt.textContent = tilt.toFixed(1);
    const tiltPercent = Math.min(100, Math.max(0, (tilt / 90) * 100));
    elements.barTiltFill.style.width = tiltPercent + "%";
    elements.barTiltFill.style.background = tilt > currentTiltThreshold ? "var(--color-danger)" : "var(--color-cyan)";
    elements.tiltDeltaBadge.textContent = tilt > currentTiltThreshold ? "Abnormal Tilt!" : "Normal Tilt";
    elements.tiltDeltaBadge.style.color = tilt > currentTiltThreshold ? "#f87171" : "#34d399";
  } else {
    elements.valTilt.textContent = "--";
    elements.barTiltFill.style.width = "0%";
    elements.tiltDeltaBadge.textContent = "No data";
  }

  // Update Gas Card
  if (isValidGas) {
    elements.valGas.textContent = Math.round(gas);
    const gasPercent = Math.min(100, Math.max(0, (gas / 1000) * 100));
    elements.barGasFill.style.width = gasPercent + "%";
    elements.barGasFill.style.background = gas > currentGasThreshold ? "var(--color-danger)" : "var(--color-warning)";
    elements.gasDeltaBadge.textContent = gas > currentGasThreshold ? "High Gas!" : "Clean Air";
    elements.gasDeltaBadge.style.color = gas > currentGasThreshold ? "#f87171" : "#34d399";
  } else {
    elements.valGas.textContent = "--";
    elements.barGasFill.style.width = "0%";
    elements.gasDeltaBadge.textContent = "No data";
  }

  // Update Status Card
  elements.valStatus.textContent = classification.statusText;
  elements.statusBadge.className = "status-badge " + classification.level;
  elements.statusReason.textContent = classification.reason;

  // Update Timestamp Card
  const formattedTime = formatTimestamp(rawTimestamp);
  elements.valUpdated.textContent = formattedTime;
  elements.lblRelativeTime.textContent = "Received at " + formattedTime;

  // Check and trigger alert
  checkAndTriggerAlert(classification, tilt, gas, formattedTime);

  // Update Graph
  addChartDataPoint(formattedTime, isValidTilt ? tilt : null, isValidGas ? gas : null);

  // Update Table
  addTableRow({
    timestamp: formattedTime,
    tilt: isValidTilt ? tilt.toFixed(1) + "°" : "--",
    gas: isValidGas ? Math.round(gas) + " PPM" : "--",
    status: classification.statusText,
    level: classification.level
  });
}

function formatTimestamp(ts) {
  if (!ts) return new Date().toLocaleTimeString();
  if (typeof ts === "string" && ts.includes(":")) return ts;
  const num = Number(ts);
  if (!isNaN(num)) {
    const d = new Date(num > 1e11 ? num : num * 1000);
    return d.toLocaleTimeString();
  }
  return String(ts);
}

function addChartDataPoint(label, tiltVal, gasVal) {
  liveChart.data.labels.push(label);
  liveChart.data.datasets[0].data.push(tiltVal);
  liveChart.data.datasets[1].data.push(gasVal);

  if (liveChart.data.labels.length > CONFIG.MAX_DATA_POINTS) {
    liveChart.data.labels.shift();
    liveChart.data.datasets[0].data.shift();
    liveChart.data.datasets[1].data.shift();
  }
  liveChart.update();
}

function addTableRow(record) {
  telemetryHistory.unshift(record);
  if (telemetryHistory.length > CONFIG.MAX_DATA_POINTS) telemetryHistory.pop();

  elements.tableRowCount.textContent = telemetryHistory.length;
  elements.tableBody.innerHTML = telemetryHistory.map(function(row) {
    let pillClass = "pill-normal";
    if (row.level === "warning") pillClass = "pill-warning";
    if (row.level === "danger") pillClass = "pill-danger";

    return (
      "<tr>" +
        "<td class=\"mono-font\">" + row.timestamp + "</td>" +
        "<td><strong>" + row.tilt + "</strong></td>" +
        "<td><strong>" + row.gas + "</strong></td>" +
        "<td><span class=\"pill-table " + pillClass + "\">" + row.status + "</span></td>" +
        "<td>" + row.level.toUpperCase() + "</td>" +
      "</tr>"
    );
  }).join("");
}

function checkAndTriggerAlert(classification, tilt, gas, timeStr) {
  if (classification.level === "normal") return;

  let alertMessage = "";
  if (classification.statusText === "HIGH ALERT") {
    alertMessage = "High Alert: Manhole tilted (" + tilt.toFixed(1) + "°) AND hazardous gas detected (" + Math.round(gas) + " PPM)!";
  } else if (classification.statusText === "UNAUTHORIZED ACCESS") {
    alertMessage = "Unauthorized Access Detected: Manhole cover tilted (" + tilt.toFixed(1) + "°)";
  } else if (classification.statusText === "GAS WARNING") {
    alertMessage = "Gas Warning: Toxic or flammable gas spike (" + Math.round(gas) + " PPM)";
  }

  if (recentAlerts.length > 0 && recentAlerts[0].msg === alertMessage) return;

  recentAlerts.unshift({
    level: classification.level,
    tag: classification.level === "danger" ? "CRITICAL" : "WARNING",
    msg: alertMessage,
    time: timeStr
  });

  if (recentAlerts.length > 20) recentAlerts.pop();
  renderAlerts();
}

function renderAlerts() {
  if (recentAlerts.length === 0) {
    elements.alertsList.innerHTML = (
      "<div class=\"empty-alerts-state\">" +
        "<svg viewBox=\"0 0 24 24\" width=\"32\" height=\"32\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\">" +
          "<circle cx=\"12\" cy=\"12\" r=\"10\"></circle>" +
          "<path d=\"M12 16v-4\"></path>" +
          "<path d=\"M12 8h.01\"></path>" +
        "</svg>" +
        "<p>No active alerts. System running normally.</p>" +
      "</div>"
    );
    return;
  }

  elements.alertsList.innerHTML = recentAlerts.map(function(a) {
    return (
      "<div class=\"alert-item " + a.level + "\">" +
        "<div class=\"alert-badge\">" + a.tag + "</div>" +
        "<div class=\"alert-details\">" +
          "<div class=\"alert-msg\">" + a.msg + "</div>" +
          "<div class=\"alert-time\">" + a.time + "</div>" +
        "</div>" +
      "</div>"
    );
  }).join("");
}

function setConnectionStatus(status, text) {
  elements.connectionPill.className = "status-pill " + status;
  elements.connectionText.textContent = text;
}

/* ============================================================================
   6. FIREBASE REALTIME DATABASE LISTENER
   ============================================================================ */


async function initFirebase() {
  try {

    if (firebaseConfig.apiKey === "PASTE_YOUR_API_KEY_HERE") {
      setConnectionStatus("disconnected", "Awaiting Config");
      elements.lblRelativeTime.textContent =
        "Paste your Firebase credentials in script.js";
      return;
    }

    setConnectionStatus("disconnected", "Connecting...");

    // Initialize Firebase
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }

    // Anonymous Authentication
    const auth = firebase.auth();

    const user = await new Promise((resolve, reject) => {

      const unsubscribe = auth.onAuthStateChanged(
        async function(currentUser) {

          if (currentUser) {
            unsubscribe();
            resolve(currentUser);
          } else {
            try {
              await auth.signInAnonymously();
            } catch (error) {
              unsubscribe();
              reject(error);
            }
          }
        }
      );

    });

    console.log("Anonymous login successful:", user.uid);

    // Connect Firebase Database
    const database = firebase.database();
    const sensorRef = database.ref(DB_PATH);

    // Avoid duplicate listeners
    sensorRef.off("value");

    sensorRef.on("value", function(snapshot) {

      if (!snapshot.exists()) {
        setConnectionStatus("connected", "Connected (Empty Node)");

        elements.lblRelativeTime.textContent =
          "Listening to '" + DB_PATH + "' (No data yet)";

        return;
      }

      setConnectionStatus("connected", "Connected");

      handleIncomingFirebaseData(snapshot.val());

    }, function(error) {

      console.error("Firebase RTDB Error:", error);

      setConnectionStatus("error", "Database Error");

      elements.lblRelativeTime.textContent =
        "Error: " + error.message;

    });

    // Connection observer
    database.ref(".info/connected").on("value", function(snap) {

      if (snap.val() === true) {
        console.log("Live socket connected to Firebase RTDB");
      }

    });

  } catch (err) {

    console.error("Firebase Authentication Error:", err);

    setConnectionStatus("error", "Authentication Error");

    elements.lblRelativeTime.textContent =
      "Firebase Error: " + err.message;

  }
}      

function handleIncomingFirebaseData(data) {
  if (!data || typeof data !== "object") return;

  // Case 1: Single reading object
  if ("tiltAngle" in data || "tilt" in data || "gasValue" in data || "gas" in data) {
    updateDashboardWithReading(data);
    return;
  }

  // Case 2: Multi-reading object / push history
  const keys = Object.keys(data);
  if (keys.length === 0) return;

  if (telemetryHistory.length === 0 && keys.length > 1) {
    const recentKeys = keys.slice(-CONFIG.MAX_DATA_POINTS);
    recentKeys.forEach(function(k) {
      if (data[k]) updateDashboardWithReading(data[k]);
    });
  } else {
    updateDashboardWithReading(data[keys[keys.length - 1]]);
  }
}

/* ============================================================================
   7. DEMO / SIMULATION MODE
   ============================================================================ */
function toggleSimulation() {
  isSimulating = !isSimulating;

  if (isSimulating) {
    elements.toggleSimBtn.style.background = "#2563eb";
    elements.toggleSimBtn.style.color = "#ffffff";
    elements.toggleSimBtn.innerHTML = "<span>Stop Sim</span>";
    setConnectionStatus("connected", "Demo Mode Active");
    elements.lblRelativeTime.textContent = "Generating simulated IoT sensor packets...";

    simulationInterval = setInterval(function() {
      const scenario = Math.random();
      let simTilt = 2.0 + Math.random() * 4.0;
      let simGas = 150 + Math.floor(Math.random() * 80);

      if (scenario > 0.85) {
        simTilt = 38.5 + Math.random() * 15;
        simGas = 520 + Math.floor(Math.random() * 200);
      } else if (scenario > 0.65) {
        simTilt = 32.0 + Math.random() * 25.0;
      } else if (scenario > 0.45) {
        simGas = 460 + Math.floor(Math.random() * 180);
      }

      updateDashboardWithReading({
        timestamp: new Date().toLocaleTimeString(),
        tiltAngle: parseFloat(simTilt.toFixed(1)),
        gasValue: simGas,
        status: null
      });
    }, 3000);

  } else {
    clearInterval(simulationInterval);
    elements.toggleSimBtn.style.background = "";
    elements.toggleSimBtn.style.color = "";
    elements.toggleSimBtn.innerHTML = "<span>Demo Sim</span>";
    setConnectionStatus("disconnected", "Simulation Paused");
    initFirebase();
  }
}

/* ============================================================================
   8. EVENT LISTENERS
   ============================================================================ */
elements.toggleSettingsBtn.addEventListener("click", function() {
  elements.settingsPanel.classList.toggle("hidden");
});

elements.btnSaveThresholds.addEventListener("click", function() {
  const newTilt = parseFloat(elements.inputTiltThreshold.value);
  const newGas = parseFloat(elements.inputGasThreshold.value);

  if (!isNaN(newTilt) && newTilt > 0) {
    currentTiltThreshold = newTilt;
    elements.lblTiltThreshold.textContent = newTilt + "°";
  }
  if (!isNaN(newGas) && newGas > 0) {
    currentGasThreshold = newGas;
    elements.lblGasThreshold.textContent = newGas + " PPM";
  }
  elements.settingsPanel.classList.add("hidden");
});

elements.btnResetThresholds.addEventListener("click", function() {
  currentTiltThreshold = CONFIG.DEFAULT_TILT_THRESHOLD;
  currentGasThreshold = CONFIG.DEFAULT_GAS_THRESHOLD;
  elements.inputTiltThreshold.value = currentTiltThreshold;
  elements.inputGasThreshold.value = currentGasThreshold;
  elements.lblTiltThreshold.textContent = currentTiltThreshold + "°";
  elements.lblGasThreshold.textContent = currentGasThreshold + " PPM";
  elements.settingsPanel.classList.add("hidden");
});

elements.btnClearAlerts.addEventListener("click", function() {
  recentAlerts = [];
  renderAlerts();
});

elements.toggleSimBtn.addEventListener("click", toggleSimulation);

// Start on load
window.addEventListener("DOMContentLoaded", function() {
  initFirebase();
});
