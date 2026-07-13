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

  // 获取 chartContainer 元素，清除旧数据的 chart 实例
  const chartContainer = document.getElementById("chartContainer");
  const oldCanvas = chartContainer.querySelector("canvas");
  if (oldCanvas) oldCanvas.remove();

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
