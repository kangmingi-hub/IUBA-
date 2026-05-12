import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Swords, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AttackSchedule {
  id: string;
  attack_time: string;
  attack_power: number;
  target_country_id: string;
  target_country_name: string;
  target_owner_id: string;
  status: string;
}

interface Props {
  players: { id: string; name: string; color: string }[];
}

export default function AttackWarning({ players }: Props) {
  const [schedules, setSchedules] = useState<AttackSchedule[]>([]);
  const [now, setNow] = useState(Date.now());

  // 1초마다 현재 시간 업데이트
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // 공격 일정 불러오기 + 실시간 구독
  useEffect(() => {
    const fetchSchedules = async () => {
      const { data } = await supabase
        .from('attack_schedules')
        .select('*')
        .eq('status', 'scheduled')
        .order('attack_time', { ascending: true });
      if (data) setSchedules(data);
    };

    fetchSchedules();

    const channel = supabase
      .channel('attack_schedules_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attack_schedules' }, () => {
        fetchSchedules();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const formatCountdown = (attackTime: string) => {
    const diff = new Date(attackTime).getTime() - now;
    if (diff <= 0) return '곧 공격!';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const getOwnerName = (ownerId: string) => {
    return players.find(p => p.id === ownerId)?.name || '알 수 없음';
  };

  const getOwnerColor = (ownerId: string) => {
    return players.find(p => p.id === ownerId)?.color || '#666';
  };

  const isUrgent = (attackTime: string) => {
    const diff = new Date(attackTime).getTime() - now;
    return diff < 60 * 60 * 1000; // 1시간 미만이면 긴급
  };

  if (schedules.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="max-w-7xl mx-auto mb-4 space-y-2"
      >
        {schedules.map((schedule) => {
          const urgent = isUrgent(schedule.attack_time);
          return (
            <motion.div
              key={schedule.id}
              animate={urgent ? {
                boxShadow: [
                  '0 0 0px rgba(239,68,68,0)',
                  '0 0 20px rgba(239,68,68,0.5)',
                  '0 0 0px rgba(239,68,68,0)',
                ]
              } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="rounded-2xl overflow-hidden"
              style={{
                background: urgent
                  ? 'rgba(239,68,68,0.15)'
                  : 'rgba(251,146,60,0.1)',
                backdropFilter: 'blur(28px)',
                WebkitBackdropFilter: 'blur(28px)',
                border: urgent
                  ? '1px solid rgba(239,68,68,0.5)'
                  : '1px solid rgba(251,146,60,0.4)',
              }}
            >
              <div className="px-6 py-4 flex flex-col md:flex-row items-center gap-4">
                {/* 아이콘 + 경고 텍스트 */}
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={{ rotate: urgent ? [0, -10, 10, -10, 10, 0] : 0 }}
                    transition={{ duration: 0.5, repeat: urgent ? Infinity : 0, repeatDelay: 1 }}
                  >
                    {urgent
                      ? <Swords className="w-8 h-8 text-red-400" />
                      : <AlertTriangle className="w-8 h-8 text-orange-400" />
                    }
                  </motion.div>
                  <div>
                    <p className={`text-[10px] font-extrabold uppercase tracking-widest ${urgent ? 'text-red-400' : 'text-orange-400'}`}>
                      {urgent ? '⚠️ 긴급 공격 경보!' : '공격 예고'}
                    </p>
                    <p className="text-white font-bold text-sm">
                      <span style={{ color: getOwnerColor(schedule.target_owner_id) }}>
                        {getOwnerName(schedule.target_owner_id)}
                      </span>
                      의 <span className="text-white font-black">{schedule.target_country_name}</span>이(가) 공격받습니다!
                    </p>
                  </div>
                </div>

                {/* 공격력 */}
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl"
                  style={{ background: 'rgba(0,0,0,0.2)' }}>
                  <Swords className="w-4 h-4 text-red-400" />
                  <span className="text-[10px] text-slate-400 uppercase font-bold">공격력</span>
                  <span className="text-red-400 font-black text-lg">{schedule.attack_power}</span>
                </div>

                {/* 방어력 안내 */}
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl"
                  style={{ background: 'rgba(0,0,0,0.2)' }}>
                  <Shield className="w-4 h-4 text-blue-400" />
                  <span className="text-[10px] text-slate-400 uppercase font-bold">방어 필요</span>
                  <span className="text-blue-400 font-black text-lg">{schedule.attack_power}+</span>
                </div>

                {/* 카운트다운 */}
                <div className="ml-auto flex flex-col items-center">
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">
                    공격까지
                  </p>
                  <motion.p
                    key={formatCountdown(schedule.attack_time)}
                    initial={{ opacity: 0.5 }}
                    animate={{ opacity: 1 }}
                    className={`font-mono font-black text-2xl ${urgent ? 'text-red-400' : 'text-orange-400'}`}
                  >
                    {formatCountdown(schedule.attack_time)}
                  </motion.p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </AnimatePresence>
  );
}
