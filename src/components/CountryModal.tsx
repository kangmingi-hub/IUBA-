import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Coins, Building2, PlusCircle, Lock } from 'lucide-react';
import { Player, CountryState, User } from '../types';
import { COUNTRY_PRICES, DEFAULT_COUNTRY_PRICE, CLUB_IMAGES, getBuildingTiers, TEAM_ALIASES } from '../constants';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';


function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

interface Props {
  selectedCountry: { id: string; name: string } | null;
  countries: Record<string, CountryState>;
  players: Player[];
  currentUser: User | null;
  onClose: () => void;
  onBuy: (countryId: string, playerId: string, countryName: string) => void;
  onBuild: (countryId: string) => void;
  onBuildDefense: (countryId: string) => void;
  onRestore: (countryId: string) => void;
}

export default function CountryModal({ selectedCountry, countries, players, currentUser, onClose, onBuy, onBuild, onBuildDefense, onRestore }: Props) {
  if (!selectedCountry) return null;
  const [defenseData, setDefenseData] = useState<{ defense_buildings: number; defense_power: number } | null>(null);

  useEffect(() => {
    if (!selectedCountry) return;
    const fetch = async () => {
      const { data } = await supabase
        .from('country_defenses')
        .select('defense_buildings, defense_power')
        .eq('country_id', selectedCountry.id)
        .single();
      setDefenseData(data || null);
    };
    fetch();
  }, [selectedCountry?.id]);

  const ownedCountry = countries[selectedCountry.id] || countries[selectedCountry.name];
  const isAdmin = currentUser?.role === 'admin';

  // 현재 로그인한 유저의 player 정보
  const resolvedName = TEAM_ALIASES[currentUser?.username || ''] || currentUser?.username;
const myPlayer = players.find(p => p.name === resolvedName);

  // 내 동아리가 소유한 나라인지
  const isMyCountry = !!myPlayer && ownedCountry?.ownerId === myPlayer.id;

  // 건설 가능 여부: admin이거나 내 나라일 때
  const canBuild = (isAdmin || isMyCountry) && !ownedCountry?.isDestroyed;

  return (
    <AnimatePresence>
      {selectedCountry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-lg bg-white border border-[#E2E8F0] rounded-[2rem] overflow-hidden shadow-2xl"
          >
            <div className="h-24 bg-[#FAFBFF] border-b border-[#E2E8F0] flex items-center px-8">
              <div className="flex-1">
                <span className="text-[10px] font-extrabold text-[#64748B] uppercase tracking-widest">Territory Briefing</span>
                <h3 className="text-2xl font-black text-[#1E293B] leading-tight uppercase">{selectedCountry.name}</h3>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8">
              <div className="flex gap-6 mb-8">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Conquer Cost</span>
                  <div className="flex items-center gap-2">
                    <Coins className="w-5 h-5 text-amber-500" />
                    {/* 👇 G를 MINERAL로 변경했습니다 */}
                    <span className="text-xl font-black text-amber-600">{COUNTRY_PRICES[selectedCountry.name] || DEFAULT_COUNTRY_PRICE} MINERAL</span>
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Center Cost</span>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-500" />
                    <span className="text-xl font-black text-blue-600 font-mono">
                      {(() => {
                        const tiers = getBuildingTiers(selectedCountry.name);
                        const buildings = ownedCountry?.buildings || 0;
                        if (buildings >= 3) return 'MAX';
                        return tiers[buildings].cost;
                      })()} GAS {/* 👇 P를 GAS로 변경했습니다 */}
                    </span>
                  </div>
                </div>
              </div>

              {ownedCountry?.ownerId ? (
                <div className="space-y-6">
                <div className="flex items-center justify-center h-28 bg-[#FAFBFF] rounded-2xl border border-[#E2E8F0] shadow-inner mb-4">
                                    <div className="flex items-center justify-center relative w-full h-full">
                
                
                                      {/* 캐릭터 이미지 */}
                                      <motion.div layout transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} className="relative z-10">
                                        <img
                                          src={(() => {
                                            const owner = players.find(p => p.id === ownedCountry.ownerId);
                                            return owner
                                              ? (CLUB_IMAGES[owner.name] || owner.characterUrl || "https://cdn-icons-png.flaticon.com/512/149/149071.png")
                                              : "https://cdn-icons-png.flaticon.com/512/149/149071.png";
                                          })()}
                                          alt="캐릭터"
                                          className="w-16 h-16 rounded-full border-4 shadow-md bg-white object-cover"
                                          style={{ borderColor: players.find(p => p.id === ownedCountry.ownerId)?.color || '#3B82F6' }}
                                          onError={(e) => { (e.target as HTMLImageElement).src = "https://cdn-icons-png.flaticon.com/512/149/149071.png"; }}
                                        />
                                      </motion.div>
                
                                      {/* 센터 건물 아이콘 */}
                                      <AnimatePresence>
                                        {ownedCountry.buildings > 0 && (
                                          <motion.div
                                            initial={{ opacity: 0, scale: 0, x: -20 }}
                                            animate={{ opacity: 1, scale: 1, x: 0 }}
                                            exit={{ opacity: 0, scale: 0, x: -20 }}
                                            transition={{ type: "spring", bounce: 0.4, duration: 0.6 }}
                                            className="relative z-20"
                                          >
                                            <img
                                              src="https://cdn-icons-png.flaticon.com/512/2555/2555572.png"
                                              alt="건물"
                                              className="w-16 h-16 drop-shadow-xl object-contain"
                                            />
                                            <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                                              Lv.{ownedCountry.buildings}
                                            </span>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>

                                      {/* 방어 건물 방패 아이콘 */}
                      <AnimatePresence>
                        {defenseData && defenseData.defense_buildings > 0 && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0 }}
                            transition={{ type: "spring", bounce: 0.4, duration: 0.6 }}
                            className="relative z-30"
                          >
                            <div className="w-14 h-14 flex items-center justify-center text-4xl drop-shadow-xl">
                              🛡️
                            </div>
                            <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                              {defenseData.defense_buildings}
                            </span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                
                                      {/* 방어 건물 수 뱃지 */}
                                      <AnimatePresence>
                                        {defenseData && defenseData.defense_buildings > 0 && (
                                          <motion.div
                                            initial={{ opacity: 0, scale: 0 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0 }}
                                            className="absolute top-2 right-4 z-30 flex items-center gap-1 px-2 py-1 rounded-full"
                                            style={{ background: 'rgba(16,185,129,0.9)' }}
                                          >
                                            <span className="text-[10px]">🛡️</span>
                                            <span className="text-white text-[10px] font-black">{defenseData.defense_buildings}</span>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                
                                    </div>
                                  </div>
                  

                  <div className="p-6 bg-[#FAFBFF] rounded-2xl border border-[#E2E8F0] flex items-center justify-between shadow-sm">
                    <div>
                      <p className="text-[10px] text-[#64748B] uppercase font-bold tracking-widest mb-2">Occupying Force</p>
                      <p className="text-2xl font-black text-blue-600">
                        {players.find(p => p.id === ownedCountry.ownerId)?.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-[#64748B] uppercase font-bold tracking-widest mb-2">Building Tier</p>
                      <p className="text-xl font-black text-[#1E293B] font-mono">
                        {ownedCountry.buildings === 0 ? '없음' : getBuildingTiers(selectedCountry.name)[ownedCountry.buildings - 1].name}
                      </p>
                    </div>
                  </div>

                  {defenseData && (
                    <div className="p-4 rounded-2xl flex items-center justify-between"
                      style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">🛡️</span>
                        <div>
                          <p className="text-[10px] text-emerald-400 uppercase font-bold tracking-widest">방어 건물</p>
                          <p className="text-white font-black">{defenseData.defense_buildings}개</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-emerald-400 uppercase font-bold tracking-widest">방어력</p>
                        <p className="text-emerald-400 font-black text-xl">{defenseData.defense_power}</p>
                      </div>
                    </div>
                  )}
                  
              {canBuild && (
                    <button
                      onClick={() => onBuildDefense(selectedCountry.id)}
                      className="w-full py-4 rounded-2xl font-black text-white flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                      style={{
                        background: 'linear-gradient(135deg, rgba(16,185,129,0.8), rgba(5,150,105,0.8))',
                        border: '1px solid rgba(16,185,129,0.5)',
                        boxShadow: '0 4px 20px rgba(16,185,129,0.3)',
                      }}
                    >
                      🛡️ 방어 건물 건설 (15 GAS)
                    </button>
                  )}

{ownedCountry?.isDestroyed && (isAdmin ? (
  <button
    onClick={() => onRestore(selectedCountry.id)}
    className="w-full py-4 rounded-2xl font-black text-white flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
    style={{
      background: 'linear-gradient(135deg, rgba(239,68,68,0.8), rgba(220,38,38,0.8))',
      border: '1px solid rgba(239,68,68,0.5)',
      boxShadow: '0 4px 20px rgba(239,68,68,0.3)',
    }}
  >
    🔧 영토 복구 (30 GAS)
  </button>
) : canBuild && (
  <button
    onClick={() => onRestore(selectedCountry.id)}
    className="w-full py-4 rounded-2xl font-black text-white flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
    style={{
      background: 'linear-gradient(135deg, rgba(239,68,68,0.8), rgba(220,38,38,0.8))',
      border: '1px solid rgba(239,68,68,0.5)',
      boxShadow: '0 4px 20px rgba(239,68,68,0.3)',
    }}
  >
    🔧 영토 복구 (30 MINERAL)
  </button>
))}
                  
                  {canBuild ? (
                    <button
                      onClick={() => onBuild(selectedCountry.id)}
                      disabled={ownedCountry.buildings >= 3}
                      className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 disabled:cursor-not-allowed py-5 rounded-2xl font-black text-white shadow-xl shadow-blue-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3 uppercase tracking-widest"
                    >
                      <PlusCircle className="w-6 h-6" />
                      {ownedCountry.buildings >= 3 ? '모든 건설 완료' : `${getBuildingTiers(selectedCountry.name)[ownedCountry.buildings].name} 건설`}
                    </button>
                  ) : (
                    <div className="w-full py-5 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center gap-3 text-slate-400">
                      <Lock className="w-5 h-5" />
                      <span className="text-[11px] font-black uppercase tracking-widest">본인 동아리 영토만 건설 가능합니다</span>
                    </div>
                  )}  
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 italic text-[11px] text-blue-600 font-medium text-center">
                    본 영토는 현재 미점유 상태입니다. 자원을 사용하여 지경을 넓히십시오.
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {players.map(player => {
                      const canBuyThis = isAdmin || player.id === myPlayer?.id;
                      return (
                        <button
                          key={player.id}
                          onClick={() => canBuyThis && onBuy(selectedCountry.id, player.id, selectedCountry.name)}
                          /* 👇 주의: types.ts에서 gold를 mineral로 안 바꿨다면 여기를 player.gold로 두셔야 에러가 안 납니다! */
                          disabled={!canBuyThis || player.gold < (COUNTRY_PRICES[selectedCountry.name] || DEFAULT_COUNTRY_PRICE)}
                          className={cn(
                            "py-4 px-2 rounded-2xl border transition-all",
                            canBuyThis
                              ? "hover:shadow-md hover:scale-[1.05] disabled:opacity-30"
                              : "opacity-20 cursor-not-allowed"
                          )}
                          style={{ borderColor: `${player.color}44`, backgroundColor: `${player.color}05`, color: player.color }}
                        >
                          <div className="text-[10px] font-black uppercase tracking-tight">{player.name}</div>
                          <div className="text-[9px] font-bold opacity-60">
                            {canBuyThis ? 'SELECT' : 'LOCKED'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
