/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import { CountryState, Player } from '../types';
import { COUNTRY_PRICES, DEFAULT_COUNTRY_PRICE, BUILDING_TIERS, COUNTRY_NAME_MAP } from '../constants';
import { Globe as GlobeIcon, ZoomIn, ZoomOut, ArrowLeft, RefreshCcw } from 'lucide-react';

interface WorldMapProps {
  countries: Record<string, CountryState>;
  players: Player[];
  onCountryClick: (countryId: string, countryName: string) => void;
}

type ViewMode = '3d' | '2d';
type Continent = 'world' | 'africa' | 'asia' | 'europe' | 'northAmerica' | 'southAmerica' | 'oceania';

const CONTINENTS: Record<Continent, { name: string; center: [number, number]; scale: number }> = {
  world:         { name: '전체 지도',   center: [0, 0],      scale: 1 },
  africa:        { name: '아프리카',    center: [20, -5],     scale: 3.2 },
  asia:          { name: '아시아',      center: [95, 35],     scale: 2.8 },
  europe:        { name: '유럽',        center: [15, 54],     scale: 6.5 },
  northAmerica:  { name: '북미',        center: [-100, 45],   scale: 2.8 },
  southAmerica:  { name: '남미',        center: [-58, -20],   scale: 3.2 },
  oceania:       { name: '오세아니아',  center: [148, -25],   scale: 5.0 },
};

