import React from 'react';
import EChartsWrapper from './EChartsWrapper';

/**
 * AqiTrendChart — ECharts line chart for 24H / 7D / 30D pollutant and AQI trends.
 * Supports NAAQS color thresholds and responsive tooltips.
 */
export default function AqiTrendChart({
  title = '24-Hour AQI Trend',
  timestamps = ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'],
  values = [140, 165, 210, 310, 260, 220, 195, 180],
  threshold = 200,
}) {
  const option = {
    backgroundColor: 'transparent',
    title: {
      text: title,
      textStyle: {
        color: '#e4e4e7',
        fontSize: 13,
        fontWeight: '600',
        fontFamily: 'Inter, sans-serif',
      },
      top: 5,
      left: 10,
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(12, 12, 16, 0.95)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      textStyle: { color: '#f4f4f5', fontSize: 12 },
      formatter: (params) => {
        const item = params[0];
        return `<div class="p-1 font-mono">
          <div class="text-[10px] text-zinc-400">${item.axisValue}</div>
          <div class="font-bold text-emerald-400">AQI ${item.data}</div>
        </div>`;
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '6%',
      top: '18%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: timestamps,
      axisLine: { lineStyle: { color: '#27272a' } },
      axisLabel: { color: '#71717a', fontSize: 10, fontFamily: 'monospace' },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#18181b', type: 'dashed' } },
      axisLabel: { color: '#71717a', fontSize: 10, fontFamily: 'monospace' },
    },
    series: [
      {
        name: 'AQI',
        type: 'line',
        smooth: true,
        data: values,
        symbolSize: 6,
        lineStyle: {
          width: 2.5,
          color: '#10b981',
        },
        itemStyle: {
          color: '#10b981',
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(16, 185, 129, 0.28)' },
              { offset: 1, color: 'rgba(16, 185, 129, 0.0)' },
            ],
          },
        },
        markLine: {
          silent: true,
          symbol: 'none',
          data: [
            {
              yAxis: threshold,
              lineStyle: { color: '#ef4444', type: 'dashed', width: 1 },
              label: {
                formatter: `Severe Threshold (${threshold})`,
                color: '#ef4444',
                fontSize: 10,
                position: 'insideEndTop',
              },
            },
          ],
        },
      },
    ],
  };

  return <EChartsWrapper option={option} style={{ width: '100%', height: '240px' }} />;
}
