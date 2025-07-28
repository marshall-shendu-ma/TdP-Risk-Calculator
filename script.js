let hillChart, modelChart;
let isModel1 = true;
let Prob_Model1, Prob_Model2a, Prob_Model2b;

function addRow() {
  const tbody = document.getElementById("dataBody");
  const newRow = document.createElement("tr");
  newRow.innerHTML = `
    <td>
      <label class="sr-only">Conc (µM)</label>
      <input type="number" step="any" name="conc[]" required>
    </td>
    <td>
      <label class="sr-only">FPDc (ms)</label>
      <input type="number" step="any" name="fpdc[]" required>
    </td>
  `;
  tbody.appendChild(newRow);
}

document.getElementById("riskForm").addEventListener("submit", function(e) {
  e.preventDefault();
  // Calculate probabilities (same as before)
  const Cmax_nM = parseFloat(document.getElementById("cmax").value);
  const Cmax = Cmax_nM / 1000;
  const arrhythmia = parseInt(document.getElementById("arrhythmia").value);
  const cellType = parseFloat(document.getElementById("celltype").value);
  const assayTime = document.getElementById("assay").value;
  const rows = document.querySelectorAll("#dataBody tr");
  const concentrations = [], fpdcs = [];
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
  // Hill fit (unchanged)
  const Bottom = Math.min(...fpdcs);
  const Top = Math.max(...fpdcs);
  const guess = { Bottom, Top, EC50: median(concentrations), Hill: 1 };
  const hillFunc = (x, params) =>
    params.Bottom + (params.Top - params.Bottom) / (1 + Math.pow(params.EC50 / x, params.Hill));
  const loss = params => fpdcs.reduce((sum, y, i) => sum + Math.pow(hillFunc(concentrations[i]||0.01, params) - y, 2), 0);
  let best = {...guess}, minLoss = Infinity;
  for (let h = 0.1; h <= 5; h += 0.1) {
    for (let ec = 0.01; ec <= Math.max(...concentrations)*10; ec += 0.1) {
      const trial = {...guess, EC50: ec, Hill: h};
      const err = loss(trial);
      if (err < minLoss) {
        minLoss = err;
        best = trial;
      }
    }
  }
  const FPD_Cmax = hillFunc(Cmax || 0.01, best);
  const Predictor1 = arrhythmia;
  const Predictor4 = Math.max(...fpdcs);
  const Predictor7 = FPD_Cmax;
  Prob_Model1 = 1 / (1 + Math.exp(-(-0.1311 + Predictor1 + Predictor4*0.00687 + Predictor7*0.0232)));
  Prob_Model2a = 1 / (1 + Math.exp(-(-2.1102 + cellType*0.2211 + 0.00105*Predictor4 + 0.0338*Predictor7 + Predictor1)));
  Prob_Model2b = 1 / (1 + Math.exp(-(-0.1211 + cellType*0.2211 + 0.00105*Predictor4 + 0.0338*Predictor7 + Predictor1)));
  // QTc section unchanged
  const Threshold_FPDc = assayTime==="30" ? Bottom*1.103 : Bottom*1.0794;
  const EstQTcLogM = assayTime==="30" ? (Threshold_FPDc+0.35)/0.92 : (Threshold_FPDc+0.17)/0.93;
  const EstQTc_uM = Math.pow(10, EstQTcLogM);
  document.getElementById("estimatedQTc").innerHTML = `
    <strong>Estimated QTc (log M):</strong> ${EstQTcLogM.toFixed(4)}<br>
    <strong>Converted to µM:</strong> ${EstQTc_uM.toFixed(4)} µM
  `;
  // Create initial model panel
  if (modelChart) modelChart.destroy();
  isModel1 = true;
  updateModelPanel();
  // Attach toggle
  document.getElementById("toggleModelBtn").onclick = () => {
    isModel1 = !isModel1;
    updateModelPanel();
  };
  // Hill curve
  const minC = Math.max(0.001, Math.min(...concentrations));
  const maxC = Math.max(...concentrations);
  const fitX = Array.from({length:100},(_,i)=>Math.pow(10,Math.log10(minC)+i*(Math.log10(maxC)-Math.log10(minC))/99));
  const fitY = fitX.map(x=>hillFunc(x,best));
  if (hillChart) hillChart.destroy();
  hillChart = new Chart(document.getElementById("hillPlot"), {
    type:"line",
    data:{ labels:fitX, datasets:[
      { label:"Hill Fit Curve", data:fitX.map((x,i)=>({x,y:fitY[i]})), borderWidth:2, borderColor:"#2c7be5", fill:false, tension:0.1 },
      { label:"Cmax Point", data:[{x:Cmax,y:FPD_Cmax}], pointBackgroundColor:"#ff6b6b", pointRadius:6, type:"scatter" }
    ]},
    options:{ scales:{ x:{type:"logarithmic", title:{display:true,text:"Concentration (µM)"}}, y:{title:{display:true,text:"FPDc (ms)"}}}, plugins:{tooltip:{enabled:true}, legend:{position:"top"}} }
  });
});

function updateModelPanel() {
  const titleEl = document.getElementById("modelTitle");
  const subEl = document.getElementById("modelSubtitle");
  const resultsEl = document.getElementById("modelResults");
  let labels, data, label;
  if (isModel1) {
    titleEl.innerText = "Model 1 TdP Risk (Logistic Regression)";
    subEl.innerText = "Logistic regression predicting high or low risk.";
    resultsEl.innerHTML = `
      <p><strong>High or Intermediate Risk:</strong> ${(Prob_Model1*100).toFixed(1)}%</p>
      <p><strong>Low Risk:</strong> ${((1-Prob_Model1)*100).toFixed(1)}%</p>
    `;
    labels = ["High or Intermediate Risk", "Low Risk"];
    data = [Prob_Model1*100, (1-Prob_Model1)*100];
    label = "% TdP Risk (Model 1)";
  } else {
    titleEl.innerText = "Model 2 TdP Risk (Ordinal Regression)";
    subEl.innerText = "Ordinal regression predicting high, intermediate, and low risk.";
    resultsEl.innerHTML = `
      <p><strong>High Risk:</strong> ${(Prob_Model2a*100).toFixed(1)}%</p>
      <p><strong>Intermediate Risk:</strong> ${(Prob_Model2b*100).toFixed(1)}%</p>
      <p><strong>Low Risk:</strong> ${((1-Prob_Model2a-Prob_Model2b)*100).toFixed(1)}%</p>
    `;
    labels = ["High Risk", "Intermediate Risk", "Low Risk"];
    data = [Prob_Model2a*100, Prob_Model2b*100, (1-Prob_Model2a-Prob_Model2b)*100];
    label = "% TdP Risk (Model 2)";
  }
  modelChart = new Chart(document.getElementById("modelChart"), {
    type:"bar",
    data:{ labels, datasets:[{ label, data, backgroundColor: ["#f0ad4e", "#5cb85c"] }] },
    options:{ scales:{ y:{beginAtZero:true, max:100} }, plugins:{legend:{display:false}} }
  });
}

function median(arr) {
  const sorted=[...arr].sort((a,b)=>a-b), mid=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;
}