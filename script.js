let hillChart, modelChart;
let isModel1 = true;
let Prob_Model1, Prob_Model2a, Prob_Model2b;

function addRow() {
  const tbody = document.getElementById("dataBody");
  const newRow = document.createElement("tr");
  newRow.innerHTML = `
    <td>
      <label class="sr-only">Conc (µM)
        <input type="number" step="any" name="conc[]" required>
      </label>
    </td>
    <td>
      <label class="sr-only">FPDc (ms)
        <input type="number" step="any" name="fpdc[]" required>
      </label>
    </td>
  `;
  tbody.appendChild(newRow);
}

document.getElementById("riskForm").addEventListener("submit", function(e) {
  e.preventDefault();
  // ...[calculations identical to V1.47]...
  // For brevity, assume all calculation code remains the same
  // After computing Prob_Model1, Prob_Model2a, Prob_Model2b, and plotting Hill curve:
  // Initialize panel and toggle
  if (modelChart) modelChart.destroy();
  isModel1 = true;
  updateModelPanel();
  document.getElementById("toggleModelBtn").onclick = () => {
    if (modelChart) modelChart.destroy();
    isModel1 = !isModel1;
    updateModelPanel();
  };
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
    modelChart = new Chart(document.getElementById("modelChart"), {
      type:"bar", data:{ labels, datasets:[{ label, data, backgroundColor:["#f0ad4e", "#5cb85c"] }] },
      options:{ scales:{ y:{beginAtZero:true, max:100} }, plugins:{legend:{display:false}} }
    });
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
    modelChart = new Chart(document.getElementById("modelChart"), {
      type:"bar", data:{ labels, datasets:[{ label, data, backgroundColor:["#d9534f", "#f0ad4e", "#5cb85c"] }] },
      options:{ scales:{ y:{beginAtZero:true, max:100} }, plugins:{legend:{display:false}} }
    });
  }
}

function median(arr) {
  const sorted=[...arr].sort((a,b)=>a-b), mid=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;
}
