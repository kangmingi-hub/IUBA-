import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Swords, Shield, Clock, Zap, Trash2, RotateCcw } from 'lucide-react';
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
    const channel = supabase
      .channel('attack_admin_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attack_schedules' }, fetchSchedules)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const triggerAttack = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/schedule-attack`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({}),
        }
      );


      
      const data = await res.json();
      if (res.ok) {
        alert(`⚔️ 공격 예약 완료!\n대상: ${data.target}\n공격력: ${data.attackPower}\n공격시간: ${new Date(data.attackTime).toLocaleString('ko-KR')}`);
      } else {
        alert('오류: ' + (data.error || '알 수 없는 오류'));
      }
    } catch (err) {
      alert('요청 실패: ' + err);
    } finally {
      setIsLoading(false);
    }
  };

  const cancelSchedule = async (id: string) => {
    if (!window.confirm('이 공격 일정을 취소하시겠습니까?')) return;
    await supabase
      .from('attack_schedules')
      .update({ status: 'cancelled' })
      .eq('id', id);
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

  const triggerImmediateAttack = async () => {
  setIsLoading(true);
  try {
    const occupiedList = Object.values(countries);
    if (occupiedList.length === 0) { alert('점령된 나라가 없습니다!'); return; }
    const randomCountry = occupiedList[Math.floor(Math.random() * occupiedList.length)];
    const attackPower = Math.floor(Math.random() * 61) + 20;
    const attackTime = new Date(Date.now() - 1000).toISOString(); // 즉시 실행

    await supabase.from('attack_schedules').insert({
      attack_time: attackTime,
      attack_power: attackPower,
      target_country_id: randomCountry.id,
      target_country_name: randomCountry.name,
      target_owner_id: randomCountry.ownerId,
      status: 'scheduled'
    });
    alert(`⚔️ 즉시 공격 발동!\n대상: ${randomCountry.name}\n공격력: ${attackPower}`);
  } catch (err) {
    alert('오류: ' + err);
  } finally {
    setIsLoading(false);
  }
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

  const buyDefenseBuilding = async (countryId: string, ownerId: string, countryName: string) => {
  const player = players.find(p => p.id === ownerId);
  if (!player || player.gold < DEFENSE_BUILDING_COST) {
    alert('미네랄이 부족합니다!');
    return;
  }

  const existing = defenses.find(d => d.country_id === countryId);

  if (existing) {
    await supabase.from('country_defenses').update({
      defense_buildings: existing.defense_buildings + 1,
      defense_power: existing.defense_power + DEFENSE_POWER_PER_BUILDING
    }).eq('country_id', countryId);
  } else {
    await supabase.from('country_defenses').insert({
      country_id: countryId,
      country_name: countryName,
      owner_id: ownerId,
      defense_power: DEFENSE_POWER_PER_BUILDING,
      defense_buildings: 1
    });
  }

  // 미네랄 차감
  await supabase.from('country_purchases').insert({
    country_id: countryId,
    club_name: player.name,
    price_paid: DEFENSE_BUILDING_COST
  });

  alert(`🛡️ ${countryName}에 방어 건물 건축 완료! (미네랄 -${DEFENSE_BUILDING_COST})`);
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
        {/* 공격 발동 버튼 */}
        <div>
          <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3">
            새 공격 예약
          </p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={triggerAttack}
            disabled={isLoading}
            className="w-full py-4 rounded-xl font-black text-white flex items-center justify-center gap-3 transition-all disabled:opacity-50"
            style={{
              background: isLoading
                ? 'rgba(239,68,68,0.3)'
                : 'linear-gradient(135deg, rgba(239,68,68,0.8), rgba(185,28,28,0.8))',
              border: '1px solid rgba(239,68,68,0.5)',
              boxShadow: '0 4px 20px rgba(239,68,68,0.3)',
            }}
          >
            {isLoading ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                />
                공격 예약 중...
              </>
            ) : (
              <>
                <Zap className="w-5 h-5" />
                랜덤 공격 예약 (5시간 후)
              </>
            )}
          </motion.button>

          {/* 즉시 공격 버튼 */}
<motion.button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
  onClick={triggerImmediateAttack}
  disabled={isLoading}
  className="w-full py-4 rounded-xl font-black text-white flex items-center justify-center gap-3 transition-all disabled:opacity-50"
  style={{
    background: 'linear-gradient(135deg, rgba(168,85,247,0.8), rgba(109,40,217,0.8))',
    border: '1px solid rgba(168,85,247,0.5)',
    boxShadow: '0 4px 20px rgba(168,85,247,0.3)',
  }}
>
  <Zap className="w-5 h-5" />
  즉시 공격 발동 (테스트용)
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
          
          <p className="mt-2 text-[10px] text-slate-500 text-center">
            점령된 나라 중 랜덤으로 선택 · 공격력 20~80 랜덤
          </p>
        </div>

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
