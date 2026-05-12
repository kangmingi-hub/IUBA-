/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import { CountryState, Player } from '../types';
import { COUNTRY_PRICES, DEFAULT_COUNTRY_PRICE, BUILDING_TIERS, CLUB_IMAGES, BUILDING_IMAGES, COUNTRY_NAME_MAP, getBuildingTiers } from '../constants';
import { Globe as GlobeIcon, ZoomIn, ArrowLeft, RefreshCcw } from 'lucide-react';
import defenseIcon from '../../public/defense-tower.png';
import { supabase } from '../lib/supabase';

interface WorldMapProps {
  countries: Record<string, CountryState>;
  players: Player[];
  onCountryClick: (countryId: string, countryName: string) => void;
  defenses?: Record<string, { defense_buildings: number; defense_power: number }>;
}

type ViewMode = '3d' | '2d';
type Continent = 'world' | 'africa' | 'asia' | 'europe' | 'northAmerica' | 'southAmerica' | 'oceania';

const CONTINENTS: Record<Continent, { name: string; center: [number, number]; scale: number }> = {
  world:        { name: '전체 지도',  center: [0, 0],     scale: 1   },
  africa:       { name: '아프리카',   center: [20, -5],   scale: 3.2 },
  asia:         { name: '아시아',     center: [95, 35],   scale: 2.8 },
  europe:       { name: '유럽',       center: [15, 54],   scale: 6.5 },
  northAmerica: { name: '북미',       center: [-100, 45], scale: 2.8 },
  southAmerica: { name: '남미',       center: [-58, -20], scale: 3.2 },
  oceania:      { name: '오세아니아', center: [148, -27], scale: 4.5 },
};

