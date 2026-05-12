import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';

interface AttackEvent {
  id: string;
  country_name: string;
  owner_id: string;
  defense_power: number;
  attack_power: number;
  result: 'defended' | 'conquered';
  created_at: string;
}

interface Props {
  players: { id: string; name: string; color: string }[];
}

// 폭발 파티클
function Particle({ x, y, color }: { x: number; y: number; color: string }) {
  const angle = Math.random() * 360;
  const distance = 40 + Math.random() * 80;
  const size = 3 + Math.random() * 6;
  const tx = Math.cos((angle * Math.PI) / 180) * distance;
  const ty = Math.sin((angle * Math.PI) / 180) * distance;

  return (
    <motion.div
      initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
      animate={{ x: tx, y: ty, opacity: 0, scale: 0 }}
      transition={{ duration: 0.8 + Math.random() * 0.4, ease: 'easeOut' }}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        pointerEvents: 'none',
      }}
    />
  );
}

export default function AttackAnimation({ players }: Props) {
  const [events, setEvents] = useState<AttackEvent[]>([]);

// 수정 - 마운트 시 한 번만 구독
useEffect(() => {
  const shownIds = new Set<string>();

  const channel = supabase
    .channel('attack_results_realtime')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'attack_results'
    }, (payload) => {
      const newEvent = payload.new as AttackEvent;
      if (!shownIds.has(newEvent.id)) {
        shownIds.add(newEvent.id);
        setEvents(prev => [...prev, newEvent]);

        // 30초 후 처리
        setTimeout(async () => {
          // conquered면 지도에 반영
          if (newEvent.result === 'conquered') {
            await supabase.from('country_occupations')
              .update({ is_destroyed: true })
              .eq('country_id', newEvent.country_id);
          }
          // 애니메이션 제거
          setEvents(prev => prev.filter(e => e.id !== newEvent.id));
        }, 30000);  // ← 30초
      }
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, []);

  const getOwnerName = (ownerId: string) => players.find(p => p.id === ownerId)?.name || '알 수 없음';
  const getOwnerColor = (ownerId: string) => players.find(p => p.id === ownerId)?.color || '#666';

  // 파티클 위치 (화면 중앙)
  const particles = Array.from({ length: 20 });

  return (
    <AnimatePresence>
      {events.map((event) => (
        <motion.div
          key={event.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* 배경 플래시 */}
          <motion.div
            initial={{ opacity: 0.8 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            style={{
              position: 'absolute',
              inset: 0,
              background: event.result === 'conquered'
                ? 'radial-gradient(circle at center, rgba(239,68,68,0.4) 0%, transparent 70%)'
                : 'radial-gradient(circle at center, rgba(34,197,94,0.4) 0%, transparent 70%)',
            }}
          />

          {/* 번쩍임 효과 */}
          <motion.div
            animate={{
              opacity: [0, 1, 0, 1, 0, 1, 0],
              scale: [1, 1.05, 1, 1.05, 1, 1.02, 1],
            }}
            transition={{ duration: 0.6, times: [0, 0.1, 0.2, 0.3, 0.4, 0.6, 1] }}
            style={{
              position: 'absolute',
              inset: 0,
              background: event.result === 'conquered'
                ? 'rgba(239,68,68,0.15)'
                : 'rgba(34,197,94,0.15)',
              borderRadius: '16px',
            }}
          />

          {/* 파티클 폭발 */}
          <div style={{ position: 'absolute', left: '50%', top: '40%' }}>
            {particles.map((_, i) => (
              <Particle
                key={i}
                x={0}
                y={0}
                color={event.result === 'conquered'
                  ? `hsl(${Math.random() * 30}, 100%, 60%)`
                  : `hsl(${120 + Math.random() * 40}, 100%, 60%)`
                }
              />
            ))}
          </div>

          {/* 결과 카드 */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: -20 }}
            transition={{ type: 'spring', damping: 15, stiffness: 300 }}
            style={{
              background: event.result === 'conquered'
                ? 'linear-gradient(135deg, rgba(239,68,68,0.95), rgba(185,28,28,0.95))'
                : 'linear-gradient(135deg, rgba(34,197,94,0.95), rgba(21,128,61,0.95))',
              backdropFilter: 'blur(20px)',
              border: `2px solid ${event.result === 'conquered' ? 'rgba(239,68,68,0.8)' : 'rgba(34,197,94,0.8)'}`,
              borderRadius: '24px',
              padding: '2rem 3rem',
              textAlign: 'center',
              boxShadow: event.result === 'conquered'
                ? '0 0 60px rgba(239,68,68,0.5), 0 20px 40px rgba(0,0,0,0.4)'
                : '0 0 60px rgba(34,197,94,0.5), 0 20px 40px rgba(0,0,0,0.4)',
              minWidth: '320px',
              position: 'relative',
              zIndex: 10,
            }}
          >
            {/* 이모지 */}
            <motion.div
              animate={{ rotate: event.result === 'conquered' ? [0, -10, 10, -10, 10, 0] : [0, -5, 5, -5, 5, 0] }}
              transition={{ duration: 0.5, delay: 0.3 }}
              style={{ fontSize: '4rem', marginBottom: '0.5rem' }}
            >
              {event.result === 'conquered' ? '💥' : '🛡️'}
            </motion.div>

            {/* 결과 텍스트 */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              style={{
                fontSize: '1.5rem',
                fontWeight: 900,
                color: 'white',
                marginBottom: '0.5rem',
                textShadow: '0 2px 4px rgba(0,0,0,0.3)',
              }}
            >
              {event.result === 'conquered' ? '점령 실패!' : '방어 성공!'}
            </motion.p>

            {/* 나라 이름 */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                color: 'rgba(255,255,255,0.9)',
                marginBottom: '0.25rem',
              }}
            >
              {event.country_name}
            </motion.p>

            {/* 소유자 */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: getOwnerColor(event.owner_id),
                marginBottom: '1rem',
              }}
            >
              {getOwnerName(event.owner_id)}
            </motion.p>

            {/* 방어력 vs 공격력 */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1rem',
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '12px',
                padding: '0.75rem 1.5rem',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>방어력</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 900, color: '#60a5fa' }}>{event.defense_power}</p>
              </div>
              <p style={{ fontSize: '1.25rem', fontWeight: 900, color: 'rgba(255,255,255,0.5)' }}>vs</p>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>공격력</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f87171' }}>{event.attack_power}</p>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
