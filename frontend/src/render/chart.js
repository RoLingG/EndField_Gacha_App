import {
  getGachaChartInstance, setGachaChartInstance,
  getPityDistChartInstance, setPityDistChartInstance,
  getMonthlyTrendChartInstance, setMonthlyTrendChartInstance,
  getGlobalTheme
} from '../state.js';

function getStatsGridColor() {
  return getGlobalTheme() === 'day' ? '#cfcfc7' : '#444';
}

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

export function renderPityDistributionChart(distribution) {
  const existing = getPityDistChartInstance();
  if (existing) {
    existing.data.datasets[0].data = distribution.counts;
    existing.data.datasets[1].data = distribution.upCounts;
    existing.data.datasets[2].data = distribution.offCounts;
    existing.update();
    return;
  }

  const container = document.getElementById('pityDistChartBody');
  const oldCanvas = container.querySelector('canvas');
  if (oldCanvas) oldCanvas.remove();

  const canvas = document.createElement('canvas');
  container.appendChild(canvas);

  const colors = [
    '#ffd54f', '#ffca28', '#ffc107',
    '#ffb300', '#ff9800', '#f57c00',
    '#ef6c00', '#e65100', '#bf360c'
  ];

  const newChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: distribution.labels,
      datasets: [
        {
          label: '总计',
          data: distribution.counts,
          backgroundColor: colors,
          borderColor: colors,
          borderWidth: 1,
          borderRadius: 4
        },
        {
          label: 'UP',
          data: distribution.upCounts,
          backgroundColor: 'rgba(244, 67, 54, 0.7)',
          borderColor: '#f44336',
          borderWidth: 1,
          borderRadius: 4
        },
        {
          label: '歪',
          data: distribution.offCounts,
          backgroundColor: 'rgba(76, 175, 80, 0.7)',
          borderColor: '#4caf50',
          borderWidth: 1,
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 600,
        easing: 'easeOutQuart'
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { family: 'Consolas', size: 11 }, boxWidth: 10, padding: 10 }
        },
        title: { display: false }
      },
      scales: {
        x: {
          border: { color: getStatsGridColor(), display: true },
          grid: { display: false },
          ticks: {
            font: { family: 'Consolas', size: 11 }
          }
        },
        y: {
          title: { display: true, text: '次数', font: { family: 'Consolas', size: 11 } },
          border: { color: getStatsGridColor(), display: true },
          grid: { color: getStatsGridColor() },
          beginAtZero: true,
          ticks: {
            font: { family: 'Consolas', size: 11 },
            stepSize: 1
          }
        }
      }
    }
  });
  setPityDistChartInstance(newChart);
}

export function renderMonthlyTrendChart(monthlyData) {
  const existing = getMonthlyTrendChartInstance();
  if (existing) {
    existing.data.labels = monthlyData.map(d => d.month);
    existing.data.datasets[0].data = monthlyData.map(d => d.totalPulls);
    existing.data.datasets[1].data = monthlyData.map(d => d.sixStarCount);
    existing.data.datasets[2].data = monthlyData.map(d => d.upCount);
    existing.data.datasets[3].data = monthlyData.map(d => d.offCount);
    existing.update();
    return;
  }

  const container = document.getElementById('monthlyChartBody');
  const oldCanvas = container.querySelector('canvas');
  if (oldCanvas) oldCanvas.remove();

  const canvas = document.createElement('canvas');
  container.appendChild(canvas);

  const newChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: monthlyData.map(d => d.month),
      datasets: [
        {
          label: '月抽数',
          data: monthlyData.map(d => d.totalPulls),
          backgroundColor: 'rgba(255, 202, 40, 0.5)',
          borderColor: '#ffca28',
          borderWidth: 1,
          yAxisID: 'y'
        },
        {
          label: '6★数量',
          data: monthlyData.map(d => d.sixStarCount),
          type: 'line',
          borderColor: '#ffd54f',
          backgroundColor: '#ffca28',
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.3,
          yAxisID: 'y1'
        },
        {
          label: 'UP',
          data: monthlyData.map(d => d.upCount),
          type: 'line',
          borderColor: '#f44336',
          backgroundColor: '#f44336',
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.3,
          yAxisID: 'y1'
        },
        {
          label: '歪',
          data: monthlyData.map(d => d.offCount),
          type: 'line',
          borderColor: '#4caf50',
          backgroundColor: '#4caf50',
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.3,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600, easing: 'easeOutQuart' },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { family: 'Consolas', size: 11 }, boxWidth: 10, padding: 10 }
        },
        title: { display: false }
      },
      scales: {
        x: {
          border: { color: getStatsGridColor(), display: true },
          grid: { display: false },
          ticks: { font: { family: 'Consolas', size: 11 } }
        },
        y: {
          type: 'linear',
          position: 'left',
          beginAtZero: true,
          title: { display: true, text: '抽数', font: { family: 'Consolas', size: 11 } },
          border: { color: getStatsGridColor(), display: true },
          grid: { color: getStatsGridColor() },
          ticks: { font: { family: 'Consolas', size: 11 } }
        },
        y1: {
          type: 'linear',
          position: 'right',
          beginAtZero: true,
          title: { display: true, text: '6★', font: { family: 'Consolas', size: 11 } },
          border: { color: getStatsGridColor(), display: true },
          grid: { drawOnChartArea: false },
          ticks: { font: { family: 'Consolas', size: 11 }, stepSize: 1 }
        }
      }
    }
  });
  setMonthlyTrendChartInstance(newChart);
}

export function destroyStatsCharts() {
  const pityChart = getPityDistChartInstance();
  if (pityChart) {
    pityChart.destroy();
    setPityDistChartInstance(null);
  }
  const monthlyChart = getMonthlyTrendChartInstance();
  if (monthlyChart) {
    monthlyChart.destroy();
    setMonthlyTrendChartInstance(null);
  }
}
