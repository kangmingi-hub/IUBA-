import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Shield, Swords, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface CountryDefense {
  country_id: string;
  country_name: string;
  owner_id: string;
  defense_power: number;
}

interface AttackSchedule {
  target_country_id: string;
  attack_power: number;
}

interface Props {
  players: { id: string; name: string; color: string }[];
  countries: Record<string, { id: string; name: string; ownerId: string; buildings: number }>;
}

export default function DefensePanel({ players, countries }: Props) {
  const [defenses, setDefenses] = useState<CountryDefense[]>([]);
  const [schedules, setSchedules] = useState<AttackSchedule[]>([]);

  const fetchDefenses = async () => {
    const { data } = await supabase
      .from('country_defenses')
      .select('*')
      .order('defense_power', { ascending: false });
    if (data) setDefenses(data);
  };

  const fetchSchedules = async () => {
    const { data } = await supabase
      .from('attack_schedules')
      .select('target_country_id, attack_power')
      .eq('status', 'scheduled');
    if (data) setSchedules(data);
  };

  useEffect(() => {
    fetchDefenses();
    fetchSchedules();

    const channel = supabase
      .channel('defense_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'country_defenses' }, fetchDefenses)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attack_schedules' }, fetchSchedules)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const getOwnerName = (ownerId: string) => players.find(p => p.id === ownerId)?.name || '알 수 없음';
  const getOwnerColor = (ownerId: string) => players.find(p => p.id === ownerId)?.color || '#666';

  const getAttackPower = (countryId: string) => {
    return schedules.find(s => s.target_country_id === countryId)?.attack_power || null;
  };

  const getDefenseStatus = (defensePower: number, attackPower: number | null) => {
    if (!attackPower) return 'safe';
    if (defensePower >= attackPower) return 'defended';
    return 'danger';
  };

  const statusColors = {
    safe: { bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)', text: 'text-blue-400' },
    defended: { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)', text: 'text-green-400' },
    danger: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', text: 'text-red-400' },
  };

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
        <Shield className="w-5 h-5 text-blue-400" />
        <h2 className="text-sm font-bold text-white tracking-wide">나라별 방어력 현황</h2>
        <span className="ml-auto text-[10px] text-slate-400 uppercase font-bold tracking-widest">
          {defenses.length}개 나라
        </span>
      </div>

      {/* 방어력 목록 */}
      <div className="p-4 space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
        {defenses.length === 0 && (
          <p className="text-center text-slate-500 text-sm py-8">방어력이 등록된 나라가 없습니다</p>
        )}
        {defenses.map((defense, idx) => {
          const attackPower = getAttackPower(defense.country_id);
          const status = getDefenseStatus(defense.defense_power, attackPower);
          const colors = statusColors[status];
          const defensePercent = attackPower
            ? Math.min((defense.defense_power / attackPower) * 100, 100)
            : 100;

          return (
            <motion.div
              key={defense.country_id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="rounded-xl px-4 py-3"
              style={{
                background: colors.bg,
                border: `1px solid ${colors.border}`,
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                {/* 나라 이름 + 소유자 */}
                <div className="flex-1">
                  <p className="text-white font-bold text-sm">{defense.country_name}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: getOwnerColor(defense.owner_id) }}>
                    {getOwnerName(defense.owner_id)}
                  </p>
                </div>

                {/* 방어력 수치 */}
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-400" />
                  <span className={`font-black text-lg ${colors.text}`}>
                    {defense.defense_power}
                  </span>

                  {/* 공격 예정이면 vs 표시 */}
                  {attackPower && (
                    <>
                      <span className="text-slate-500 font-bold">vs</span>
                      <Swords className="w-4 h-4 text-red-400" />
                      <span className="font-black text-lg text-red-400">{attackPower}</span>
                    </>
                  )}
                </div>

                {/* 상태 뱃지 */}
                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${colors.text}`}
                  style={{ background: colors.bg }}>
                  {status === 'safe' && '안전'}
                  {status === 'defended' && '방어가능'}
                  {status === 'danger' && '위험!'}
                </span>
              </div>

              {/* 방어력 게이지 (공격 예정인 경우만) */}
              {attackPower && (
                <div className="h-1.5 rounded-full overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.1)' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${defensePercent}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="h-full rounded-full"
                    style={{
                      background: status === 'danger'
                        ? 'linear-gradient(90deg, #ef4444, #f97316)'
                        : 'linear-gradient(90deg, #3b82f6, #22c55e)',
                    }}
                  />
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* 하단 안내 */}
      <div className="px-6 py-3 border-t border-white/10 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-slate-400" />
        <p className="text-[10px] text-slate-400">
          전도 1점 = 방어력 5점 · 발표 1점 = 방어력 10점
        </p>
      </div>
    </motion.div>
  );
}
