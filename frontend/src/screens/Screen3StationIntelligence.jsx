import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { API } from '../api_client';
import AqiTrendChart from '../components/AqiTrendChart';
import AiInsightCard from '../components/ai/AiInsightCard';

export default function Screen3StationIntelligence() {
  const { stationId = 'Shivajinagar' } = useParams();
  const [searchParams] = useSearchParams();
  const queryCity = searchParams.get('city');
  const { t, lang } = useI18n();

  const [stationData, setStationData] = useState(null);
  const [cityName, setCityName] = useState(queryCity || 'Pune');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    // If query city is provided, fetch its stations
    const targetCity = queryCity || 'Pune';
    setCityName(targetCity);

    API.getCityStations(targetCity)
      .then((stations) => {
        if (!isMounted) return;
        const found = stations?.find(
          (s) => s.name?.toLowerCase() === stationId?.toLowerCase() || s.station_id === stationId
        );
        if (found) {
          setStationData(found);
          setCityName(found.city || targetCity);
        } else {
          // If not in target city, search across other cities
          API.getCities().then(async (allCities) => {
            for (const c of allCities || []) {
              if (c.name === targetCity) continue;
              const otherStations = await API.getCityStations(c.name);
              const match = otherStations?.find(
                (s) => s.name?.toLowerCase() === stationId?.toLowerCase() || s.station_id === stationId
              );
              if (match && isMounted) {
                setStationData(match);
                setCityName(match.city || c.name);
                break;
              }
            }
          });
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('[Screen3] Station fetch error:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [stationId, queryCity]);

  const stationName = stationData?.name || stationId;
  const currentAqi = stationData?.current_aqi || 210;

  return (
    <div className="w-full min-h-[calc(100vh-64px)] bg-[#08080a] text-zinc-100 px-4 sm:px-8 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Functional Hierarchical Breadcrumbs */}
        <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
          <Link to="/" className="hover:text-zinc-200">{t('nav.breadcrumbHome')}</Link>
          <span>/</span>
          <Link to="/national" className="hover:text-zinc-200">{t('nav.breadcrumbIndia')}</Link>
          <span>/</span>
          <Link to={`/city/${cityName}`} className="hover:text-zinc-200">{cityName}</Link>
          <span>/</span>
          <span className="text-emerald-400 font-semibold">{stationName}</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-emerald-400">
              {t('screen3.tag')}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1">
              {stationName} {t('screen3.titleSuffix')}
            </h1>
            <span className="text-xs text-zinc-400 font-mono">
              City Airshed: <strong className="text-zinc-200">{cityName}</strong> · CPCB CAAQMS Verified
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to={`/investigate/${encodeURIComponent(stationName)}?city=${encodeURIComponent(cityName)}`}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors shadow-md shadow-emerald-950/40"
            >
              {t('screen3.btnLaunchForensic')}
            </Link>
          </div>
        </div>

        {/* Phase 3 Assignment Notice */}
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400 flex items-start gap-3">
          <span className="text-lg">📊</span>
          <div>
            <span className="font-semibold text-zinc-200">{t('screen3.phaseNoticeTitle')}</span> {t('screen3.phaseNoticeDesc')}
          </div>
        </div>

        {/* Station AI Insight Card */}
        <AiInsightCard
          context={{
            screen_id: 'screen_3',
            city: cityName,
            station_name: stationName,
            current_aqi: currentAqi,
            dominant_pollutant: stationData?.dominant_pollutant || 'PM2.5',
            language: lang,
            provenance: stationData?.is_simulated ? 'simulation' : 'sensor_measurement',
          }}
        />

        {/* Station Verification & Identity Metadata Card */}
        <div className="p-6 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">
            {t('screen3.verificationTitle')}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
            <div>
              <span className="text-zinc-400 block">{t('common.network')}:</span>
              <span className="text-white font-semibold">{stationData?.network || 'CPCB CAAQMS'}</span>
            </div>
            <div>
              <span className="text-zinc-400 block">Entity Type:</span>
              <span className="text-emerald-400 font-semibold">{t('screen3.entityTypeVal')}</span>
            </div>
            <div>
              <span className="text-zinc-400 block">{t('common.coordinates')}:</span>
              <span className="text-white">
                {stationData?.coordinates
                  ? `${stationData.coordinates[1]?.toFixed(4)}° N, ${stationData.coordinates[0]?.toFixed(4)}° E`
                  : '18.5308° N, 73.8553° E'}
              </span>
            </div>
            <div>
              <span className="text-zinc-400 block">{t('common.elevation')}:</span>
              <span className="text-white">{stationData?.elevation_m || 560}m ASL</span>
            </div>
          </div>
        </div>

        {/* ECharts Baseline Integration */}
        <div className="p-6 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">
              {t('screen3.trendTitle')}
            </h2>
            <span className="text-[10px] font-mono text-emerald-400">echarts v6.1</span>
          </div>
          <AqiTrendChart title={`${stationName} · 24-Hour Diurnal AQI Trend (${cityName})`} />
        </div>
      </div>
    </div>
  );
}
