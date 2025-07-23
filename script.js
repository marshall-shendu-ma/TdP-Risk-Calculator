// script.js
let isModel1 = false;
let showInNM = false;
let qtcLogM = null;

function toggleQTUnit() {
  if (qtcLogM === null) return;
  const value = Math.pow(10, qtcLogM);
  const converted = showInNM ? value * 1e6 : value * 1e9;
  const unit = showInNM ? "µM" : "nM";
  document.getElementById("qtcValue").innerText = `${converted.toFixed(8)} ${unit}`;
  document.querySelector("#estimatedQTc button").innerText = showInNM ? "Switch to nM" : "Switch to µM";
  showInNM = !showInNM;
}

function switchModel() {
  isModel1 = !isModel1;
  const chartTitle = document.getElementById("riskChartTitle");
  const description = document.getElementById("modelRiskDescription");
  chartTitle.firstChild.textContent = isModel1 ? "Model 1 TdP Risk " : "Model 2 TdP Risk ";
  description.textContent = isModel1 ? "Logistic regression" : "Ordinal regression";
  drawRiskChart(isModel1);
}

function drawRiskChart(model1) {
  const ctx = document.getElementById("riskBarChart").getContext("2d");
  if (window.riskChart) window.riskChart.destroy();

  const data = model1
    ? [0.45, 0.55, 0]
    : [0.3, 0.4, 0.3];

  const labels = model1
    ? ["High or Intermediate Risk", "Low Risk", ""]
    : ["High Risk", "Intermediate Risk", "Low Risk"];

  window.riskChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: ["#e74c3c", "#f39c12", "#2ecc71"],
        borderWidth: 1
      }]
    },
    options: {
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 1
        }
      }
    }
  });
}

function updateQTcDisplay(logValue) {
  qtcLogM = logValue;
  showInNM = false;
  toggleQTUnit();
}

function drawHillPlot(xVals, yVals, cmax, fittedFunc) {
  const ctx = document.getElementById("hillPlot").getContext("2d");
  if (window.hillChart) window.hillChart.destroy();

  const fitX = [], fitY = [];
  for (let x = 0.001; x <= Math.max(...xVals) * 1.2; x += 0.01) {
    fitX.push(x);
    fitY.push(fittedFunc(x));
  }

  window.hillChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: fitX,
      datasets: [
        {
          label: 'Hill Fit Curve',
          data: fitY,
          borderColor: '#007bff',
          borderWidth: 2,
          fill: false,
          pointRadius: 0
        },
        {
          label: 'Data Points',
          type: 'scatter',
          data: xVals.map((x, i) => ({ x: x, y: yVals[i] })),
          backgroundColor: '#ff6384',
          pointRadius: 5
        },
        {
          label: 'Cmax',
          type: 'line',
          data: [
            { x: cmax, y: Math.min(...yVals) },
            { x: cmax, y: Math.max(...yVals) }
          ],
          borderColor: '#28a745',
          borderWidth: 2,
          borderDash: [6, 4],
          fill: false,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          type: 'linear',
          title: { display: true, text: 'Concentration (µM)' }
        },
        y: {
          title: { display: true, text: 'FPDc (ms)' }
        }
      }
    }
  });
}


function processInput() {
  const cmax = parseFloat(document.getElementById("cmax").value);
  const tableRows = document.querySelectorAll("#dataBody tr");

  const conc = [], fpd = [];
  for (let row of tableRows) {
    const inputs = row.querySelectorAll("input");
    const x = parseFloat(inputs[0].value);
    const y = parseFloat(inputs[1].value);
    if (!isNaN(x) && !isNaN(y)) {
      conc.push(x);
      fpd.push(y);
    }
  }

  const Emax = Math.max(...fpd);
  const EC50 = conc[Math.floor(conc.length / 2)];
  const HillSlope = 1.2;

  const fittedFunc = (x) => Emax * Math.pow(x, HillSlope) / (Math.pow(EC50, HillSlope) + Math.pow(x, HillSlope));

  drawHillPlot(conc, fpd, cmax, fittedFunc);

  const qtcLogM = -8.2;
  updateQTcDisplay(qtcLogM);

  drawRiskChart(isModel1);
}
