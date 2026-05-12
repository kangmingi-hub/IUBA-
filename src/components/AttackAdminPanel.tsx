import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Swords, Shield, Clock, Zap, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AttackSchedule {
  id: string;
  attack_time: string;
  attack_power: number;
  target_country_name: string;
  target_owner_id: string;
  status: string;
}

interface Props {
  players: { id: string; name: string; color: string }[];
}

export default function AttackAdminPanel({ players }: Props) {
  const [schedules, setSchedules] = useState<AttackSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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
