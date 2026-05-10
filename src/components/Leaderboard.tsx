import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Building2, RefreshCcw, Coins } from 'lucide-react';
import { Player, CountryState, User } from '../types';
import { CLUB_IMAGES } from '../constants';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

interface Props {
  clubPoints: { club_name: string; remaining_evangelism_points: number; remaining_speech_points: number; }[];
  players: Player[];
  countries: Record<string, CountryState>;
  isSyncing: boolean;
  onRefresh: () => void;
  onReset: () => void;
  onResetManual: () => void;
  currentUser: User | null;
}

export default function Leaderboard({ clubPoints, players, countries, isSyncing, onRefresh, onReset, onResetManual, currentUser }: Props) {
  const [paused, setPaused] = useState(false);

  const filteredClubs = clubPoints.filter(
    club => club.club_name !== 'Evergreen' && club.club_name !== 'BPM' && club.club_name !== 'MARE'
  );

  // 카드 한 장의 높이: p-3.5(14px*2) + gap-2.5(10px) + 내부 컨텐츠 ≈ 110px 로 측정 후 조정
  // 실제로는 CSS로 처리하므로 duration만 조절하면 됩니다
  const DURATION_PER_ITEM = 3; // 초 / 카드 1장 — 클수록 느림
  const totalDuration = filteredClubs.length * DURATION_PER_ITEM;

  const ClubCard = ({ club }: { club: typeof filteredClubs[0] }) => {
    const player = players.find(p => p.name === club.club_name);
    const ownedCount = player
      ? (Object.values(countries) as CountryState[]).filter(c => c.ownerId === player.id).length
      : 0;
    const totalBuildings = player
      ? (Object.values(countries) as CountryState[])
          .filter(c => c.ownerId === player.id)
          .reduce((sum, c) => sum + c.buildings, 0)
      : 0;

    return (
      <div className={cn(
        "flex flex-col gap-2.5 p-3.5 rounded-2xl border transition-all",
        ownedCount > 0
          ? "border-blue-300/40 bg-white/85"
          : "border-white/30 bg-white/80"
      )}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={CLUB_IMAGES[club.club_name] || player?.characterUrl || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${club.club_name}`}
              alt={club.club_name}
              className="w-10 h-10 rounded-full border-2 p-0.5 bg-white"
              style={{ borderColor: player?.color || '#CBD5E1' }}
            />
            <div
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white shadow-sm"
              style={{ backgroundColor: player?.color || '#CBD5E1' }}
            />
          </div>
          <div>
            <h3 className="font-black text-[#1E293B] text-sm uppercase tracking-tight">{club.club_name}</h3>
            <p className="text-[9px] font-bold text-slate-400">{ownedCount} Territories • {totalBuildings} Centers</p>
          </div>
        </div>

        <div className="flex gap-2 pt-2 border-t border-slate-200/60">
          <div className="flex-1 flex flex-col gap-1 bg-amber-50 p-2.5 rounded-xl border border-amber-100">
            <div className="flex items-center gap-1.5">
              <Coins className="w-2.5 h-2.5 text-amber-500" />
              <span className="text-[8px] font-black text-amber-600 uppercase tracking-tighter">MINERAL</span>
            </div>
            <div className="text-sm font-black text-amber-700 flex items-center gap-1">
              {(player?.gold ?? club.remaining_evangelism_points).toLocaleString()}
              <span className="text-[9px] font-bold text-amber-400">M</span>
            </div>
          </div>
          <div className="flex-1 flex flex-col gap-1 bg-blue-50 p-2.5 rounded-xl border border-blue-100">
            <div className="flex items-center gap-1.5">
              <Building2 className="w-2.5 h-2.5 text-blue-500" />
              <span className="text-[8px] font-black text-blue-600 uppercase tracking-tighter">GAS</span>
            </div>
            <div className="text-sm font-black text-blue-700 flex items-center gap-1">
              {(player?.buildingPower ?? club.remaining_speech_points).toLocaleString()}
              <span className="text-[9px] font-bold text-blue-400">G</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden rounded-2xl"
      style={{
        background: 'rgba(255,255,255,0.38)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        border: '1px solid rgba(255,255,255,0.75)',
        boxShadow: '0 4px 32px rgba(120,150,190,0.15), inset 0 1px 0 rgba(255,255,255,0.85)',
      }}
    >
      {/* keyframes 인라인 정의 */}
      <style>{`
        @keyframes marquee-up {
          0%   { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        .marquee-track {
          animation: marquee-up ${totalDuration}s linear infinite;
          animation-play-state: running;
        }
        .marquee-track.paused {
          animation-play-state: paused;
        }
      `}</style>

      {/* 헤더 */}
      <div className="flex justify-between items-center px-5 py-4 border-b border-white/30">
        <h2 className="text-sm font-bold text-slate-700 tracking-wide">지역별 포인트 현황</h2>
        <button
          onClick={onRefresh}
          disabled={isSyncing}
          className={cn(
            "p-1.5 rounded-lg transition-colors text-slate-400 hover:text-slate-600 hover:bg-white/40",
            isSyncing && "animate-spin"
          )}
        >
          <RefreshCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 뷰포트: overflow hidden으로 잘라냄 — 스크롤 불가 */}
      <div
        className="flex-1 overflow-hidden relative p-3"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setTimeout(() => setPaused(false), 1500)}
      >
        {/* 상단 페이드 */}
        <div className="pointer-events-none absolute top-0 left-0 right-0 h-8 z-10"
          style={{ background: 'linear-gradient(to bottom, rgba(240,245,255,0.7), transparent)' }} />
        {/* 하단 페이드 */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 z-10"
          style={{ background: 'linear-gradient(to top, rgba(240,245,255,0.7), transparent)' }} />

        {filteredClubs.length === 0 && !isSyncing && (
          <div className="text-center py-10">
            <p className="text-xs text-slate-400">데이터를 불러올 수 없습니다.</p>
          </div>
        )}

        {/* 트랙: 원본 + 사본 2벌. -50% translateY 시 정확히 원본 위치로 복귀 */}
        {filteredClubs.length > 0 && (
          <div className={cn("marquee-track space-y-2.5", paused && "paused")}>
            {/* 원본 */}
            {filteredClubs.map((club) => (
              <ClubCard key={`a-${club.club_name}`} club={club} />
            ))}
            {/* 사본 — 시각적으로 이어붙임 */}
            {filteredClubs.map((club) => (
              <ClubCard key={`b-${club.club_name}`} club={club} />
            ))}
          </div>
        )}
      </div>

      {/* 어드민 버튼 */}
      {currentUser?.role === 'admin' && (
        <div className="p-3 border-t border-white/30 space-y-2">
          <button onClick={onResetManual}
            className="w-full py-2.5 text-[9px] font-black text-white/40 hover:text-amber-300 transition-colors uppercase tracking-[0.2em] bg-white/8 border border-white/15 rounded-xl hover:bg-amber-400/10 hover:border-amber-300/30">
            수동 추가 점수 초기화
          </button>
          <button onClick={onReset}
            className="w-full py-2.5 text-[9px] font-black text-white/40 hover:text-red-300 transition-colors uppercase tracking-[0.2em] bg-white/8 border border-white/15 rounded-xl hover:bg-red-400/10 hover:border-red-300/30">
            게임 지표 초기화
          </button>
        </div>
      )}
    </div>
  );
}
