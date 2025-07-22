// script.js
function addRow() {
  const tbody = document.getElementById("dataBody");
  const newRow = document.createElement("tr");
  newRow.innerHTML = `
    <td><input type="number" step="any" required></td>
    <td><input type="number" step="any" required></td>
  `;
  tbody.appendChild(newRow);
}

document.getElementById("riskForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const Cmax = parseFloat(document.getElementById("cmax").value) / 1000;
  const arrhythmia = parseInt(document.getElementById("arrhythmia").value);
  const cellType = parseFloat(document.getElementById("celltype").value);
  const assayTime = document.getElementById("assay").value;

  const rows = document.querySelectorAll("#dataBody tr");
  const concentrations = [];
  const fpdcs = [];
  rows.forEach(row => {
    const inputs = row.querySelectorAll("input");
    const conc = parseFloat(inputs[0].value);
    const fpd = parseFloat(inputs[1].value);
    if (!isNaN(conc) && !isNaN(fpd)) {
      concentrations.push(conc);
      fpdcs.push(fpd);
    }
  });

  if (concentrations.length < 3) {
    alert("Please enter at least 3 data points.");
    return;
  }

  const Bottom = Math.min(...fpdcs);
  const Top = Math.max(...fpdcs);
  const guess = { Bottom, Top, EC50: median(concentrations), Hill: 1 };

  const hillFunc = (x, params) =>
    params.Bottom + (params.Top - params.Bottom) / (1 + Math.pow(params.EC50 / x, params.Hill));

  const loss = (params) => {
    return fpdcs.reduce((sum, y, i) => {
      const x = concentrations[i] || 0.01;
      return sum + Math.pow(hillFunc(x, params) - y, 2);
    }, 0);
  };

  let bestParams = { ...guess };
  let minLoss = Infinity;
  for (let h = 0.1; h <= 5; h += 0.1) {
    for (let ec = 0.01; ec <= Math.max(...concentrations) * 10; ec += 0.1) {
      const trial = { ...guess, EC50: ec, Hill: h };
      const err = loss(trial);
      if (err < minLoss) {
        minLoss = err;
        bestParams = trial;
      }
    }
  }

  const FPD_Cmax = hillFunc(Cmax || 0.01, bestParams);
  const Predictor1 = arrhythmia;
  const Predictor4 = Math.max(...fpdcs);
  const Predictor7 = FPD_Cmax;

  const Threshold_FPDc = assayTime === "30" ? Bottom * 1.103 : Bottom * 1.0794;
  const QTcEqUsed = assayTime === "30"
    ? "QTc = 0.92 * x - 0.35"
    : "QTc = 0.93 * x - 0.17";
  const EstQTcLogM = assayTime === "30"
    ? (Threshold_FPDc + 0.35) / 0.92
    : (Threshold_FPDc + 0.17) / 0.93;

  const Threshold_C = bestParams.EC50 / Math.pow((bestParams.Top - bestParams.Bottom) / (Threshold_FPDc - bestParams.Bottom) - 1, 1 / bestParams.Hill);
  const Threshold_C_logM = Math.log10(Threshold_C * 1e-6);

  const P1_High = -0.1311 + Predictor1 + Predictor4 * 0.00687 + Predictor7 * 0.0232;
  const Prob_Model1 = 1 / (1 + Math.exp(-P1_High));

  const P2_a = -2.1102 + cellType * 0.2211 + 0.00105 * Predictor4 + 0.0338 * Predictor7 + Predictor1;
  const Prob_Model2a = 1 / (1 + Math.exp(-P2_a));

  const P2_b = -0.1211 + cellType * 0.2211 + 0.00105 * Predictor4 + 0.0338 * Predictor7 + Predictor1;
  const Prob_Model2b = 1 / (1 + Math.exp(-P2_b));

  const resultDiv = document.getElementById("results");
  resultDiv.innerHTML = `
    <h2>Results</h2>
    <p><strong>Model 1:</strong></p>
    <p>High/Intermediate TdP Risk: ${(Prob_Model1 * 100).toFixed(1)}%</p>
    <p>Low TdP Risk: ${((1 - Prob_Model1) * 100).toFixed(1)}%</p>
    <p><strong>Model 2:</strong></p>
    <p>High TdP Risk: ${(Prob_Model2a * 100).toFixed(1)}%</p>
    <p>Intermediate TdP Risk: ${(Prob_Model2b * 100).toFixed(1)}%</p>
    <p>Low TdP Risk: ${((1 - Prob_Model2a - Prob_Model2b) * 100).toFixed(1)}%</p>
    <p><strong>Threshold Concentration (uM):</strong> ${Threshold_C.toFixed(4)}</p>
    <p><strong>Threshold (log M):</strong> ${Threshold_C_logM.toFixed(4)}</p>
    <p><strong>QTc Equation Used:</strong> ${QTcEqUsed}</p>
    <p><strong>Estimated QTc (log M):</strong> ${EstQTcLogM.toFixed(4)}</p>
  `;

  const fitX = Array.from({ length: 100 }, (_, i) => Math.pow(10, Math.log10(Math.min(...concentrations) || 0.01) + i * (Math.log10(Math.max(...concentrations)) - Math.log10(Math.min(...concentrations) || 0.01)) / 99));
  const fitY = fitX.map(x => hillFunc(x, bestParams));

  new Chart(document.getElementById("hillPlot"), {
    type: "line",
    data: {
      labels: fitX,
      datasets: [
        { label: "Hill Fit", data: fitY, borderWidth: 2, borderColor: "#2c7be5", fill: false },
        { label: "Data", data: concentrations.map((x, i) => ({ x, y: fpdcs[i] })), showLine: false, borderColor: "#e55353", backgroundColor: "#e55353", pointRadius: 5, type: 'scatter' }
      ]
    },
    options: { scales: { x: { type: "log", title: { display: true, text: "Concentration (uM)" } }, y: { title: { display: true, text: "FPDc (ms)" } } } }
  });

  new Chart(document.getElementById("riskBarChart"), {
    type: "bar",
    data: {
      labels: ["High", "Intermediate", "Low"],
      datasets: [{
        label: "% TdP Risk (Model 2)",
        data: [Prob_Model2a * 100, Prob_Model2b * 100, (1 - Prob_Model2a - Prob_Model2b) * 100],
        backgroundColor: ["#d9534f", "#f0ad4e", "#5cb85c"]
      }]
    },
    options: { scales: { y: { beginAtZero: true, max: 100, title: { display: true, text: "% Risk" } } } }
  });
});

function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
