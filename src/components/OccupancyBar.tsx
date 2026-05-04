/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Globe2 } from 'lucide-react';
import { CountryState, Player } from '../types';

interface OccupancyBarProps {
  countries: Record<string, CountryState>; // 점유된 나라만 들어옴 (Supabase)
  players: Record<string, Player>;
  totalCountries?: number; // 월드맵 전체 국가 수 (기본값 177)
}

const FALLBACK_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ec4899',
  '#6366f1', '#14b8a6', '#f97316', '#84cc16',
];

export default function OccupancyBar({
  countries,
  players,
  totalCountries = 177,
}: OccupancyBarProps) {

  const { clubs, occupiedCount, emptyCount, emptyPct } = useMemo(() => {
    // 동아리별 점령 수 집계
    const map: Record<string, number> = {};
    Object.values(countries).forEach(c => {
      if (c.ownerId) {
        map[c.ownerId] = (map[c.ownerId] ?? 0) + 1;
      }
    });

    const occupiedCount = Object.values(map).reduce((a, b) => a + b, 0);
    const emptyCount = totalCountries - occupiedCount;
    const emptyPct = (emptyCount / totalCountries) * 100;

    let fallbackIdx = 0;
    const clubs = Object.entries(map)
      .map(([id, count]) => {
        const p = players[id];
        const color =
          p?.color ||
          (p as any)?.colour ||
          FALLBACK_COLORS[fallbackIdx++ % FALLBACK_COLORS.length];
        return {
          id,
          name: p?.name ?? (p as any)?.username ?? id,
          color,
          count,
          pct: (count / totalCountries) * 100,
        };
      })
      .sort((a, b) => b.count - a.count);

    return { clubs, occupiedCount, emptyCount, emptyPct };
  }, [countries, players, totalCountries]);

  return (
    <div
      className="rounded-2xl px-4 py-3"
      style={{
        background: 'rgba(255,255,255,0.38)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        border: '1px solid rgba(255,255,255,0.75)',
        boxShadow: '0 4px 32px rgba(120,150,190,0.15), inset 0 1px 0 rgba(255,255,255,0.85)',
      }}
    >
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Globe2 className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-[10px] font-extrabold text-[#64748B] uppercase tracking-widest">
            점유 현황
          </span>
        </div>
        <div className="ml-auto flex-shrink-0">
          <span className="text-xs font-black text-[#1E293B]">{occupiedCount}</span>
          <span className="text-[10px] text-[#94A3B8]"> / {totalCountries} 국가</span>
        </div>
      </div>

      {/* 누적 바 */}
      <div className="flex h-5 w-full rounded-lg overflow-hidden" style={{ gap: 2 }}>
        {clubs.map(club => (
          <div
            key={club.id}
            title={`${club.name}: ${club.count}국 (${club.pct.toFixed(1)}%)`}
            style={{
              width: `${club.pct}%`,
              backgroundColor: club.color,
              minWidth: club.count > 0 ? 4 : 0,
              transition: 'width 0.7s cubic-bezier(0.34,1.56,0.64,1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {club.pct >= 6 && (
              <span style={{ fontSize: 8, fontWeight: 900, color: 'rgba(255,255,255,0.95)' }}>
                {club.pct.toFixed(0)}%
              </span>
            )}
          </div>
        ))}

        {/* 미점령 — 회색 */}
        <div
          title={`미점령: ${emptyCount}국 (${emptyPct.toFixed(1)}%)`}
          style={{
            flex: 1,
            background: '#CBD5E1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {emptyPct >= 5 && (
            <span style={{ fontSize: 8, fontWeight: 700, color: '#64748B' }}>
              {emptyPct.toFixed(0)}%
            </span>
          )}
        </div>
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {clubs.map(club => (
          <div key={club.id} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: club.color }} />
            <span className="text-[10px] font-semibold text-[#475569] whitespace-nowrap">
              {club.name} <strong className="text-[#1E293B]">{club.count}</strong>
            </span>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full flex-shrink-0 bg-slate-300" />
          <span className="text-[10px] font-semibold text-[#94A3B8] whitespace-nowrap">
            미점령 <strong className="text-[#1E293B]">{emptyCount}</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
