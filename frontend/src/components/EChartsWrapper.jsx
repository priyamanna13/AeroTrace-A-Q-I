import React, { useRef, useEffect } from 'react';
import * as echarts from 'echarts';

/**
 * Universal responsive ECharts wrapper component for AeroTrace A-Q-I.
 * Integrates directly with React lifecycle and dark obsidian theme.
 */
export default function EChartsWrapper({
  option,
  style = { width: '100%', height: '320px' },
  className = '',
  loading = false,
  onChartReady,
}) {
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // Initialize ECharts instance with dark theme
    const chart = echarts.init(chartRef.current, 'dark', {
      renderer: 'canvas',
    });
    chartInstanceRef.current = chart;

    if (onChartReady) {
      onChartReady(chart);
    }

    // Auto-resize on window / container resize
    const resizeObserver = new ResizeObserver(() => {
      chart.resize();
    });
    resizeObserver.observe(chartRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.dispose();
      chartInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!chartInstanceRef.current || !option) return;
    chartInstanceRef.current.setOption(option, true);
  }, [option]);

  useEffect(() => {
    if (!chartInstanceRef.current) return;
    if (loading) {
      chartInstanceRef.current.showLoading({
        text: 'Loading telemetry...',
        color: '#10b981',
        textColor: '#a1a1aa',
        maskColor: 'rgba(8, 8, 10, 0.6)',
      });
    } else {
      chartInstanceRef.current.hideLoading();
    }
  }, [loading]);

  return <div ref={chartRef} style={style} className={`rounded-xl overflow-hidden ${className}`} />;
}