export default function WorldMap({ countries, players, onCountryClick }: WorldMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [topology, setTopology] = useState<any>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('3d');
  const [rotation, setRotation] = useState<[number, number, number]>([-10, -20, 0]);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedContinent, setSelectedContinent] = useState<Continent>('world');
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown>>(null);

  useEffect(() => {
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then(res => res.json())
      .then(data => setTopology(data));
  }, []);

  useEffect(() => {
    if (!topology || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    svg.selectAll('*').remove();

    const minSize = Math.min(width, height);

    // defs 블록 (3D 모드 defs와 별개로, 항상 추가)
    const defs = svg.append('defs');

    // 별빛 glow 필터
    const starGlow = defs.append('filter').attr('id', 'star-glow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
    starGlow.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'blur');
    starGlow.append('feMerge').selectAll('feMergeNode').data(['blur', 'SourceGraphic']).enter().append('feMergeNode').attr('in', d => d);
      
    // 시너지 연결선 glow 필터
    const lineGlow = defs.append('filter').attr('id', 'line-glow').attr('x', '-20%').attr('y', '-20%').attr('width', '140%').attr('height', '140%');
    lineGlow.append('feGaussianBlur').attr('stdDeviation', '2').attr('result', 'blur');
    lineGlow.append('feMerge').selectAll('feMergeNode').data(['blur', 'SourceGraphic']).enter().append('feMergeNode').attr('in', d => d);
    
    // Projection setup
    const projection = viewMode === '3d' 
      ? d3.geoOrthographic()
          .scale(minSize / 2.2 * zoomLevel)
          .translate([width / 2, height / 2])
          .rotate(rotation)
      : d3.geoMercator()
          .scale(width / 6.5)
          .translate([width / 2, height / 1.8]);

    const path = d3.geoPath().projection(projection);

    // Features
    const features = topojson.feature(topology, topology.objects.countries) as any;
    const filteredFeatures = features.features.filter((f: any) => f.id !== '010' && f.properties.name !== 'Antarctica');

    const gMain = svg.append('g').attr('class', 'main-group');

    // Drag & Zoom Interactions
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 15])
      .on('zoom', (event) => {
        if (viewMode === '2d') {
          gMain.attr('transform', event.transform);
        } else {
          setZoomLevel(event.transform.k);
        }
      })
      .filter((event) => {
        // Only allow zoom with wheel or touch pinch, don't let it steal drag if we are in 3D
        return viewMode === '2d' || event.type !== 'mousedown';
      });
    
    // @ts-ignore
    zoomRef.current = zoom;
    svg.call(zoom);

    // Unified Drag Handler
    const drag = d3.drag<SVGSVGElement, unknown>()
      .on('drag', (event) => {
        if (viewMode === '3d') {
          const sensitivity = 0.4 / zoomLevel;
          setRotation(prev => [
            prev[0] + event.dx * sensitivity, 
            prev[1] - event.dy * sensitivity, 
            prev[2]
          ]);
        } else {
          const transform = d3.zoomTransform(svg.node() as any);
          svg.call(zoom.transform, transform.translate(event.dx / transform.k, event.dy / transform.k));
        }
      });
    
    svg.call(drag as any);

    // Perspective Transformation
    let gPerspective = gMain;
    if (viewMode === '2d') {
      gPerspective = gMain.append('g')
        .attr('transform', 'perspective(1200px) rotateX(45deg)');
      
      // Grid
      const gridSize = 100;
      const gridG = gPerspective.append('g').attr('class', 'grid');
      const gBound = 4000;
      for (let x = -gBound; x < gBound; x += gridSize) {
        gridG.append('line').attr('x1', x).attr('y1', -gBound).attr('x2', x).attr('y2', gBound).attr('stroke', '#e2e8f0').attr('stroke-width', 0.5);
      }
      for (let y = -gBound; y < gBound; y += gridSize) {
        gridG.append('line').attr('x1', -gBound).attr('y1', y).attr('x2', gBound).attr('y2', y).attr('stroke', '#e2e8f0').attr('stroke-width', 0.5);
      }
    }

    if (viewMode === '3d') {
      // Glow/Aura for Globe
      gMain.append('circle')
        .attr('cx', width / 2)
        .attr('cy', height / 2)
        .attr('r', (minSize / 2.2 * zoomLevel))
        .attr('fill', 'url(#globe-gradient)')
        .attr('opacity', 0.4);
      
      const grad = defs.append('radialGradient').attr('id', 'globe-gradient');
      grad.append('stop').attr('offset', '70%').attr('stop-color', '#f1f5f9').attr('stop-opacity', 0);
      grad.append('stop').attr('offset', '100%').attr('stop-color', '#3b82f6').attr('stop-opacity', 0.2);

      gMain.append('path')
        .datum({ type: 'Sphere' })
        .attr('class', 'sphere')
        .attr('d', path as any)
        .attr('fill', '#f8fafc')
        .attr('stroke', '#e2e8f0')
        .attr('stroke-width', 1);
    }

    const gCountries = gPerspective.append('g').attr('class', 'countries');
    
    // Tooltip Helper
const tooltip = d3.select('body').append('div')
  .attr('class', 'absolute hidden pointer-events-none z-50')
  .style('background', 'rgba(255,255,255,0.92)')
  .style('backdrop-filter', 'blur(12px)')
  .style('-webkit-backdrop-filter', 'blur(12px)')
  .style('border', '1px solid rgba(203,213,225,0.7)')
  .style('border-radius', '14px')
  .style('padding', '10px 14px')
  .style('color', '#1e293b')
  .style('font-size', '11px')
  .style('font-weight', '700')
  .style('box-shadow', '0 4px 20px rgba(148,163,184,0.2)')
  .style('min-width', '130px');
    
    const handleMouseOver = (event: any, d: any) => {
      const countryName = d.properties.name;
      const state = countries[countryName];
      const player = state?.ownerId ? players.find(p => p.id === state.ownerId) : null;
      const bCount = state?.buildings || 0;
      const bName = bCount > 0 ? BUILDING_TIERS[bCount - 1].name : '없음';

      tooltip.classed('hidden', false).html(`
        <div class="mb-2 border-b border-slate-100 pb-2 text-blue-600 uppercase tracking-widest text-[9px] font-black">${countryName}</div>
        <div class="space-y-1">
          <div class="flex justify-between gap-4"><span>소유자:</span> <span class="${player ? 'text-blue-600' : 'text-slate-400'}">${player?.name || '공석'}</span></div>
          <div class="flex justify-between gap-4"><span>센터 수준:</span> <span class="text-amber-600">${bName}</span></div>
        </div>
      `);
    };

    const handleMouseMove = (event: any) => {
      tooltip.style('left', (event.pageX + 15) + 'px').style('top', (event.pageY - 15) + 'px');
    };

    const handleMouseOut = () => {
      tooltip.classed('hidden', true);
    };

    // Individual country stacking with "Rising" animation
    if (viewMode === '2d') {
      filteredFeatures.forEach((feature: any) => {
        const countryName = feature.properties.name;
       const state = countries[countryName] || countries[feature.id] || 
  Object.values(countries).find(c => c.name === countryName || c.id === countryName);
const isOwned = !!(state?.ownerId && players.some(p => p.id === state.ownerId));
        const targetDepth = isOwned ? (6 + state.buildings * 4) : 0;

        const countryG = gCountries.append('g').attr('class', 'country-stack');

        if (isOwned) {
          // Shadow
          countryG.append('path')
            .datum(feature)
            .attr('d', path as any)
            .attr('fill', 'rgba(0,0,0,0.1)')
            .attr('filter', 'blur(4px)')
            .attr('transform', `translate(0, ${targetDepth + 4})`);

          // Side Walls
          const wallSteps = 4;
          for (let i = 1; i <= wallSteps; i++) {
            countryG.append('path')
              .datum(feature)
              .attr('d', path as any)
              .attr('transform', `translate(0, ${(i/wallSteps) * targetDepth})`)
              .attr('fill', () => {
                const baseColor = players.find(p => p.id === state.ownerId)?.color || '#cbd5e1';
                return d3.color(baseColor)?.darker(0.6 * (i/wallSteps))?.toString() || baseColor;
              })
              .attr('class', 'pointer-events-none');
          }
        }

        // Top Surface
       // 수정
        countryG.append('path')
          .datum(feature)
          .attr('d', path as any)
          .attr('class', 'country-top cursor-pointer')
          .attr('fill', isOwned ? players.find(p => p.id === state!.ownerId)?.color || '#e2e8f0' : '#e2e8f0')
          .attr('stroke', '#94a3b8')        
          .attr('stroke-width', '0.5') 
          .attr('vector-effect', 'non-scaling-stroke')
          .on('click', (event, d: any) => onCountryClick(d.properties.name, d.properties.name))
          .on('mouseover', function(event, d: any) {
              handleMouseOver(event, d);
              d3.select(this)
                .attr('fill-opacity', 0.8)
                .attr('stroke', '#3b82f6')
                .attr('stroke-width', '1.5')
                .attr('vector-effect', 'non-scaling-stroke')
                .raise();
            })
            .on('mousemove', handleMouseMove)
            .on('mouseout', function() {
              handleMouseOut();
              d3.select(this)
                .attr('fill-opacity', 1)
                .attr('stroke', '#94a3b8')
                .attr('stroke-width', '0.5')
                .attr('vector-effect', 'non-scaling-stroke');
            });

        // Entrance Animation - 소유 나라만 튀어오르게
        if (isOwned) {
          countryG.attr('opacity', 0)
            .attr('transform', 'translate(0, 0)')
            .transition()
            .duration(1000)
            .delay(Math.random() * 300)
            .ease(d3.easeElasticOut.amplitude(1).period(0.6))
            .attr('opacity', 1)
            .attr('transform', `translate(0, -${targetDepth})`);
        } else {
          countryG.attr('opacity', 1)
            .attr('transform', 'translate(0, 0)');
        }
      });
    } else {
     gCountries.selectAll('path').data(filteredFeatures).enter().append('path').attr('d', path as any)
        .attr('class', 'country-top cursor-pointer')
        .attr('stroke', '#94a3b8')
        .attr('stroke-width', 0.5)
        .attr('vector-effect', 'non-scaling-stroke')
        .attr('fill', (d:any) => countries[d.properties.name]?.ownerId ? players.find(p => p.id === countries[d.properties.name].ownerId)?.color || '#CBD5E1' : '#CBD5E1')
        .on('click', (event, d: any) => onCountryClick(d.properties.name, d.properties.name))
        .on('mouseover', function(event, d: any) {
              handleMouseOver(event, d);
              d3.select(this)
                .attr('fill-opacity', 0.8)
                .attr('stroke', '#3b82f6')
                .attr('stroke-width', '1.5')
                .attr('vector-effect', 'non-scaling-stroke')
                .raise();
            })
          .on('mousemove', handleMouseMove)
          .on('mouseout', function() {
              handleMouseOut();
              d3.select(this)
                .attr('fill-opacity', 1)
                .attr('stroke', '#94a3b8')
                .attr('stroke-width', '0.5')
                .attr('vector-effect', 'non-scaling-stroke');
            });
    }

        // ──────────────────────────────────────────
    // ★ 2단계 삽입 시작
    // ──────────────────────────────────────────
    if (viewMode === '2d') {
      const ownedCentroids: { name: string; centroid: [number, number]; color: string }[] = [];
      
      Object.values(countries).forEach((state) => {
        if (!state?.ownerId) return;
        const player = players.find(p => p.id === state.ownerId);
        if (!player) return;
        const mappedName = COUNTRY_NAME_MAP[state.name] || state.name;
        const feature = filteredFeatures.find((f: any) =>
          f.properties.name === mappedName || f.properties.name === state.name
        );
        if (!feature) return;
        const centroid = path.centroid(feature);
        if (!centroid || isNaN(centroid[0])) return;
        ownedCentroids.push({ name: state.name, centroid, color: player.color || '#c8a8ff' });
      });
      
      const SYNERGY_DIST = 150 / zoomLevel; // 줌 레벨 보정
      const gSynergy = gPerspective.append('g').attr('class', 'synergy-lines');
      
      for (let i = 0; i < ownedCentroids.length; i++) {
        for (let j = i + 1; j < ownedCentroids.length; j++) {
          const a = ownedCentroids[i];
          const b = ownedCentroids[j];
          const dx = a.centroid[0] - b.centroid[0];
          const dy = a.centroid[1] - b.centroid[1];
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > SYNERGY_DIST) continue;
      
          const gradId = `syn-grad-${i}-${j}`;
          const grad = defs.append('linearGradient').attr('id', gradId)
            .attr('x1', a.centroid[0]).attr('y1', a.centroid[1])
            .attr('x2', b.centroid[0]).attr('y2', b.centroid[1])
            .attr('gradientUnits', 'userSpaceOnUse');
          grad.append('stop').attr('offset', '0%').attr('stop-color', a.color);
          grad.append('stop').attr('offset', '100%').attr('stop-color', b.color);
      
          gSynergy.append('line')
            .attr('x1', a.centroid[0]).attr('y1', a.centroid[1])
            .attr('x2', b.centroid[0]).attr('y2', b.centroid[1])
            .attr('stroke', `url(#${gradId})`)
            .attr('stroke-width', 1.5)
            .attr('stroke-dasharray', '6 4')
            .attr('opacity', 0.7)
            .attr('filter', 'url(#line-glow)')
            .attr('class', 'synergy-line pointer-events-none');
        }
      }
    }
    // ──────────────────────────────────────────
    // ★ 2단계 삽입 끝
    // ──────────────────────────────────────────
    
    // ✅ 기존 이미지 렌더 루프 (건드리지 않음)
    Object.values(countries).forEach((state) => {
      if (!state?.ownerId) return;
      ...

    // ★★★ 3단계 별빛 파티클 삽입 시작 ★★★
    if (viewMode === '2d') {
      Object.values(countries).forEach((state) => {
        if (!state?.ownerId) return;
        const player = players.find(p => p.id === state.ownerId);
        if (!player) return;

        const mappedName = COUNTRY_NAME_MAP[state.name] || state.name;
        const feature = filteredFeatures.find((f: any) =>
          f.properties.name === mappedName || f.properties.name === state.name
        );
        if (!feature) return;

        const centroid = path.centroid(feature);
        if (!centroid || isNaN(centroid[0])) return;

        const bounds = path.bounds(feature);
        const boundWidth = bounds[1][0] - bounds[0][0];
        const boundHeight = bounds[1][1] - bounds[0][1];
        const countryArea = Math.sqrt(boundWidth * boundHeight);
        const imageSize = Math.min(Math.max(countryArea * 0.35, 8), 30);

        const buildingLevel = state.buildings || 0;
        if (buildingLevel === 0) return; // 건물 없으면 별 없음

        const isOwned = !!state.ownerId;
        const targetDepth = isOwned ? (6 + buildingLevel * 4) : 0;
        const starCount = buildingLevel * 2;
        const starRadius = imageSize * 0.9;

        for (let s = 0; s < starCount; s++) {
          const angle = (s / starCount) * Math.PI * 2;
          const sx = centroid[0] + Math.cos(angle) * starRadius;
          const sy = centroid[1] + Math.sin(angle) * starRadius - targetDepth;
          const starSize = 1.5 + (buildingLevel / 5) * 2.5;
          const animDelay = `${(s * 0.3).toFixed(1)}s`;

          gPerspective.append('circle')
            .attr('cx', sx)
            .attr('cy', sy)
            .attr('r', starSize)
            .attr('fill', player.color || '#c8a8ff')
            .attr('filter', 'url(#star-glow)')
            .attr('opacity', 0.9)
            .attr('class', 'star-particle pointer-events-none')
            .style('animation', `starPulse 2s ease-in-out ${animDelay} infinite`);
        }
      });
    }
// ★★★ 3단계 별빛 파티클 삽입 끝 ★★★
      
    if (viewMode === '2d') {
      const gClouds = gPerspective.append('g').attr('class', 'clouds');
      [[100, 100], [800, 150]].forEach(([cx, cy]) => {
        gClouds.append('g').attr('transform', `translate(${cx}, ${cy})`).html('<ellipse cx="0" cy="0" rx="40" ry="20" fill="white" opacity="0.4" />');
      });
    }

    function isPointVisible(d: any, proj: d3.GeoProjection) {
      const centroid = d3.geoCentroid(d);
      const rotate = proj.rotate();
      return d3.geoDistance(centroid, [-rotate[0], -rotate[1]]) < Math.PI / 2;
    }

    return () => tooltip.remove();
  }, [topology, countries, players, viewMode, rotation, zoomLevel]);

  // Handle Continent Zooming
  useEffect(() => {
    if (!topology || !svgRef.current || !zoomRef.current || viewMode !== '2d') return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    const continent = CONTINENTS[selectedContinent];

    const projection = d3.geoMercator()
            .scale(width / 5.5)
            .center([0, 0])
            .translate([width / 2, height / 2]);

    const center = projection(continent.center);
    if (!center) return;

    const transform = d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(continent.scale)
      .translate(-center[0], -center[1]);

    svg.transition()
      .duration(1000)
      .ease(d3.easeCubicOut)
      .call(zoomRef.current.transform, transform);

  }, [selectedContinent, topology, viewMode]);

