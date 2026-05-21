import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Swords, Shield, Clock, Zap, Trash2, RotateCcw, CheckSquare, Square } from 'lucide-react';
import { supabase } from '../lib/supabase';

const DEFENSE_BUILDING_COST = 50;
const DEFENSE_POWER_PER_BUILDING = 10;

interface AttackSchedule {
  id: string;
  attack_time: string;
  attack_power: number;
  target_country_name: string;
  target_owner_id: string;
  status: string;
}

interface Props {
  players: { id: string; name: string; color: string; gold: number }[];
  countries: Record<string, { id: string; name: string; ownerId: string; buildings: number }>;
}

export default function AttackAdminPanel({ players, countries }: Props) {
  const [schedules, setSchedules] = useState<AttackSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [defenses, setDefenses] = useState<{ country_id: string; defense_buildings: number; defense_power: number }[]>([]);
  const [now, setNow] = useState(Date.now());
  const [scheduledTime, setScheduledTime] = useState<string>(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 10);
    return now.toISOString().slice(0, 16);
  });

  // ✅ 새로 추가: 선택된 나라들
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  // ✅ 새로 추가: 각 나라별 공격력 (key: country.id)
  const [attackPowers, setAttackPowers] = useState<Record<string, number>>({});

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchSchedules = async () => {
    const { data } = await supabase
      .from('attack_schedules')
      .select('*')
      .order('attack_time', { ascending: true });
    if (data) setSchedules(data);
  };

  const fetchDefenses = async () => {
    const { data } = await supabase.from('country_defenses').select('*');
    if (data) setDefenses(data);
  };

  useEffect(() => {
    fetchSchedules();
    fetchDefenses();
    const channel = supabase
      .channel('attack_admin_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attack_schedules' }, fetchSchedules)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // ✅ 점령된 나라만 필터링
  const occupiedCountries = Object.values(countries).filter(c => c.ownerId);

  // ✅ 나라 선택/해제 토글
  const toggleCountry = (countryId: string) => {
    setSelectedCountries(prev => {
      if (prev.includes(countryId)) {
        return prev.filter(id => id !== countryId);
      } else {
        // 새로 선택할 때 공격력 기본값 랜덤 설정
        setAttackPowers(p => ({
          ...p,
          [countryId]: Math.floor(Math.random() * 61) + 20
        }));
        return [...prev, countryId];
      }
    });
  };

  // ✅ 선택된 나라들로 공격 예약
  const triggerAttack = async () => {
    if (selectedCountries.length === 0) {
      alert('공격할 나라를 선택해주세요!');
      return;
    }
    setIsLoading(true);
    try {
      const attackTime = new Date(scheduledTime).toISOString();

      const inserts = selectedCountries.map(countryId => {
        const country = countries[countryId] || occupiedCountries.find(c => c.id === countryId);
        return {
          attack_time: attackTime,
          attack_power: attackPowers[countryId] ?? Math.floor(Math.random() * 61) + 20,
          target_country_id: country?.id ?? countryId,
          target_country_name: country?.name ?? '',
          target_owner_id: country?.ownerId ?? '',
          status: 'scheduled'
        };
      });

      await supabase.from('attack_schedules').insert(inserts);

      const summary = inserts.map(i => `${i.target_country_name} (공격력: ${i.attack_power})`).join('\n');
      alert(`⚔️ 공격 예약 완료! ${new Date(scheduledTime).toLocaleString('ko-KR')}\n\n${summary}`);

      setSelectedCountries([]);
      setAttackPowers({});
      fetchSchedules();
    } catch (err) {
      alert('오류: ' + err);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ 즉시 공격 (선택된 나라로)
  const triggerImmediateAttack = async () => {
    if (selectedCountries.length === 0) {
      alert('공격할 나라를 선택해주세요!');
      return;
    }
    setIsLoading(true);
    try {
      const inserts = selectedCountries.map(countryId => {
        const country = countries[countryId] || occupiedCountries.find(c => c.id === countryId);
        return {
          attack_time: new Date(Date.now() - 1000).toISOString(),
          attack_power: attackPowers[countryId] ?? Math.floor(Math.random() * 61) + 20,
          target_country_id: country?.id ?? countryId,
          target_country_name: country?.name ?? '',
          target_owner_id: country?.ownerId ?? '',
          status: 'scheduled'
        };
      });

      await supabase.from('attack_schedules').insert(inserts);

      const summary = inserts.map(i => `${i.target_country_name} (공격력: ${i.attack_power})`).join('\n');
      alert(`⚔️ 즉시 공격 발동!\n\n${summary}`);

      setSelectedCountries([]);
      setAttackPowers({});
    } catch (err) {
      alert('오류: ' + err);
    } finally {
      setIsLoading(false);
    }
  };

  const cancelSchedule = async (id: string) => {
    if (!window.confirm('이 공격 일정을 취소하시겠습니까?')) return;
    await supabase.from('attack_schedules').update({ status: 'cancelled' }).eq('id', id);
    fetchSchedules();
  };

  const formatCountdown = (attackTime: string) => {
    const diff = new Date(attackTime).getTime() - now;
    if (diff <= 0) return '실행중...';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const resetDefenseData = async () => {
    if (!window.confirm('디펜스 데이터를 모두 초기화하시겠습니까?\n(공격 일정, 공격 결과, 방어력 전부 삭제)')) return;
    await supabase.from('attack_schedules').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('attack_results').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('country_defenses').delete().neq('country_id', '');
    alert('디펜스 데이터가 초기화되었습니다!');
    fetchSchedules();
    fetchDefenses();
  };

  const getOwnerName = (ownerId: string) => players.find(p => p.id === ownerId)?.name || '알 수 없음';
  const getOwnerColor = (ownerId: string) => players.find(p => p.id === ownerId)?.color || '#666';

  const activeSchedules = schedules.filter(s => s.status === 'scheduled');
  const completedSchedules = schedules.filter(s => s.status === 'completed').slice(0, 5);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.05)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10">
        <Swords className="w-5 h-5 text-red-400" />
        <h2 className="text-sm font-bold text-white tracking-wide">공격 관리</h2>
      </div>

      <div className="p-6 space-y-6">

        {/* ✅ 나라 선택 섹션 */}
        <div>
          <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3">
            공격할 나라 선택 ({selectedCountries.length}개 선택됨)
          </p>

          {occupiedCountries.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">점령된 나라가 없습니다</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {occupiedCountries.map(country => {
                const isSelected = selectedCountries.includes(country.id);
                const ownerColor = getOwnerColor(country.ownerId);
                const ownerName = getOwnerName(country.ownerId);

                return (
                  <div key={country.id}>
                    <div
                      onClick={() => toggleCountry(country.id)}
                      className="rounded-xl px-4 py-3 flex items-center gap-3 cursor-pointer transition-all"
                      style={{
                        background: isSelected
                          ? 'rgba(239,68,68,0.15)'
                          : 'rgba(255,255,255,0.04)',
                        border: isSelected
                          ? '1px solid rgba(239,68,68,0.5)'
                          : '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      {/* 체크박스 아이콘 */}
                      {isSelected
                        ? <CheckSquare className="w-5 h-5 text-red-400 flex-shrink-0" />
                        : <Square className="w-5 h-5 text-slate-500 flex-shrink-0" />
                      }

                      {/* 나라 정보 */}
                      <div className="flex-1">
                        <p className="text-white font-bold text-sm">{country.name}</p>
                        <p className="text-[10px] font-bold" style={{ color: ownerColor }}>
                          {ownerName} 점령중
                        </p>
                      </div>

                      {/* 건물 수 */}
                      <span className="text-[10px] text-slate-500 font-bold">
                        🏛️ {country.buildings ?? 0}
                      </span>
                    </div>

                    {/* ✅ 선택된 경우 공격력 입력 */}
                    {isSelected && (
                      <div className="mt-1 ml-8 flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-bold">공격력:</span>
                        <input
                          type="number"
                          min={1}
                          max={999}
                          value={attackPowers[country.id] ?? 50}
                          onChange={e => setAttackPowers(p => ({
                            ...p,
                            [country.id]: Number(e.target.value)
                          }))}
                          onClick={e => e.stopPropagation()}
                          className="w-20 px-2 py-1 rounded-lg text-sm font-bold text-center"
                          style={{
                            background: 'rgba(255,255,255,0.08)',
                            border: '1px solid rgba(239,68,68,0.4)',
                            color: 'white',
                          }}
                        />
                        <span className="text-[10px] text-slate-500">직접 입력 가능</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 공격 시간 지정 */}
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            공격 시간 지정
          </p>
          <input
            type="datetime-local"
            value={scheduledTime}
            onChange={(e) => setScheduledTime(e.target.value)}
            className="w-full px-4 py-3 rounded-xl font-bold text-sm"
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'white',
              colorScheme: 'dark',
            }}
          />
        </div>

        {/* 예약 공격 버튼 */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={triggerAttack}
          disabled={isLoading || selectedCountries.length === 0}
          className="w-full py-4 rounded-xl font-black text-white flex items-center justify-center gap-3 transition-all disabled:opacity-40"
          style={{
            background: 'linear-gradient(135deg, rgba(239,68,68,0.8), rgba(185,28,28,0.8))',
            border: '1px solid rgba(239,68,68,0.5)',
            boxShadow: '0 4px 20px rgba(239,68,68,0.3)',
          }}
        >
          <Zap className="w-5 h-5" />
          {selectedCountries.length === 0
            ? '나라를 선택해주세요'
            : `${selectedCountries.length}개 나라 공격 예약`
          }
        </motion.button>

        {/* 즉시 공격 버튼 */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={triggerImmediateAttack}
          disabled={isLoading || selectedCountries.length === 0}
          className="w-full py-4 rounded-xl font-black text-white flex items-center justify-center gap-3 transition-all disabled:opacity-40"
          style={{
            background: 'linear-gradient(135deg, rgba(168,85,247,0.8), rgba(109,40,217,0.8))',
            border: '1px solid rgba(168,85,247,0.5)',
            boxShadow: '0 4px 20px rgba(168,85,247,0.3)',
          }}
        >
          <Zap className="w-5 h-5" />
          {selectedCountries.length === 0
            ? '나라를 선택해주세요'
            : `${selectedCountries.length}개 나라 즉시 공격`
          }
        </motion.button>

        {/* 초기화 버튼 */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={resetDefenseData}
          className="w-full py-3 rounded-xl font-bold text-red-400 flex items-center justify-center gap-3 transition-all"
          style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
          }}
        >
          <RotateCcw className="w-4 h-4" />
          디펜스 데이터 초기화
        </motion.button>

        {/* 예정된 공격 목록 */}
        {activeSchedules.length > 0 && (
          <div>
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3">
              예정된 공격 ({activeSchedules.length})
            </p>
            <div className="space-y-2">
              {activeSchedules.map(schedule => (
                <div
                  key={schedule.id}
                  className="rounded-xl px-4 py-3 flex items-center gap-3"
                  style={{
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.3)',
                  }}
                >
                  <div className="flex-1">
                    <p className="text-white font-bold text-sm">{schedule.target_country_name}</p>
                    <p className="text-[10px] font-bold" style={{ color: getOwnerColor(schedule.target_owner_id) }}>
                      {getOwnerName(schedule.target_owner_id)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Swords className="w-3 h-3 text-red-400" />
                    <span className="text-red-400 font-black text-sm">{schedule.attack_power}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-orange-400" />
                    <span className="text-orange-400 font-mono font-bold text-sm">
                      {formatCountdown(schedule.attack_time)}
                    </span>
                  </div>
                  <button
                    onClick={() => cancelSchedule(schedule.id)}
                    className="p-1.5 rounded-lg hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 완료된 공격 기록 */}
        {completedSchedules.length > 0 && (
          <div>
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3">
              최근 공격 기록
            </p>
            <div className="space-y-2">
              {completedSchedules.map(schedule => (
                <div
                  key={schedule.id}
                  className="rounded-xl px-4 py-3 flex items-center gap-3"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <Shield className="w-4 h-4 text-slate-500" />
                  <div className="flex-1">
                    <p className="text-slate-400 font-bold text-sm">{schedule.target_country_name}</p>
                    <p className="text-[10px] text-slate-500">
                      {new Date(schedule.attack_time).toLocaleString('ko-KR')}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">완료</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
