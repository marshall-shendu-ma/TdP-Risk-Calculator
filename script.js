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

  const qtcLogM = -8.2; // Replace with real model output if needed
  updateQTcDisplay(qtcLogM);

  drawRiskChart(isModel1);
}

function updateQTcDisplay(logValue) {
  qtcLogM = logValue;
  showInNM = false;
  document.getElementById("qtcValueLog").innerText = logValue.toFixed(4);
  toggleQTUnit();
}