return (
  <div
    className="w-full h-full overflow-hidden relative rounded-[2rem]"
    style={{
      background: 'rgba(255,255,255,0.72)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      border: '1px solid rgba(255,255,255,0.9)',
      boxShadow: '0 2px 24px rgba(148,163,184,0.18), inset 0 1px 0 rgba(255,255,255,0.95)',
    }}
  >
    <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

    {/* 상단 컨트롤 */}
    <div className="absolute top-5 left-5 flex flex-col gap-3 pointer-events-auto">

      {/* 뷰 토글 */}
      <div
        className="flex p-[3px] rounded-[14px] gap-[2px]"
        style={{
          background: 'rgba(241,245,249,0.85)',
          border: '1px solid rgba(203,213,225,0.6)',
        }}
      >
        <button
          onClick={() => { setViewMode('3d'); setZoomLevel(1); }}
          className="flex items-center gap-2 px-4 py-[6px] rounded-[11px] text-[11px] font-black uppercase tracking-widest transition-all"
          style={viewMode === '3d'
            ? { background: 'white', color: '#3b82f6', boxShadow: '0 1px 6px rgba(99,130,190,0.18)' }
            : { background: 'transparent', color: '#94a3b8' }
          }
        >
          <GlobeIcon className="w-3.5 h-3.5" /> 3D Globe
        </button>
        <button
          onClick={() => { setViewMode('2d'); setZoomLevel(1); setSelectedContinent('world'); }}
          className="flex items-center gap-2 px-4 py-[6px] rounded-[11px] text-[11px] font-black uppercase tracking-widest transition-all"
          style={viewMode === '2d'
            ? { background: 'white', color: '#3b82f6', boxShadow: '0 1px 6px rgba(99,130,190,0.18)' }
            : { background: 'transparent', color: '#94a3b8' }
          }
        >
          <ArrowLeft className="w-3.5 h-3.5" /> 3D Map
        </button>
      </div>

      {/* 대륙 칩 */}
      {viewMode === '2d' && (
        <div className="flex flex-wrap gap-[6px] max-w-[420px]">
          {(Object.keys(CONTINENTS) as Continent[]).map((key) => (
            <button
              key={key}
              onClick={() => setSelectedContinent(key)}
              className="px-[13px] py-[5px] rounded-full text-[11px] font-semibold transition-all"
              style={selectedContinent === key
                ? {
                    background: '#3b82f6',
                    color: 'white',
                    border: '1px solid #3b82f6',
                    boxShadow: '0 2px 8px rgba(59,130,246,0.28)',
                  }
                : {
                    background: 'rgba(255,255,255,0.7)',
                    color: '#64748b',
                    border: '1px solid rgba(203,213,225,0.7)',
                  }
              }
            >
              {CONTINENTS[key].name}
            </button>
          ))}
        </div>
      )}

      {/* 리셋 버튼 (3D) */}
      {viewMode === '3d' && (
        <button
          onClick={() => { setRotation([-10, -20, 0]); setZoomLevel(1); }}
          className="flex items-center justify-center w-10 h-10 rounded-2xl transition-all active:scale-95"
          style={{
            background: 'rgba(255,255,255,0.8)',
            border: '1px solid rgba(203,213,225,0.6)',
            color: '#64748b',
            boxShadow: '0 1px 6px rgba(148,163,184,0.15)',
          }}
        >
          <RefreshCcw className="w-4 h-4" />
        </button>
      )}
    </div>

    {/* 힌트 박스 */}
    <div
      className="absolute bottom-5 left-5 px-3 py-[10px] rounded-xl text-[10px] space-y-1 font-bold uppercase tracking-tight"
      style={{
        background: 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid rgba(203,213,225,0.55)',
      }}
    >
      <p className="flex items-center gap-2 text-blue-500">
        <GlobeIcon className="w-3 h-3" />
        {viewMode === '3d' ? 'Drag to rotate' : 'Drag to move'}
      </p>
      <p className="flex items-center gap-2 text-slate-400">
        <ZoomIn className="w-3 h-3" /> Mouse wheel to zoom
      </p>
    </div>

    {/* Center Tiers */}
    <div
      className="absolute bottom-5 right-5 px-[14px] py-[10px] rounded-[14px]"
      style={{
        background: 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid rgba(203,213,225,0.55)',
      }}
    >
      <p className="text-[9px] font-black text-slate-400 mb-2 uppercase tracking-widest text-center">
        Center Tiers
      </p>
      <div className="space-y-[10px]">
        {BUILDING_TIERS.map(tier => (
          <div key={tier.level} className="flex items-center gap-2">
            <div
              className="w-[10px] rounded-sm"
              style={{ height: `${tier.level * 4 + 4}px`, background: '#475569' }}
            />
            <span className="text-[10px] font-bold text-slate-600">{tier.name}</span>
          </div>
        ))}
      </div>
    </div>
  </div>        {/* ← 이 줄: return 전체를 감싸는 최외곽 div 닫힘 */}

{/* ★★★ CSS 삽입 ★★★ */}
<style>{`
  @keyframes starPulse {
    0%, 100% { opacity: 0.3; }
    50%       { opacity: 1;   }
  }
  .star-particle {
    animation: starPulse 2s ease-in-out infinite;
  }
  @keyframes synergyFlow {
    0%   { stroke-dashoffset: 0; }
    100% { stroke-dashoffset: -20; }
  }
  .synergy-line {
    animation: synergyFlow 1.5s linear infinite;
  }
`}</style>
