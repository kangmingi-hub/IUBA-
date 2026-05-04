/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * OccupancyBar — 지도 아래 컴팩트 점유율 바
 * Supabase users 테이블의 color 컬럼을 players prop으로 받아 사용
 */

import React, { useMemo } from 'react';
import { Globe2 } from 'lucide-react';
import { CountryState, Player } from '../types';

interface OccupancyBarProps {
  countries: Record<string, CountryState>;
  players: Record<string, Player>;
}

interface ClubShare {
  id: string;
  name: string;
  color: string;
  count: number;
  pct: number;
}

// NULL일 때 순서대로 배정할 fallback 색상 팔레트
const FALLBACK_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ec4899',
  '#6366f1', '#14b8a6', '#f97316', '#84cc16',
];

export default function OccupancyBar({ countries, players }: OccupancyBarProps) {
  const { total, empty, clubs } = useMemo(() => {
    const all = Object.values(countries);
    const total = totalCountries;  
    const empty = all.filter(c => !c.ownerId).length;

    const map: Record<string, number> = {};
    all.forEach(c => {
      if (c.ownerId) map[c.ownerId] = (map[c.ownerId] ?? 0) + 1;
    });

    let fallbackIdx = 0;
    const clubs: ClubShare[] = Object.entries(map)
      .map(([id, count]) => {
        const p = players[id];
        // Supabase users.color 컬럼 → 없으면 fallback 팔레트
        const color =
          p?.color ||
          (p as any)?.colour ||
          (p as any)?.mapColor ||
          FALLBACK_COLORS[fallbackIdx++ % FALLBACK_COLORS.length];
        return {
          id,
          name: p?.name ?? p?.username ?? id,
          color,
          count,
          pct: total > 0 ? (count / total) * 100 : 0,
        };
      })
      .sort((a, b) => b.count - a.count);

    return { total, empty, clubs };
  }, [countries, players]);

  const emptyPct = total > 0 ? (empty / total) * 100 : 100;
  const occupiedCount = total - empty;

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
      {/* 한 줄 헤더 + 바 + 범례 */}
      <div className="flex items-center gap-3">
        {/* 아이콘 + 타이틀 */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Globe2 className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-[10px] font-extrabold text-[#64748B] uppercase tracking-widest whitespace-nowrap">
            점유 현황
          </span>
        </div>

        {/* 누적 바 */}
        <div
          className="flex h-5 rounded-lg overflow-hidden flex-1"
          style={{ gap: 2, minWidth: 0 }}
        >
          {clubs.map(club => (
            <div
              key={club.id}
              title={`${club.name}: ${club.count}국 (${club.pct.toFixed(1)}%)`}
              style={{
                width: `${club.pct}%`,
                backgroundColor: club.color,
                minWidth: club.count > 0 ? 5 : 0,
                transition: 'width 0.7s cubic-bezier(0.34,1.56,0.64,1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {club.pct >= 8 && (
                <span style={{ fontSize: 8, fontWeight: 900, color: 'rgba(255,255,255,0.95)' }}>
                  {club.pct.toFixed(0)}%
                </span>
              )}
            </div>
          ))}
          {emptyPct > 0 && (
            <div
              title={`빈 땅: ${empty}국`}
              style={{
                flex: 1,
                background: '#E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {emptyPct >= 8 && (
                <span style={{ fontSize: 8, fontWeight: 700, color: '#94A3B8' }}>
                  {emptyPct.toFixed(0)}%
                </span>
              )}
            </div>
          )}
        </div>

        {/* 카운터 */}
        <div className="flex-shrink-0 text-right">
          <span className="text-xs font-black text-[#1E293B]">{occupiedCount}</span>
          <span className="text-[10px] text-[#94A3B8]"> / {total}</span>
        </div>
      </div>

      {/* 인라인 범례 (색 점 + 이름만, 한 줄) */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {clubs.map(club => (
          <div key={club.id} className="flex items-center gap-1">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: club.color }}
            />
            <span className="text-[10px] font-semibold text-[#475569] whitespace-nowrap">
              {club.name} <strong className="text-[#1E293B]">{club.count}</strong>
            </span>
          </div>
        ))}
        {empty > 0 && (
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-slate-200 flex-shrink-0" />
            <span className="text-[10px] font-semibold text-[#94A3B8] whitespace-nowrap">
              빈 땅 <strong className="text-[#1E293B]">{empty}</strong>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
