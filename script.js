let currentModel = 2;
let barChart;

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

  const loss = (params) =>
    fpdcs.reduce((sum, y, i) => {
      const x = concentrations[i] || 0.01;
      return sum + Math.pow(hillFunc(x, params) - y, 2);
    }, 0);

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
  const QTcEqUsed = assayTime === "30" ? "QTc = 0.92 × cAPD₉₀ − 0.35" : "QTc = 0.93 × cAPD₉₀ − 0.17";
  const EstQTcLogM = assayTime === "30" ? (Threshold_FPDc + 0.35) / 0.92 : (Threshold_FPDc + 0.17) / 0.93;

  const Threshold_C = bestParams.EC50 / Math.pow((bestParams.Top - bestParams.Bottom) / (Threshold_FPDc - bestParams.Bottom) - 1, 1 / bestParams.Hill);
  const Threshold_C_logM = Math.log10(Threshold_C * 1e-6);

  const P1_High = -0.1311 + Predictor1 + Predictor4 * 0.00687 + Predictor7 * 0.0232;
  const Prob_Model1 = 1 / (1 + Math.exp(-P1_High));

  const P2_a = -2.1102 + cellType * 0.2211 + 0.00105 * Predictor4 + 0.0338 * Predictor7 + Predictor1;
  const Prob_Model2a = 1 / (1 + Math.exp(-P2_a));
  const P2_b = -0.1211 + cellType * 0.2211 + 0.00105 * Predictor4 + 0.0338 * Predictor7 + Predictor1;
  const Prob_Model2b = 1 / (1 + Math.exp(-P2_b));

  // Show QTc estimates
  const estElem = document.getElementById("estimatedQTc");
  estElem.innerHTML = `<strong>Estimated QTc (log M):</strong> ${EstQTcLogM.toFixed(4)}<br><strong>Estimated QTc (µM):</strong> ${(Math.pow(10, EstQTcLogM + 6)).toFixed(4)}`;

  // Display bar chart
  updateRiskChart(Prob_Model1, Prob_Model2a, Prob_Model2b);

  // Hill plot
  const ctx = document.getElementById("hillPlot").getContext("2d");
  const fitX = Array.from({ length: 100 }, (_, i) =>
    Math.pow(10, Math.log10(Math.min(...concentrations) || 0.01) + i * (Math.log10(Math.max(...concentrations)) - Math.log10(Math.min(...concentrations) || 0.01)) / 99)
  );
  const fitY = fitX.map(x => hillFunc(x, bestParams));

  new Chart(ctx, {
    type: "line",
    data: {
      labels: fitX,
      datasets: [
        {
          label: "Hill Fit",
          data: fitY,
          borderColor: "#2c7be5",
          fill: false
        },
        {
          label: "Cmax Point",
          data: [{ x: Cmax, y: FPD_Cmax }],
          pointBackgroundColor: "red",
          showLine: false,
          type: "scatter",
          pointRadius: 5
        },
        {
          label: "Data",
          data: concentrations.map((x, i) => ({ x, y: fpdcs[i] })),
          type: "scatter",
          showLine: false,
          pointBackgroundColor: "#e55353",
          pointRadius: 5
        }
      ]
    },
    options: {
      scales: {
        x: {
          type: "log",
          title: { display: true, text: "Concentration (µM)" }
        },
        y: {
          title: { display: true, text: "FPDc (ms)" }
        }
      }
    }
  });
});

function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return arr.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function updateRiskChart(prob1, prob2a, prob2b) {
  const ctx = document.getElementById("riskBarChart").getContext("2d");

  const getData = () => {
    if (currentModel === 1) {
      return {
        label: "Model 1 Risk",
        data: [prob1 * 100, (1 - prob1) * 100, 0],
        labels: ["High/Intermediate", "Low", ""],
        colors: ["#f39c12", "#2ecc71", "#ccc"],
        description: "<p><strong>Model 1:</strong> Logistic regression using arrhythmia type, max FPDc, and Cmax FPDc.</p>"
      };
    } else {
      return {
        label: "Model 2 Risk",
        data: [prob2a * 100, prob2b * 100, (1 - prob2a - prob2b) * 100],
        labels: ["High", "Intermediate", "Low"],
        colors: ["#d9534f", "#f0ad4e", "#5cb85c"],
        description: "<p><strong>Model 2:</strong> Based on Blinova 2018 model incorporating cell type, FPDc, and Cmax effects.</p>"
      };
    }
  };

  const { label, data, labels, colors, description } = getData();
  document.getElementById("modelRiskDescription").innerHTML = description;
  document.getElementById("riskChartTitle").innerHTML = `${label} TdP Risk <button onclick="switchModel()">Switch TdP Risk Calculating Model</button>`;

  if (barChart) {
    barChart.data.labels = labels;
    barChart.data.datasets[0].data = data;
    barChart.data.datasets[0].backgroundColor = colors;
    barChart.update();
  } else {
    barChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          label,
          data,
          backgroundColor: colors
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            title: { display: true, text: "% Risk" }
          }
        }
      }
    });
  }
}

function switchModel() {
  currentModel = currentModel === 1 ? 2 : 1;
  document.getElementById("riskForm").dispatchEvent(new Event("submit"));
}
