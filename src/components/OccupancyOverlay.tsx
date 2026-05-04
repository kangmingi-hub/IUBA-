/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * OccupancyOverlay — 지도 위 오버레이 점유율 바 차트
 * WorldMap을 감싸는 div 안에 absolute로 배치합니다.
 */

import React, { useMemo, useState } from 'react';
import { Globe2, ChevronDown, ChevronUp } from 'lucide-react';
import { CountryState, Player } from '../types';

interface OccupancyOverlayProps {
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

export default function OccupancyOverlay({ countries, players }: OccupancyOverlayProps) {
  const [expanded, setExpanded] = useState(true);

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
        return {
          id,
          name: p?.name ?? id,
          color: p?.color ?? '#94a3b8',
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
      style={{
        position: 'absolute',
        bottom: 16,
        left: 16,
        right: 16,
        zIndex: 20,
        background: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.85)',
        boxShadow: '0 8px 32px rgba(30,60,120,0.13), inset 0 1px 0 rgba(255,255,255,0.9)',
        borderRadius: 16,
        padding: expanded ? '14px 16px 12px' : '10px 16px',
        transition: 'padding 0.25s ease',
      }}
    >
      {/* 헤더 행 */}
      <div className="flex items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <Globe2 className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
          <span className="text-[10px] font-extrabold text-[#64748B] uppercase tracking-widest">Territory</span>
          <span className="text-xs font-black text-[#1E293B]">
            {occupiedCount} <span className="text-[#94A3B8] font-semibold">/ {total}</span>
          </span>
          <span className="text-[10px] text-[#94A3B8]">국가 점령</span>
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          className="p-1 rounded-lg hover:bg-slate-100 transition-colors text-[#94A3B8]"
        >
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* 누적 바 */}
      <div className="mt-2 flex h-5 w-full rounded-full overflow-hidden" style={{ gap: 2 }}>
        {clubs.map(club => (
          <div
            key={club.id}
            title={`${club.name}: ${club.count}국 (${club.pct.toFixed(1)}%)`}
            style={{
              width: `${club.pct}%`,
              backgroundColor: club.color,
              minWidth: club.count > 0 ? 4 : 0,
              transition: 'width 0.6s cubic-bezier(0.34,1.56,0.64,1)',
            }}
          />
        ))}
        {emptyPct > 0 && (
          <div
            style={{ width: `${emptyPct}%`, transition: 'width 0.6s ease', background: '#E2E8F0' }}
            title={`빈 땅: ${empty}국 (${emptyPct.toFixed(1)}%)`}
          />
        )}
      </div>

      {/* 확장 시 범례 + 상세 목록 */}
      {expanded && (
        <div className="mt-3 space-y-1.5">
          {clubs.map((club, i) => (
            <div key={club.id} className="flex items-center gap-2">
              <span className="text-[9px] font-black text-[#CBD5E1] w-3 text-center">{i + 1}</span>
              <span
                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: club.color }}
              />
              <span className="flex-1 text-[11px] font-semibold text-[#334155] truncate">{club.name}</span>
              {/* 미니 바 */}
              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${club.pct}%`,
                    backgroundColor: club.color,
                    transition: 'width 0.6s ease',
                  }}
                />
              </div>
              <span className="text-[11px] font-black text-[#1E293B] w-5 text-right">{club.count}</span>
              <span className="text-[10px] text-[#94A3B8] w-10 text-right">{club.pct.toFixed(1)}%</span>
            </div>
          ))}

          {/* 빈 땅 행 */}
          {empty > 0 && (
            <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
              <span className="text-[9px] font-black text-transparent w-3">-</span>
              <span className="w-2.5 h-2.5 rounded-sm bg-slate-200 flex-shrink-0" />
              <span className="flex-1 text-[11px] font-semibold text-[#94A3B8]">빈 땅</span>
              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-slate-200"
                  style={{ width: `${emptyPct}%`, transition: 'width 0.6s ease' }}
                />
              </div>
              <span className="text-[11px] font-black text-[#1E293B] w-5 text-right">{empty}</span>
              <span className="text-[10px] text-[#94A3B8] w-10 text-right">{emptyPct.toFixed(1)}%</span>
            </div>
          )}

          {clubs.length === 0 && (
            <p className="text-center text-[11px] text-[#94A3B8] py-1">아직 점령한 동아리가 없어요</p>
          )}
        </div>
      )}
    </div>
  );
}
