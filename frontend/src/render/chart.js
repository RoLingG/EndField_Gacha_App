import { getGachaChartInstance, setGachaChartInstance } from '../state.js';

export function updateOrCreateChart(items) {
  const rarityCounts = { 4: 0, 5: 0, 6: 0 };
  items.forEach(item => {
    if (rarityCounts[item.rarity] !== undefined) rarityCounts[item.rarity] += 1;
  });

  const chartInstance = getGachaChartInstance();
  if (chartInstance) {
    chartInstance.data.datasets[0].data = [rarityCounts[4], rarityCounts[5], rarityCounts[6]];
    chartInstance.update();
    return;
  }

  const chartContainer = document.getElementById("chartContainer");
  chartContainer.innerHTML = '';
  const corner = document.createElement("div");
  corner.style.cssText = "position:absolute; top:-1px; left:-1px; width:10px; height:10px; border-top:2px solid var(--ef-accent); border-left:2px solid var(--ef-accent); z-index:10;";
  chartContainer.appendChild(corner);

  const ctx = document.createElement("canvas");
  ctx.style.maxWidth = "280px";
  ctx.style.maxHeight = "280px";
  chartContainer.appendChild(ctx);

  const newChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["4★", "5★", "6★"],
      datasets: [{
        data: [rarityCounts[4], rarityCounts[5], rarityCounts[6]],
        backgroundColor: ["#9c27b0", "#ffca28", "#ff5722"],
        borderColor: Chart.defaults.borderColor,
        borderWidth: 2,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '60%',
      animation: { duration: 800, easing: 'easeOutQuart' },
      plugins: {
        legend: { position: "bottom", labels: { font: { family: 'Consolas' }, boxWidth: 10, padding: 10 } },
        title: { display: false }
      }
    }
  });
  setGachaChartInstance(newChart);
}
