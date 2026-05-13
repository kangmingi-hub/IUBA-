import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Flag, X } from 'lucide-react';
import { Player, CountryState } from '../types';
import { COUNTRY_PRICES, DEFAULT_COUNTRY_PRICE, BUILDING_TIERS } from '../constants';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

// Props 수정
interface Props {
  players: Player[];
  countries: Record<string, CountryState>;
  onCancel: (countryId: string) => void;
  onCancelBuilding: (countryId: string) => void;
  onCancelDefense: (countryId: string) => void;  // ← 추가
  onHealGhosts: () => void;
 defenses: Record<string, { defense_buildings: number; defense_power: number }>;  // ← 추가
}

 export default function TerritoriesPanel({ players, countries, onCancel, onCancelBuilding, onCancelDefense, onHealGhosts, defenses }: Props) {
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
  const occupiedCountries = Object.values(countries).filter(c => c.ownerId);

  const handleCancel = (countryId: string) => {
    onCancel(countryId);
    setCancelConfirmId(null);
  };

const handleCancelBuilding = (countryId: string) => {
  console.log('countryId:', countryId);
  onCancelBuilding(countryId);
};
  
  return (
    <motion.div
        key="territories"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="flex flex-col rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.38)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          border: '1px solid rgba(255,255,255,0.75)',
          boxShadow: '0 4px 32px rgba(120,150,190,0.15), inset 0 1px 0 rgba(255,255,255,0.85)',
        }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/30">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-slate-700 tracking-wide">점령 현황 관리</h2>
            <button type="button" onClick={onHealGhosts}
              className="flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-500 border border-red-100 hover:bg-red-100 text-[10px] font-black rounded-lg transition-colors">
              🧹 유령 영토 청소
            </button>
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            총 {occupiedCountries.length}개 나라 점령 중
          </span>
        </div>
      
        <div className="p-6 overflow-y-auto custom-scrollbar max-h-[calc(100vh-280px)]">
          {occupiedCountries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Flag className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm font-bold">현재 점령된 나라가 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {players.map(player => {
                const ownedList = Object.values(countries).filter(c => c.ownerId === player.id);
                if (ownedList.length === 0) return null;
                return (
                  <div key={player.id} className="rounded-2xl overflow-hidden"
                    style={{
                      background: 'rgba(255,255,255,0.55)',
                      border: '1px solid rgba(255,255,255,0.75)',
                      backdropFilter: 'blur(8px)',
                    }}
                  >
                    <div className="flex items-center gap-3 px-5 py-3 border-b border-white/40"
                      style={{ backgroundColor: `${player.color}18` }}>
                      <img src={player.characterUrl} alt={player.name} className="w-8 h-8 rounded-full border-2 p-0.5 bg-white shadow-sm" style={{ borderColor: player.color }} />
                      <span className="font-black text-sm uppercase tracking-tight" style={{ color: player.color }}>{player.name}</span>
                      <span className="ml-auto text-[10px] font-bold text-slate-400 bg-white/70 border border-white/60 px-2 py-0.5 rounded-full">{ownedList.length}개 점령</span>
                    </div>
                    <div className="divide-y divide-white/40">
                      {ownedList.map(country => {
                        const buildingLabel = country.buildings === 0 ? '센터 없음' : BUILDING_TIERS[country.buildings - 1].name;
                        const refundGold = COUNTRY_PRICES[country.id] || DEFAULT_COUNTRY_PRICE;
                        const isConfirming = cancelConfirmId === country.id;
                        return (
                          <div key={country.id} className={cn("flex items-center gap-4 px-5 py-3.5 transition-colors", isConfirming ? "bg-red-50/60" : "hover:bg-white/30")}>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-black text-slate-700 truncate uppercase tracking-tight">{country.id}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] font-bold text-slate-400">{buildingLabel}</span>
                                <span className="text-[10px] text-slate-300">|</span>
                                <span className="text-[10px] font-bold text-amber-500">환불 {refundGold}G</span>
                              </div>
                            </div>
                            {isConfirming ? (
                              <div className="flex items-center gap-2">
                                <button onClick={() => handleCancel(country.id)} className="px-3 py-1.5 bg-red-500 text-white text-[11px] font-black rounded-lg">확인</button>
                                <button onClick={() => setCancelConfirmId(null)} className="px-3 py-1.5 bg-white/70 text-slate-600 text-[11px] font-black rounded-lg">아니오</button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                {country.buildings > 0 && (
                                  <button onClick={() => handleCancelBuilding(country.id)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-amber-500 hover:text-amber-600 hover:bg-amber-50/70 border border-amber-100 rounded-lg text-[11px] font-black transition-all">
                                    🏚️ 건물 -1
                                  </button>
                                )}
                                {(defenses[country.id]?.defense_buildings > 0 || defenses[country.name]?.defense_buildings > 0) && (
                                    <button onClick={() => onCancelDefense(country.id)}
                                      className="...">
                                      🛡️ 방어 -1
                                    </button>
                                  )}
                                <button onClick={() => setCancelConfirmId(country.id)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-red-400 hover:text-red-600 hover:bg-red-50/70 border border-red-100 rounded-lg text-[11px] font-black transition-all">
                                  <X className="w-3 h-3" /> 점령 취소
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
  );
}
