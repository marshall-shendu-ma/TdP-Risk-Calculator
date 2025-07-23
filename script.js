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
    ? [0.45, 0.55, 0] // Placeholder for Model 1
    : [0.3, 0.4, 0.3]; // Placeholder for Model 2

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