export default function WorldMap({ countries, players, onCountryClick, defenses = {} }: WorldMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [topology, setTopology] = useState<any>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('3d');
  const [rotation, setRotation] = useState<[number, number, number]>([-10, -20, 0]);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedContinent, setSelectedContinent] = useState<Continent>('world');
  const [isRotating, setIsRotating] = useState(true);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown>>(null);
  const isDraggingRef = useRef(false);
  const attackingCountriesRef = useRef<Set<string>>(new Set());
  const warCountriesRef = useRef<Set<string>>(new Set());
  const [warEvents, setWarEvents] = useState<{
    id: string;
    country_name: string;
    result: 'defended' | 'conquered';
  }[]>([]);

  useEffect(() => {
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then(res => res.json())
      .then(data => setTopology(data));
  }, []);

  useEffect(() => {
    const shownIds = new Set<string>();
    const channel = supabase.channel('war_events_map')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'attack_results'
      }, (payload) => {
        const e = payload.new as any;
        if (!shownIds.has(e.id)) {
          shownIds.add(e.id);
          setWarEvents(prev => [...prev, { id: e.id, country_name: e.country_name, result: e.result }]);
          setTimeout(() => {
            setWarEvents(prev => prev.filter(w => w.id !== e.id));
          }, 30000);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const fetchAttackSchedules = async () => {
      const { data } = await supabase.from('attack_schedules').select('*').eq('status', 'scheduled');
      if (!data) return;

      const nowTime = Date.now();
      const warning = new Set<string>();
      const war = new Set<string>();

      data.forEach((s: any) => {
        const attackTime = new Date(s.attack_time).getTime();
        if (attackTime <= nowTime) {
          war.add(s.target_country_name);
        } else {
          warning.add(s.target_country_name);
        }
      });

      attackingCountriesRef.current = warning;
      warCountriesRef.current = war;
    };

    fetchAttackSchedules();

    const channel = supabase.channel('attack_schedules_map')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attack_schedules' }, fetchAttackSchedules)
      .subscribe();

    const interval = setInterval(fetchAttackSchedules, 1000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let lastTouch: Touch | null = null;

    const onTouchStart = (e: TouchEvent) => {
      isDraggingRef.current = true;
      lastTouch = e.touches[0];
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!lastTouch || viewMode !== '3d') return;
      if (isDraggingRef.current) {
        e.preventDefault();
      }
      const touch = e.touches[0];
      const dx = touch.clientX - lastTouch.clientX;
      const dy = touch.clientY - lastTouch.clientY;
      const sensitivity = 0.4 / zoomLevel;
      setRotation(prev => [
        prev[0] + dx * sensitivity,
        prev[1] - dy * sensitivity,
        prev[2],
      ]);
      lastTouch = touch;
    };

    const onTouchEnd = () => {
      isDraggingRef.current = false;
      lastTouch = null;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [viewMode, zoomLevel]);

  // ─── 메인 지도 렌더링 ────────────────────────────────────────────────────
  useEffect(() => {
    if (!topology || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    svg.selectAll('*').remove();

    const minSize = Math.min(width, height);

    const projection = viewMode === '3d'
      ? d3.geoOrthographic()
          .scale(minSize / 2.2 * zoomLevel)
          .translate([width / 2, height / 2])
          .rotate(rotation)
      : d3.geoMercator()
          .scale(width / 6.5)
          .translate([width / 2, height / 1.8]);

    const path = d3.geoPath().projection(projection);
    const features = topojson.feature(topology, topology.objects.countries) as any;
    const filteredFeatures = features.features.filter((f: any) => f.id !== '010' && f.properties.name !== 'Antarctica');

    const gMain = svg.append('g').attr('class', 'main-group');

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
        return viewMode === '2d' || event.type !== 'mousedown';
      });

    // @ts-ignore
    zoomRef.current = zoom;
    svg.call(zoom);

    const drag = d3.drag<SVGSVGElement, unknown>()
      .on('start', () => { isDraggingRef.current = true; })
      .on('drag', (event) => {
        if (viewMode === '3d') {
          const sensitivity = 0.4 / zoomLevel;
          setRotation(prev => [
            prev[0] + event.dx * sensitivity,
            prev[1] - event.dy * sensitivity,
            prev[2],
          ]);
        } else {
          const transform = d3.zoomTransform(svg.node() as any);
          svg.call(zoom.transform, transform.translate(event.dx / transform.k, event.dy / transform.k));
        }
      })
      .on('end', () => { isDraggingRef.current = false; });

    svg.call(drag as any);

    let gPerspective = gMain;
    if (viewMode === '2d') {
      gPerspective = gMain.append('g');
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
      gMain.append('circle')
        .attr('cx', width / 2).attr('cy', height / 2)
        .attr('r', minSize / 2.2 * zoomLevel)
        .attr('fill', 'url(#globe-gradient)').attr('opacity', 0.4);

      const defs = svg.append('defs');
      const grad = defs.append('radialGradient').attr('id', 'globe-gradient');
      grad.append('stop').attr('offset', '70%').attr('stop-color', '#f1f5f9').attr('stop-opacity', 0);
      grad.append('stop').attr('offset', '100%').attr('stop-color', '#3b82f6').attr('stop-opacity', 0.2);

      gMain.append('path')
        .datum({ type: 'Sphere' })
        .attr('d', path as any)
        .attr('fill', '#f8fafc')
        .attr('stroke', '#e2e8f0')
        .attr('stroke-width', 1);
    }

    const gCountries = gPerspective.append('g').attr('class', 'countries');

    const tooltip = d3.select('body').append('div')
      .attr('class', 'absolute hidden pointer-events-none z-50')
      .style('background', 'rgba(255,255,255,0.65)')
      .style('backdrop-filter', 'blur(12px)')
      .style('-webkit-backdrop-filter', 'blur(12px)')
      .style('border', '1px solid rgba(255,255,255,0.8)')
      .style('border-radius', '14px')
      .style('padding', '10px 14px')
      .style('color', '#1e293b')
      .style('font-size', '11px')
      .style('font-weight', '700')
      .style('box-shadow', '0 4px 20px rgba(120,150,190,0.2)')
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
    const handleMouseOut = () => { tooltip.classed('hidden', true); };

    if (viewMode === '2d') {
      const sortedFeatures = [...filteredFeatures].sort((a: any, b: any) => {
        const yA = path.centroid(a)?.[1] ?? 0;
        const yB = path.centroid(b)?.[1] ?? 0;
        return yA - yB;
      });

      sortedFeatures.forEach((feature: any) => {
        const countryName = feature.properties.name;
        const state = countries[countryName] || countries[feature.id] ||
          Object.values(countries).find(c => c.name === countryName || c.id === countryName);
        const isOwned = !!(state?.ownerId && players.some(p => p.id === state.ownerId));
        const targetDepth = isOwned ? (2 + state.buildings * 1) : 0;
        const countryG = gCountries.append('g').attr('class', 'country-stack');

        if (isOwned) {
          countryG.append('path').datum(feature).attr('d', path as any)
            .attr('fill', 'rgba(0,0,0,0.1)').attr('filter', 'blur(4px)')
            .attr('transform', `translate(0, ${targetDepth + 4})`);
          for (let i = 1; i <= 4; i++) {
            countryG.append('path').datum(feature).attr('d', path as any)
              .attr('transform', `translate(0, ${(i / 4) * targetDepth})`)
              .attr('fill', () => {
                const baseColor = players.find(p => p.id === state.ownerId)?.color || '#cbd5e1';
                return d3.color(baseColor)?.darker(0.6 * (i / 4))?.toString() || baseColor;
              })
              .attr('class', 'pointer-events-none');
          }
        }

        countryG.append('path').datum(feature).attr('d', path as any)
          .attr('class', 'country-top cursor-pointer')
          .attr('fill', () => {
            if (!isOwned) return '#e2e8f0';
            return players.find(p => p.id === state!.ownerId)?.color || '#e2e8f0';
          })
          .attr('stroke', '#94a3b8').attr('stroke-width', '0.5').attr('vector-effect', 'non-scaling-stroke')
          .on('click', (event, d: any) => onCountryClick(d.properties.name, d.properties.name))
          .on('mouseover', function(event, d: any) {
            handleMouseOver(event, d);
            d3.select(this).attr('fill-opacity', 0.8).attr('stroke', '#3b82f6').attr('stroke-width', '1.5').attr('vector-effect', 'non-scaling-stroke').raise();
          })
          .on('mousemove', handleMouseMove)
          .on('mouseout', function() {
            handleMouseOut();
            d3.select(this).attr('fill-opacity', 1).attr('stroke', '#94a3b8').attr('stroke-width', '0.5').attr('vector-effect', 'non-scaling-stroke');
          });

        // 경고 테두리 (공격 예정)
        if (attackingCountriesRef.current.has(countryName)) {
          countryG.append('path').datum(feature).attr('d', path as any)
            .attr('fill', 'none')
            .attr('stroke', '#ef4444')
            .attr('stroke-width', '3')
            .attr('vector-effect', 'non-scaling-stroke')
            .attr('class', 'pointer-events-none warning-border');
        }

        // 전쟁 오버레이 (공격 시점)
        if (warCountriesRef.current.has(countryName)) {
          countryG.append('path').datum(feature).attr('d', path as any)
            .attr('fill', 'rgba(239, 68, 68, 0.4)')
            .attr('class', 'pointer-events-none');
        }

        // isDestroyed 오버레이
        if (state?.isDestroyed) {
          countryG.append('path').datum(feature).attr('d', path as any)
            .attr('fill', 'rgba(0, 0, 0, 0.55)')
            .attr('class', 'pointer-events-none');
        }

        if (isOwned) {
          countryG.attr('opacity', 0).attr('transform', 'translate(0, 0)')
            .transition().duration(1000).delay(Math.random() * 300)
            .ease(d3.easeElasticOut.amplitude(1).period(0.6))
            .attr('opacity', 1).attr('transform', `translate(0, -${targetDepth})`);
        } else {
          countryG.attr('opacity', 1).attr('transform', 'translate(0, 0)');
        }
      });
    } else {
      gCountries.selectAll('path').data(filteredFeatures).enter().append('path').attr('d', path as any)
        .attr('class', 'country-top cursor-pointer')
        .attr('stroke', '#94a3b8').attr('stroke-width', 0.5).attr('vector-effect', 'non-scaling-stroke')
        .attr('fill', (d: any) => {
          const state = countries[d.properties.name];
          if (!state?.ownerId) return '#CBD5E1';
          return players.find(p => p.id === state.ownerId)?.color || '#CBD5E1';
        })
        .on('click', (event, d: any) => onCountryClick(d.properties.name, d.properties.name))
        .on('mouseover', function(event, d: any) {
          handleMouseOver(event, d);
          d3.select(this).attr('fill-opacity', 0.8).attr('stroke', '#3b82f6').attr('stroke-width', '1.5').attr('vector-effect', 'non-scaling-stroke').raise();
        })
        .on('mousemove', handleMouseMove)
        .on('mouseout', function() {
          handleMouseOut();
          d3.select(this).attr('fill-opacity', 1).attr('stroke', '#94a3b8').attr('stroke-width', '0.5').attr('vector-effect', 'non-scaling-stroke');
        });
      gCountries.selectAll('.destroyed-overlay')
        .data(filteredFeatures.filter((f: any) => {
          const state = countries[f.properties.name];
          return state?.isDestroyed;
        }))
        .enter().append('path')
        .attr('d', path as any)
        .attr('fill', 'rgba(0, 0, 0, 0.55)')
        .attr('class', 'pointer-events-none');
    }

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

        const getMainFeature = (feature: any) => {
          if (feature.geometry.type === 'MultiPolygon') {
            const polygons = feature.geometry.coordinates;
            let maxArea = 0;
            let mainPolygon = polygons[0];
            polygons.forEach((poly: any) => {
              const fake = { type: 'Feature', geometry: { type: 'Polygon', coordinates: poly }, properties: {} };
              const b = path.bounds(fake as any);
              const area = (b[1][0] - b[0][0]) * (b[1][1] - b[0][1]);
              if (area > maxArea) { maxArea = area; mainPolygon = poly; }
            });
            return { ...feature, geometry: { type: 'Polygon', coordinates: mainPolygon } };
          }
          return feature;
        };

        const mainFeature = getMainFeature(feature);
        const centroid = path.centroid(mainFeature);
        if (!centroid || isNaN(centroid[0]) || isNaN(centroid[1])) return;
        const bounds = path.bounds(mainFeature);
        const boundWidth = bounds[1][0] - bounds[0][0];
        const boundHeight = bounds[1][1] - bounds[0][1];
        const countryArea = Math.sqrt(boundWidth * boundHeight);
        const isMobile = window.innerWidth < 768;
        const scaleFactor = Math.min(width, height) / (isMobile ? 1100 : 600);
        const imageSize = Math.min(Math.max(countryArea * 0.35 * scaleFactor, isMobile ? 5 : 8), (isMobile ? 18 : 30) * scaleFactor);
        const hasBuilding = state.buildings > 0;

        const isOwned = !!state.ownerId;
        const targetDepth = isOwned ? (2 + state.buildings * 1) : 0;

        const finalCharSize = hasBuilding ? imageSize * 0.65 : imageSize;
        const charX = hasBuilding ? centroid[0] - imageSize * 0.15 : centroid[0];
        const charY = hasBuilding
          ? centroid[1] - imageSize * 0.3 - targetDepth
          : centroid[1] - imageSize * 0.5 - targetDepth;

        if (hasBuilding) {
          const buildingImg = BUILDING_IMAGES[state.buildings];
          const buildingSize = imageSize * 1.0;
          gPerspective.append('image')
            .attr('href', buildingImg)
            .attr('x', centroid[0] + imageSize * 0.15 - buildingSize / 2)
            .attr('y', centroid[1] - imageSize * 0.5 - buildingSize / 2 - targetDepth)
            .attr('width', buildingSize).attr('height', buildingSize)
            .attr('class', 'pointer-events-none');
        }

        gPerspective.append('image')
          .attr('href', CLUB_IMAGES[player.name] || player.characterUrl)
          .attr('x', charX - finalCharSize / 2).attr('y', charY - finalCharSize / 2)
          .attr('width', finalCharSize).attr('height', finalCharSize)
          .attr('class', 'pointer-events-none');

        // 방어 건물 이미지 추가
        const defenseInfo = defenses[state.id] || defenses[state.name];
        if (defenseInfo && defenseInfo.defense_buildings > 0) {
          const defSize = imageSize * 0.6;
          gPerspective.append('image')
            .attr('href', defenseIcon)
            .attr('x', centroid[0] - imageSize * 0.5 - defSize / 2)
            .attr('y', centroid[1] - imageSize * 0.3 - defSize / 2 - targetDepth)
            .attr('width', defSize).attr('height', defSize)
            .attr('class', 'pointer-events-none')
            .attr('opacity', 0.85)
            .attr('style', 'filter: hue-rotate(120deg)');

          // 방어 건물 수 뱃지
          gPerspective.append('circle')
            .attr('cx', centroid[0] - imageSize * 0.5 + defSize * 0.3)
            .attr('cy', centroid[1] - imageSize * 0.3 - defSize * 0.3 - targetDepth)
            .attr('r', defSize * 0.28)
            .attr('fill', '#10b981')
            .attr('class', 'pointer-events-none');
          gPerspective.append('text')
            .attr('x', centroid[0] - imageSize * 0.5 + defSize * 0.3)
            .attr('y', centroid[1] - imageSize * 0.3 - defSize * 0.3 - targetDepth + defSize * 0.1)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('fill', 'white')
            .attr('font-size', defSize * 0.28)
            .attr('font-weight', '900')
            .attr('class', 'pointer-events-none')
            .text(defenseInfo.defense_buildings);
        }

        // 이미지들 다 그린 후 맨 위에 오버레이
        if (state.isDestroyed) {
          gPerspective.append('path').datum(feature).attr('d', path as any)
            .attr('fill', 'rgba(0, 0, 0, 0.55)')
            .attr('class', 'pointer-events-none')
            .attr('transform', `translate(0, -${targetDepth})`);
        }
      });
    }

    return () => { tooltip.remove(); };
  }, [topology, countries, players, viewMode, rotation, zoomLevel]);

  // ─── warEvents 파티클 애니메이션 (별도 useEffect) ────────────────────────
