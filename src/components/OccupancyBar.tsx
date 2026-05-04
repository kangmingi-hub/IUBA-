/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * OccupancyBar — 지도 아래 별도 패널로 점유율 표시
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

export default function OccupancyBar({ countries, players }: OccupancyBarProps) {
  const { total, empty, clubs } = useMemo(() => {
    const all = Object.values(countries);
    const total = all.length;
    const empty = all.filter(c => !c.ownerId).length;

    const map: Record<string, number> = {};
    all.forEach(c => {
      if (c.ownerId) map[c.ownerId] = (map[c.ownerId] ?? 0) + 1;
    });

    const clubs: ClubShare[] = Object.entries(map)
      .map(([id, count]) => {
        const p = players[id];
        // color 필드가 없으면 avatarColor, profileColor 순으로 fallback
        const color =
          p?.color ||
          (p as any)?.avatarColor ||
          (p as any)?.profileColor ||
          '#94a3b8';
        return {
          id,
          name: p?.name ?? id,
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
      className="rounded-2xl p-4"
      style={{
        background: 'rgba(255,255,255,0.38)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        border: '1px solid rgba(255,255,255,0.75)',
        boxShadow: '0 4px 32px rgba(120,150,190,0.15), inset 0 1px 0 rgba(255,255,255,0.85)',
      }}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Globe2 className="w-4 h-4 text-blue-600" />
          <span className="text-[11px] font-extrabold text-[#64748B] uppercase tracking-widest">Territory</span>
          <span className="text-xs font-black text-[#1E293B]">전체 점유 현황</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-black text-[#1E293B]">{occupiedCount}</span>
          <span className="text-[#94A3B8]">/ {total} 국가 점령</span>
        </div>
      </div>

      {/* 누적 바 */}
      <div className="flex h-7 w-full rounded-xl overflow-hidden" style={{ gap: 2 }}>
        {clubs.map(club => (
          <div
            key={club.id}
            title={`${club.name}: ${club.count}국 (${club.pct.toFixed(1)}%)`}
            style={{
              width: `${club.pct}%`,
              backgroundColor: club.color,
              minWidth: club.count > 0 ? 6 : 0,
              transition: 'width 0.7s cubic-bezier(0.34,1.56,0.64,1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {club.pct >= 5 && (
              <span style={{ fontSize: 9, fontWeight: 900, color: 'rgba(255,255,255,0.9)', whiteSpace: 'nowrap' }}>
                {club.pct.toFixed(0)}%
              </span>
            )}
          </div>
        ))}
        {emptyPct > 0 && (
          <div
            title={`빈 땅: ${empty}국 (${emptyPct.toFixed(1)}%)`}
            style={{
              flex: 1,
              background: '#E2E8F0',
              transition: 'width 0.6s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {emptyPct >= 5 && (
              <span style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', whiteSpace: 'nowrap' }}>
                {emptyPct.toFixed(0)}%
              </span>
            )}
          </div>
        )}
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3">
        {clubs.map(club => (
          <div key={club.id} className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: club.color }}
            />
            <span className="text-[11px] font-semibold text-[#475569]">{club.name}</span>
            <span className="text-[11px] font-black text-[#1E293B]">{club.count}국</span>
          </div>
        ))}
        {empty > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-slate-200 flex-shrink-0" />
            <span className="text-[11px] font-semibold text-[#94A3B8]">빈 땅</span>
            <span className="text-[11px] font-black text-[#1E293B]">{empty}국</span>
          </div>
        )}
      </div>
    </div>
  );
}
