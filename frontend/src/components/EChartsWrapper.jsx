import React, { useRef, useEffect } from 'react';
import * as echarts from 'echarts';

function currentThemeMode() {
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('light')) {
    return 'light';
  }
  return 'dark';
}

/**
 * Universal responsive ECharts wrapper component for AeroTrace A-Q-I.
 * Integrates directly with React lifecycle and follows the GLOBAL light/dark
 * theme (html.light) — the chart re-initializes when the theme flips so axis
 * labels, tooltips and canvases never stay stuck in the previous theme.
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
  const [themeMode, setThemeMode] = React.useState(currentThemeMode);

  // Track the global theme class so charts follow the app-wide theme switch.
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setThemeMode(currentThemeMode());
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!chartRef.current) return;

    // 'dark'/'light' are echarts' built-in base themes; our option supplies colors.
    const chart = echarts.init(chartRef.current, themeMode, {
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
  }, [themeMode]);

  useEffect(() => {
    if (!chartInstanceRef.current || !option) return;
    chartInstanceRef.current.setOption(option, true);
  }, [option, themeMode]);

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