useEffect(() => {
  if (!topology || !svgRef.current || viewMode !== '2d') return;

  const svg = d3.select(svgRef.current);
  const gMain = svg.select('.main-group');
  const gPerspective = gMain.select('g');

  const width = svgRef.current.clientWidth;
  const height = svgRef.current.clientHeight;
  const projection = d3.geoMercator()
    .scale(width / 6.5)
    .translate([width / 2, height / 1.8]);
  const path = d3.geoPath().projection(projection);
  const features = topojson.feature(topology, topology.objects.countries) as any;
  const filteredFeatures = features.features.filter((f: any) => f.id !== '010' && f.properties.name !== 'Antarctica');

  const intervals: ReturnType<typeof setInterval>[] = [];

  warEvents.forEach((warEvent) => {
    const mappedName = COUNTRY_NAME_MAP[warEvent.country_name] || warEvent.country_name;
    const feature = filteredFeatures.find((f: any) =>
      f.properties.name === mappedName || f.properties.name === warEvent.country_name
    );
    if (!feature) return;

    const centroid = path.centroid(feature);
    if (!centroid || isNaN(centroid[0]) || isNaN(centroid[1])) return;

    const isConquered = warEvent.result === 'conquered';

    // 파티클 한 번 터뜨리는 함수
    const burst = () => {
      // 파티클 30개
      for (let i = 0; i < 30; i++) {
        const angle = Math.random() * 2 * Math.PI;
        const distance = 10 + Math.random() * 40;
        const size = 2 + Math.random() * 4;
        const duration = 800 + Math.random() * 600;
        const hue = isConquered ? Math.random() * 30 : 120 + Math.random() * 40;

        gPerspective.append('circle')
          .attr('cx', centroid[0])
          .attr('cy', centroid[1])
          .attr('r', size)
          .attr('fill', `hsl(${hue}, 100%, 60%)`)
          .attr('opacity', 1)
          .attr('class', 'pointer-events-none')
          .transition()
          .duration(duration)
          .ease(d3.easeQuadOut)
          .attr('cx', centroid[0] + Math.cos(angle) * distance)
          .attr('cy', centroid[1] + Math.sin(angle) * distance)
          .attr('opacity', 0)
          .attr('r', 0)
          .remove();
      }

      // 폭발 원형
      gPerspective.append('circle')
        .attr('cx', centroid[0]).attr('cy', centroid[1])
        .attr('r', 5).attr('fill', 'none')
        .attr('stroke', isConquered ? '#ef4444' : '#22c55e')
        .attr('stroke-width', 3).attr('opacity', 1)
        .attr('class', 'pointer-events-none')
        .transition().duration(600).ease(d3.easeQuadOut)
        .attr('r', 30).attr('opacity', 0).remove();

      // 이모지
      gPerspective.append('text')
        .attr('x', centroid[0]).attr('y', centroid[1] - 10)
        .attr('text-anchor', 'middle').attr('font-size', 16)
        .attr('class', 'pointer-events-none')
        .text(isConquered ? '💥' : '🛡️')
        .transition().duration(2000).ease(d3.easeQuadOut)
        .attr('y', centroid[1] - 40).attr('opacity', 0).remove();
    };

    // 즉시 한 번 터뜨리고, 2초마다 반복, 30초 후 정지
    burst();
    const id = setInterval(burst, 2000);
    intervals.push(id);
    setTimeout(() => clearInterval(id), 30000);
  });

  return () => {
    intervals.forEach(clearInterval);
  };
}, [warEvents, topology, viewMode]);

  useEffect(() => {
    if (!topology || !svgRef.current || !zoomRef.current || viewMode !== '2d') return;
    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    const continent = CONTINENTS[selectedContinent];
    const projection = d3.geoMercator()
      .scale(width / 6.5)
      .translate([width / 2, height / 1.8]);
    const center = projection(continent.center);
    if (!center) return;
    const transform = d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(continent.scale)
      .translate(-center[0], -center[1]);
    svg.transition().duration(1000).ease(d3.easeCubicOut).call(zoomRef.current.transform, transform);
  }, [selectedContinent, topology, viewMode]);

  useEffect(() => {
    if (viewMode !== '3d') return;
    const interval = setInterval(() => {
      if (!isDraggingRef.current && isRotating) {
        setRotation(prev => [prev[0] + 0.3, prev[1], prev[2]]);
      }
    }, 16);
    return () => clearInterval(interval);
  }, [viewMode, isRotating]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden relative rounded-[2rem]"
      style={{
        background: 'rgba(255,255,255,0.38)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        border: '1px solid rgba(255,255,255,0.75)',
        boxShadow: '0 4px 32px rgba(120,150,190,0.15), inset 0 1px 0 rgba(255,255,255,0.85)',
        touchAction: 'pan-y',
      }}
    >
      <style>{`
        @keyframes warningPulse {
          0% { stroke-opacity: 0.2; stroke-width: 2px; }
          100% { stroke-opacity: 1; stroke-width: 5px; }
        }
        .warning-border {
          animation: warningPulse 0.8s ease-in-out infinite alternate;
        }
      `}</style>

      <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing"
        style={{ willChange: 'transform' }}
      />

      <div className="absolute top-5 left-5 flex flex-col gap-3" style={{ pointerEvents: 'none' }}>
        <div className="flex p-[3px] rounded-[14px] gap-[2px]"
          style={{ background: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)', pointerEvents: 'auto' }}
        >
          <button onClick={() => { setViewMode('3d'); setZoomLevel(1); }}
            className="flex items-center gap-2 px-4 py-[6px] rounded-[11px] text-[11px] font-black uppercase tracking-widest transition-all"
            style={viewMode === '3d'
              ? { background: 'rgba(255,255,255,0.88)', color: '#3b82f6', boxShadow: '0 1px 8px rgba(99,130,190,0.2)' }
              : { background: 'transparent', color: '#6b8ab0' }}
          >
            <GlobeIcon className="w-3.5 h-3.5" /> 3D Globe
          </button>
          <button onClick={() => { setViewMode('2d'); setZoomLevel(1); setSelectedContinent('world'); }}
            className="flex items-center gap-2 px-4 py-[6px] rounded-[11px] text-[11px] font-black uppercase tracking-widest transition-all"
            style={viewMode === '2d'
              ? { background: 'rgba(255,255,255,0.88)', color: '#3b82f6', boxShadow: '0 1px 8px rgba(99,130,190,0.2)' }
              : { background: 'transparent', color: '#6b8ab0' }}
          >
            <ArrowLeft className="w-3.5 h-3.5" /> 3D Map
          </button>
        </div>

        {viewMode === '2d' && (
          <div className="flex flex-wrap gap-[6px] max-w-[420px]" style={{ pointerEvents: 'auto' }}>
            {(Object.keys(CONTINENTS) as Continent[]).map((key) => (
              <button key={key} onClick={() => setSelectedContinent(key)}
                className="px-[13px] py-[5px] rounded-full text-[11px] font-semibold transition-all"
                style={selectedContinent === key
                  ? { background: '#3b82f6', color: 'white', border: '1px solid rgba(59,130,246,0.6)', boxShadow: '0 2px 10px rgba(59,130,246,0.25)' }
                  : { background: 'rgba(255,255,255,0.35)', color: '#5a7a9a', border: '1px solid rgba(255,255,255,0.6)', backdropFilter: 'blur(6px)' }}
              >
                {CONTINENTS[key].name}
              </button>
            ))}
          </div>
        )}

        {viewMode === '3d' && (
          <button onClick={() => { setRotation([-10, -20, 0]); setZoomLevel(1); }}
            className="flex items-center justify-center w-10 h-10 rounded-2xl transition-all active:scale-95"
            style={{ background: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)', color: '#6b8ab0', pointerEvents: 'auto' }}
          >
            <RefreshCcw className="w-4 h-4" />
          </button>
        )}

        {viewMode === '3d' && (
          <button onClick={() => setIsRotating(prev => !prev)}
            className="flex items-center justify-center w-10 h-10 rounded-2xl transition-all active:scale-95"
            style={{ background: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)', color: '#6b8ab0', pointerEvents: 'auto' }}
          >
            {isRotating ? '⏸' : '▶'}
          </button>
        )}
      </div>

      <div className="absolute bottom-5 left-5 px-3 py-[10px] rounded-xl text-[10px] space-y-1 font-bold uppercase tracking-tight"
        style={{ background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.75)', pointerEvents: 'none' }}
      >
        <p className="flex items-center gap-2 text-blue-500">
          <GlobeIcon className="w-3 h-3" />
          {viewMode === '3d' ? 'Drag to rotate' : 'Drag to move'}
        </p>
        <p className="flex items-center gap-2" style={{ color: '#7090b0' }}>
          <ZoomIn className="w-3 h-3" /> Mouse wheel to zoom
        </p>
      </div>

      <div className="absolute bottom-5 right-5 px-[14px] py-[10px] rounded-[14px]"
        style={{ background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.75)', pointerEvents: 'none' }}
      >
        <p className="text-[9px] font-black text-slate-400 mb-2 uppercase tracking-widest text-center">Center Tiers</p>
        <div className="space-y-[10px]">
          {BUILDING_TIERS.map(tier => (
            <div key={tier.level} className="flex items-center gap-2">
              <div className="w-[10px] rounded-sm" style={{ height: `${tier.level * 4 + 4}px`, background: '#64748b' }} />
              <span className="text-[10px] font-bold text-slate-600">{tier.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
