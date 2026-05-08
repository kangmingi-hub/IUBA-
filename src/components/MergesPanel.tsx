import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Trash2, Plus } from 'lucide-react';
import { Player } from '../types';

interface MergeGroup {
  id: string;
  display_name: string;
  team_names: string[];
  image_url?: string;
}

interface Props {
  players: Player[];
  mergeGroups: MergeGroup[];
  onAdd: (displayName: string, teamNames: string[], imageUrl?: string) => void;
  onDelete: (id: string) => void;
}

export default function MergesPanel({ players, mergeGroups, onAdd, onDelete }: Props) {
  const [displayName, setDisplayName] = useState('');
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState('');

  const mergedTeamNames = new Set(mergeGroups.flatMap(g => g.team_names));
  const availablePlayers = players.filter(p => !mergedTeamNames.has(p.name));

  const toggleTeam = (name: string) => {
    setSelectedTeams(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const handleSubmit = () => {
    if (!displayName.trim() || selectedTeams.length < 2) {
      alert('이름을 입력하고 팀을 2개 이상 선택해주세요!');
      return;
    }
    onAdd(displayName, selectedTeams, imageUrl || undefined);
    setDisplayName('');
    setSelectedTeams([]);
    setImageUrl('');
  };

  return (
    <motion.div
      key="merges"
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
      <div className="flex justify-between items-center px-6 py-4 border-b border-white/30">
        <h2 className="text-sm font-bold text-slate-700 tracking-wide">연합 관리 시스템</h2>
      </div>

      <div className="p-8 space-y-8">
        {/* 새 연합 만들기 */}
        <div className="max-w-md mx-auto space-y-4">
          <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest text-center">새 연합 만들기</p>
          
          <div>
            <label className="block text-[9px] font-bold text-slate-400 mb-2 uppercase tracking-widest ml-1">연합 이름</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="예: 만나"
              className="w-full rounded-xl px-6 py-4 text-lg font-bold focus:ring-4 focus:ring-blue-400/20 outline-none transition-all text-slate-700 placeholder:text-slate-300"
              style={{
                background: 'rgba(255,255,255,0.55)',
                border: '1px solid rgba(255,255,255,0.75)',
              }}
            />
          </div>

          <div>
            <label className="block text-[9px] font-bold text-slate-400 mb-2 uppercase tracking-widest ml-1">이미지 URL (선택)</label>
            <input
              type="text"
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              placeholder="/clubs/manna.png"
              className="w-full rounded-xl px-6 py-4 text-sm font-bold focus:ring-4 focus:ring-blue-400/20 outline-none transition-all text-slate-700 placeholder:text-slate-300"
              style={{
                background: 'rgba(255,255,255,0.55)',
                border: '1px solid rgba(255,255,255,0.75)',
              }}
            />
          </div>

          <div>
            <label className="block text-[9px] font-bold text-slate-400 mb-2 uppercase tracking-widest ml-1">팀 선택 (2개 이상)</label>
            <div className="flex flex-wrap gap-2">
              {availablePlayers.map(p => (
                <button
                  key={p.id}
                  onClick={() => toggleTeam(p.name)}
                  className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
                  style={{
                    background: selectedTeams.includes(p.name) ? p.color : 'rgba(255,255,255,0.55)',
                    color: selectedTeams.includes(p.name) ? 'white' : '#64748b',
                    border: `2px solid ${p.color}`,
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSubmit}
            className="w-full bg-blue-500 hover:bg-blue-400 py-4 rounded-xl font-black text-white shadow-lg shadow-blue-400/20 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-sm"
          >
            <Plus className="w-5 h-5" /> 연합 만들기
          </button>
        </div>

        {/* 기존 연합 목록 */}
        <div className="pt-8" style={{ borderTop: '1px solid rgba(255,255,255,0.5)' }}>
          <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest text-center mb-6">등록된 연합 ({mergeGroups.length})</p>
          <div className="space-y-3">
            {mergeGroups.map(group => (
              <div
                key={group.id}
                className="p-4 rounded-2xl flex items-center justify-between"
                style={{
                  background: 'rgba(255,255,255,0.55)',
                  border: '1px solid rgba(255,255,255,0.75)',
                }}
              >
                <div className="flex items-center gap-4">
                  {group.image_url && (
                    <img src={group.image_url} className="w-10 h-10 rounded-full object-cover" />
                  )}
                  <div>
                    <p className="text-sm font-black text-slate-700">{group.display_name}</p>
                    <p className="text-xs text-slate-400">{group.team_names.join(', ')}</p>
                  </div>
                </div>
                <button
                  onClick={() => onDelete(group.id)}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50/70 rounded-lg transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
