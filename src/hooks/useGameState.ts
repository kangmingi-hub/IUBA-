import { useState, useEffect } from 'react';
import { Player, CountryState, GameState, GameLog, User, TEAM_COLORS } from '../types';
import { INITIAL_TEAMS, COUNTRY_PRICES, DEFAULT_COUNTRY_PRICE, BUILDING_TIERS, CHARACTER_SEEDS, getBuildingTiers } from '../constants';
import { supabase } from '../lib/supabase';
import { TEAM_ALIASES } from '../constants';

const STORAGE_KEY = 'kingdom_conquerors_save';
const AUTH_KEY = 'kingdom_conquerors_auth';

export function useGameState() {
  const [gameState, setGameState] = useState<GameState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : null;
    return {
      players: (parsed?.players || INITIAL_TEAMS).filter((p: any) =>
        p && p.name && p.id &&
        !['A to Z', 'TOY', 'Blossom', 'Evergreen', 'The First', 'Perlfect', 'EBS', 'YITC', 'BPM'].includes(p.name) &&
        !/^team-\d+$/.test(p.id) &&
        !/^\d+팀$/.test(p.name)
      ),
      countries: {},
      logs: parsed?.logs || [{
        id: 'start',
        timestamp: Date.now(),
        message: '새로운 선교 원정이 시작되었습니다!',
        type: 'purchase' as any
      }],
      users: (parsed?.users || [{ id: 'admin-1', username: 'admin', role: 'admin' }]).filter((u: any) => u && u.id && u.username)
    };
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(AUTH_KEY);
    return saved ? JSON.parse(saved) : null;
  });

  const [clubPoints, setClubPoints] = useState<{
    club_name: string;
    remaining_evangelism_points: number;
    remaining_speech_points: number;
  }[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [startDate, setStartDate] = useState<string>('2026-01-01');
  const [isDateLoaded, setIsDateLoaded] = useState(false);

  // startDate를 Supabase에서 불러오기
  useEffect(() => {
    const fetchStartDate = async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'start_date')
        .single();
      if (!error && data) {
        setStartDate(data.value);
      }
      setIsDateLoaded(true);
    };
    fetchStartDate();
  }, []);

  // 날짜 변경시 Supabase에 저장
  const handleStartDateChange = async (date: string) => {
    setStartDate(date);
    localStorage.setItem('start_date', date);
    const { data, error } = await supabase
      .from('app_settings')
      .upsert({ key: 'start_date', value: date })
      .select();
    console.log('저장 결과:', data, error);
    alert('저장 결과: ' + JSON.stringify({ data, error }));
  };

  const fetchOccupations = async () => {
    try {
      const { data, error } = await supabase.from('country_occupations').select('*');
      if (error) throw error;
      if (data) {
        const countries: Record<string, CountryState> = {};
        (data as any[]).forEach(row => {
          countries[row.country_id] = {
            id: row.country_id,
            name: row.country_name,
            ownerId: row.owner_id,
            buildings: row.buildings || 0
          };
        });
        setGameState(prev => ({ ...prev, countries }));
      }
    } catch (err) {
      console.error('점령 현황 불러오기 오류:', err);
    }
  };

 const fetchUsers = async () => {
  const { data, error } = await supabase.from('users').select('*');
  if (error) { console.error('users 불러오기 오류:', error); return; }
  if (data) {
    setGameState(prev => ({
      ...prev,
      users: data,
      players: prev.players.map(p => {
        const user = data.find((u: any) => u.username === p.name);
        return user?.color ? { ...p, color: user.color } : p;
      })
    }));
  }
};

  const fetchClubPoints = async (date?: string) => {
    setIsSyncing(true);
    const targetDate = date || startDate;
    try {
      const { data, error } = await supabase
        .rpc('get_team_points_from_date', { start_date: targetDate });

      if (error) throw error;
      if (data) {
        const MERGE_GROUPS = [
            { newName: 'EVERGREEN+BPM+MARE', teams: ['Evergreen', 'BPM', 'MARE'] },
            { newName: 'A to Z+YITC', teams: ['A to Z', 'YITC'] },
          ];
        const mergedTeamNames = new Set(MERGE_GROUPS.flatMap(g => g.teams));
        const mergedData: any[] = [];
        MERGE_GROUPS.forEach(group => {
          const groupTeams = (data as any[]).filter(d => group.teams.includes(d.club_name));
          if (groupTeams.length > 0) {
            mergedData.push({
              club_name: group.newName,
              remaining_evangelism_points: groupTeams.reduce((sum, t) => sum + t.remaining_evangelism_points, 0),
              remaining_speech_points: groupTeams.reduce((sum, t) => sum + t.remaining_speech_points, 0),
            });
          }
        });
        const finalData = [
          ...(data as any[]).filter(d => !mergedTeamNames.has(d.club_name)),
          ...mergedData,
        ];

        setClubPoints(finalData);
        setGameState(prev => {
          const playersMap = new Map<string, Player>(prev.players.map(p => [p.name, p]));
          const updatedPlayers = finalData.filter((club) => club && club.club_name).map((club, idx) => {
            const existing = playersMap.get(club.club_name);
            if (existing) {
              return { ...existing, gold: club.remaining_evangelism_points, buildingPower: club.remaining_speech_points } as Player;
            }
            return {
              id: `club-${club.club_name.replace(/\s+/g, '-').toLowerCase()}`,
              name: club.club_name,
              color: existing?.color || TEAM_COLORS[idx % TEAM_COLORS.length],
              characterUrl: `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${club.club_name}`,
              gold: club.remaining_evangelism_points,
              buildingPower: club.remaining_speech_points
            } as Player;
          });
          return { ...prev, players: updatedPlayers };
        });
      }
    } catch (err) {
      console.error('Supabase fetch error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

useEffect(() => {
  if (!isDateLoaded) return;
  
  const init = async () => {
    await fetchUsers();
    await fetchClubPoints(startDate);
    fetchOccupations();
  };
  init();

    const channel = supabase
      .channel('realtime_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'country_occupations' }, () => { fetchOccupations(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => { fetchUsers(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, (payload: any) => {
        if (payload.new?.key === 'start_date') setStartDate(payload.new.value);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'country_purchases' }, () => { fetchClubPoints(startDate); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'building_purchases' }, () => { fetchClubPoints(startDate); })
      // ✅ 추가: records 변경도 감지 → 어드민 점수 입력 실시간 반영
      .on('postgres_changes', { event: '*', schema: 'public', table: 'records' }, () => { fetchClubPoints(startDate); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [startDate, isDateLoaded]);

  useEffect(() => {
    const { countries, ...rest } = gameState;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  }, [gameState]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(AUTH_KEY, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(AUTH_KEY);
    }
  }, [currentUser]);

  const addLog = (message: string, type: GameLog['type']) => {
    const newLog: GameLog = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      message,
      type
    };
    setGameState(prev => ({
      ...prev,
      logs: [newLog, ...prev.logs].slice(0, 50)
    }));
  };

  const handleLogin = (username: string, password: string) => {
    if (!username.trim()) return false;

    const user = gameState.users.find(u => u.username === username);
    if (user) {
      const pw = user.password || '1234';
      if (pw !== password) return false;
      setCurrentUser(user);
      return true;
    }

    const resolvedName = TEAM_ALIASES[username] || username;
    const player = gameState.players.find(p => p.name === resolvedName);
    if (player) {
      const userRecord = gameState.users.find(u => u.id === player.id);
      const pw = userRecord?.password || '1234';
      if (pw !== password) return false;

      if (!userRecord) {
        const newUser = { id: player.id, username: resolvedName, role: 'member' as const, password: '1234' };
        supabase.from('users').upsert(newUser);
        setGameState(prev => ({ ...prev, users: [...prev.users, newUser] }));
      }

      setCurrentUser({ id: player.id, username: username, role: 'member' });
      return true;
    }
    return false;
  };

  const handleLogout = () => setCurrentUser(null);

  // ✅ 수정: Supabase INSERT → 다른 기기 실시간 반영
  const handleAddMember = async (name: string) => {
    if (!name) return;
    const playerId = Math.random().toString(36).substr(2, 9);
    const newUser: User = { id: playerId, username: name, role: 'member' };
    const newPlayer: Player = {
      id: playerId,
      name,
      color: TEAM_COLORS[gameState.players.length % TEAM_COLORS.length],
      characterUrl: `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${CHARACTER_SEEDS[gameState.players.length % CHARACTER_SEEDS.length]}`,
      gold: 0,
      buildingPower: 0
    };
    await supabase.from('users').insert(newUser);
    setGameState(prev => ({ ...prev, users: [...prev.users, newUser], players: [...prev.players, newPlayer] }));
  };

  // ✅ 수정: Supabase DELETE → 다른 기기 실시간 반영
  const handleDeleteMember = async (playerId: string) => {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return;
    await supabase.from('users').delete().eq('id', playerId);
    setGameState(prev => {
      const updatedCountries = { ...prev.countries };
      Object.keys(updatedCountries).forEach(id => {
        if (updatedCountries[id].ownerId === playerId) delete updatedCountries[id];
      });
      return {
        ...prev,
        users: prev.users.filter(u => u.id !== playerId),
        players: prev.players.filter(p => p.id !== playerId),
        countries: updatedCountries
      };
    });
    addLog(`${player.name} 대원이 삭제되었습니다.`, 'purchase' as any);
  };

  const handleChangePassword = async (userId: string, oldPassword: string, newPassword: string) => {
    const user = gameState.users.find(u => u.id === userId);
    const pw = user?.password || '1234';
    if (pw !== oldPassword) {
      alert('현재 비밀번호가 틀렸습니다.');
      return false;
    }
    const { error } = await supabase
      .from('users')
      .upsert({ id: userId, username: currentUser!.username, role: currentUser!.role, password: newPassword });
    if (error) {
      alert('저장 오류: ' + error.message);
      return false;
    }
    setGameState(prev => ({
      ...prev,
      users: prev.users.map(u => u.id === userId ? { ...u, password: newPassword } : u)
    }));
    alert('비밀번호가 변경되었습니다!');
    return true;
  };

  // ✅ 수정: records 테이블에 INSERT → 다른 기기 실시간 점수 반영
  const handleAdminSubmit = async (playerId: string, value: number, type: 'evangelism' | 'speech') => {
    if (value <= 0 || !playerId) return;
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return;

    const recordId = Math.random().toString(36).substr(2, 9);
    const recordType = type === 'evangelism' ? 'SIMPLE_EVANGELISM' : 'PRESENTATION';

    await supabase.from('records').insert({
      id: recordId,
      data: {
        id: recordId,
        club: player.name,
        date: new Date().toISOString().split('T')[0],
        type: recordType,
        value: value,
        note: '어드민 수동 입력',
        isAdminInput: true,
      }
    });

    // records 구독이 fetchClubPoints 트리거함 → 다른 기기 자동 반영
    addLog(`${player.name}님이 ${type === 'evangelism' ? '전도' : '발표'} 점수 ${value}점을 획득했습니다.`, type);
  };

  // ✅ 수정: country_purchases DELETE 추가 → 환불 다른 기기 반영
  const handleCancelOccupation = async (countryId: string) => {
    const country = gameState.countries[countryId];
    if (!country) return;

    const refundGold = COUNTRY_PRICES[country.name] || COUNTRY_PRICES[country.id] || DEFAULT_COUNTRY_PRICE;
    const player = gameState.players.find(p => p.id === country.ownerId);

    await supabase.from('country_occupations').delete().eq('country_id', countryId);

    // ✅ 추가: country_purchases에서 1건 삭제 → 환불 포인트 다른 기기 반영
    await supabase.from('country_purchases')
      .delete()
      .eq('club_name', player?.name)
      .eq('country_name', country.name)
      .limit(1);

    setGameState(prev => {
      const cleanCountries = { ...prev.countries };
      delete cleanCountries[countryId];
      const updatedPlayers = prev.players.map(p =>
        p.id === country.ownerId ? { ...p, gold: p.gold + refundGold } : p
      );
      const newLog = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
        message: `관리자가 ${player?.name || '대원'}의 ${country.name} 점령을 강제 취소했습니다. (${refundGold}G 환불)`,
        type: 'purchase' as any
      };
      return { ...prev, countries: cleanCountries, players: updatedPlayers, logs: [newLog, ...prev.logs].slice(0, 50) };
    });
  };

  // ✅ 수정: building_purchases DELETE 추가 → 환불 다른 기기 반영
  const cancelBuilding = async (countryId: string) => {
    const country = gameState.countries[countryId];
    if (!country || country.buildings <= 0) return;

    const newBuildings = country.buildings - 1;
    const tiers = getBuildingTiers(country.name);
    const tier = tiers[country.buildings - 1];
    const player = gameState.players.find(p => p.id === country.ownerId);

    await supabase.from('country_occupations')
      .update({ buildings: newBuildings })
      .eq('country_id', countryId);

    // ✅ 추가: building_purchases에서 1건 삭제 → 환불 포인트 다른 기기 반영
    await supabase.from('building_purchases')
      .delete()
      .eq('club_name', player?.name)
      .eq('building_name', tier.name)
      .limit(1);

    setGameState(prev => ({
      ...prev,
      countries: { ...prev.countries, [countryId]: { ...country, buildings: newBuildings } },
    }));

    addLog(`관리자가 ${player?.name || '대원'}의 ${country.name} 건물 '${tier.name}'을 취소했습니다.`, 'construction');
  };

  const healGhostData = async () => {
    const validPlayerIds = new Set(gameState.players.map(p => p.id));
    const ghostIds = Object.entries(gameState.countries)
      .filter(([_, country]) => !validPlayerIds.has(country.ownerId))
      .map(([key]) => key);

    if (ghostIds.length > 0) {
      for (const id of ghostIds) {
        await supabase.from('country_occupations').delete().eq('country_id', id);
      }
      setGameState(prev => {
        const cleanCountries = { ...prev.countries };
        ghostIds.forEach(id => delete cleanCountries[id]);
        return { ...prev, countries: cleanCountries };
      });
      alert(`치료 완료: ${ghostIds.length}개의 유령 데이터가 삭제되었습니다!`);
    } else {
      alert('발견된 유령 데이터가 없습니다.');
    }
  };

  // ✅ 수정: country_purchases INSERT → 포인트 차감 다른 기기 반영
  const buyCountry = async (countryId: string, playerId: string, countryName: string) => {
    const player = gameState.players.find(p => p.id === playerId);
    const price = COUNTRY_PRICES[countryName] || DEFAULT_COUNTRY_PRICE;
    if (!player || player.gold < price) { alert('금화가 부족합니다!'); return; }

    await supabase.from('country_occupations').upsert({
      country_id: countryId,
      country_name: countryName,
      owner_id: player.id,
      owner_name: player.name,
      buildings: 0
    });

    // ✅ 추가: country_purchases에 기록 → 다른 기기 포인트 차감 동기화
    await supabase.from('country_purchases').insert({
      club_name: player.name,
      country_name: countryName,
      price_paid: price,
      purchased_at: new Date().toISOString()
    });

    setGameState(prev => ({
      ...prev,
      players: prev.players.map(p => p.id === playerId ? { ...p, gold: p.gold - price } : p),
      countries: { ...prev.countries, [countryId]: { id: countryId, name: countryName, ownerId: player.id, buildings: 0 } }
    }));
    addLog(`${player.name}님이 ${countryName}를 ${price}G에 점령했습니다!`, 'purchase');
  };

  // ✅ 수정: building_purchases INSERT → 포인트 차감 다른 기기 반영
  const buildInCountry = async (countryId: string) => {
    const country = gameState.countries[countryId];
    if (!country?.ownerId || country.buildings >= 3) return;
    const tiers = getBuildingTiers(country.name);
    const nextTier = tiers[country.buildings];
    const player = gameState.players.find(p => p.id === country.ownerId);
    if (!player || player.buildingPower < nextTier.cost) return;

    const newBuildings = country.buildings + 1;

    await supabase.from('country_occupations')
      .update({ buildings: newBuildings })
      .eq('country_id', countryId);

    // ✅ 추가: building_purchases에 기록 → 다른 기기 포인트 차감 동기화
    await supabase.from('building_purchases').insert({
      club_name: player.name,
      building_name: nextTier.name,
      price_paid: nextTier.cost,
      purchased_at: new Date().toISOString()
    });

    setGameState(prev => ({
      ...prev,
      players: prev.players.map(p => p.id === player.id ? { ...p, buildingPower: p.buildingPower - nextTier.cost } : p),
      countries: { ...prev.countries, [countryId]: { ...country, buildings: newBuildings } }
    }));
    addLog(`${player.name}님이 ${country.name}에 '${nextTier.name}'(을)를 건축했습니다!`, 'construction');
  };

  // ✅ 수정: purchases 테이블도 같이 초기화 → 다른 기기 동기화
  const resetGame = async () => {
    if (window.confirm('정말 모든 데이터를 초기화하시겠습니까? (멤버는 유지됩니다)')) {
      await supabase.from('country_occupations').delete().neq('country_id', '');
      await supabase.from('country_purchases').delete().neq('id', 0);
      await supabase.from('building_purchases').delete().neq('id', 0);

      setGameState(prev => ({
        ...prev,
        players: prev.players.map(p => ({ ...p, gold: 0, buildingPower: 0 })),
        countries: {},
        logs: [{ id: 'reset', timestamp: Date.now(), message: '게임 데이터가 초기화되었습니다.', type: 'purchase' as any }]
      }));

      await fetchClubPoints(startDate);
    }
  };

  const resetManualPoints = async () => {
    if (window.confirm('관리자가 수동으로 추가한 점수를 초기화하고 원본 점수로 되돌리시겠습니까?')) {
      await fetchClubPoints();
      addLog('관리자 수동 추가 점수가 초기화되었습니다.', 'purchase' as any);
    }
  };

const handleColorChange = async (playerId: string, color: string) => {
  const player = gameState.players.find(p => p.id === playerId);
  if (!player) return;

  await supabase
    .from('users')
    .update({ color })
    .eq('username', player.name);

  setGameState(prev => ({
    ...prev,
    players: prev.players.map(p => p.id === playerId ? { ...p, color } : p)
  }));
};

  return {
    gameState, currentUser, clubPoints, isSyncing,
    startDate, setStartDate: handleStartDateChange,
    fetchClubPoints, handleLogin, handleLogout,
    handleAddMember, handleDeleteMember, handleAdminSubmit,
    handleCancelOccupation, healGhostData, buyCountry, buildInCountry, resetGame,
    cancelBuilding, resetManualPoints, handleColorChange, handleChangePassword,
  };
}
