/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Player, TEAM_COLORS } from './types';

export const CHARACTER_SEEDS = [
  'adventurer', 'robot', 'fairy', 'knight', 'hero', 
  'wizard', 'scholar', 'engineer', 'explorer', 'bunny',
  'cat', 'dragon', 'ghost', 'king', 'queen'
];

export const INITIAL_TEAMS: Player[] = [];

// 전체 나라 가격의 합이 약 6000이 되도록 세부 조정 (주요 국가 약 4500G + 기타 국가 약 1500G)
export const COUNTRY_PRICES: Record<string, number> = {
  'Russia': 450,
  'Canada': 350,
  'China': 400,
  'United States of America': 400,
  'Brazil': 300,
  'Australia': 250,
  'India': 220,
  'Argentina': 180,
  'Kazakhstan': 130,
  'Algeria': 130,
  'DR Congo': 130,
  'Greenland': 90,
  'Saudi Arabia': 130,
  'Mexico': 130,
  'Indonesia': 180,
  'Sudan': 90,
  'Libya': 90,
  'Iran': 90,
  'Mongolia': 90,
  'Peru': 90,
  'Chad': 70,
  'Niger': 70,
  'Angola': 70,
  'Mali': 70,
  'South Africa': 90,
  'Colombia': 90,
  'Ethiopia': 70,
  'Bolivia': 70,
  'Mauritania': 50,
  'Egypt': 70,
};

export const DEFAULT_COUNTRY_PRICE = 10;

export type CountrySize = 'small' | 'medium' | 'large';

export const COUNTRY_SIZES: Record<string, CountrySize> = {
  'Russia': 'large', 'Canada': 'large', 'China': 'large',
  'United States of America': 'large', 'Brazil': 'large',
  'Australia': 'large', 'India': 'large', 'Argentina': 'large',
  'Kazakhstan': 'large', 'Algeria': 'large', 'DR Congo': 'large',
  'Saudi Arabia': 'large', 'Mexico': 'large', 'Indonesia': 'large',
  'Sudan': 'large', 'Libya': 'large', 'Iran': 'large',
  'Mongolia': 'large', 'Peru': 'large', 'Chad': 'large',
  'Niger': 'large', 'Angola': 'large', 'Mali': 'large',
  'Ethiopia': 'large', 'Bolivia': 'large', 'Greenland': 'large',
  'South Africa': 'medium', 'Colombia': 'medium', 'Mauritania': 'medium',
  'Egypt': 'medium', 'Tanzania': 'medium', 'Nigeria': 'medium',
  'Venezuela': 'medium', 'Namibia': 'medium', 'Mozambique': 'medium',
  'Pakistan': 'medium', 'Turkey': 'medium', 'Chile': 'medium',
  'Zambia': 'medium', 'Myanmar': 'medium', 'Afghanistan': 'medium',
  'Somalia': 'medium', 'Central African Republic': 'medium',
  'South Sudan': 'medium', 'Ukraine': 'medium', 'Madagascar': 'medium',
  'Kenya': 'medium', 'France': 'medium', 'Spain': 'medium',
  'Sweden': 'medium', 'Norway': 'medium', 'Germany': 'medium',
  'Finland': 'medium', 'Poland': 'medium', 'Japan': 'medium',
  'Thailand': 'medium', 'Vietnam': 'medium',
};

export const DEFAULT_COUNTRY_SIZE: CountrySize = 'small';

export const BUILDING_TIERS_BY_SIZE: Record<CountrySize, { level: number; name: string; icon: string; cost: number }[]> = {
  small: [
    { level: 1, name: '작은 예배소', cost: 10, icon: '⛪' },
    { level: 2, name: '지교회',     cost: 20, icon: '🕍' },
    { level: 3, name: '정교회',     cost: 30, icon: '🕌' },
  ],
  medium: [
    { level: 1, name: '작은 예배소', cost: 15, icon: '⛪' },
    { level: 2, name: '지교회',     cost: 25, icon: '🕍' },
    { level: 3, name: '정교회',     cost: 40, icon: '🕌' },
  ],
  large: [
    { level: 1, name: '작은 예배소', cost: 20,  icon: '⛪' },
    { level: 2, name: '지교회',     cost: 30, icon: '🕍' },
    { level: 3, name: '정교회',     cost: 50, icon: '🕌' },
  ],
};

export const BUILDING_TIERS = BUILDING_TIERS_BY_SIZE.small;

export function getBuildingTiers(countryName: string) {
  const size = COUNTRY_SIZES[countryName] || DEFAULT_COUNTRY_SIZE;
  return BUILDING_TIERS_BY_SIZE[size];
}

export const CLUB_IMAGES: Record<string, string> = {
  'A to Z': '/clubs/AtoZ.png',
  'TOY': '/clubs/TOY.png',
  'Evergreen': '/clubs/Evergreen.png',
  'Blossom': '/clubs/Blossom.png',
  'The First': '/clubs/TheFirst.png',
  'Pearlfect': '/clubs/Pearlfect.png',
  'YITC': '/clubs/YITC.png',
  'BPM': '/clubs/BPM.png',
  'EBS': '/clubs/EBS.png',
  'EVERGREEN+BPM+MARE': '/clubs/EvergreenBpmMare.png',
  'Psallo': '/clubs/Psallo.png',
};

export const BUILDING_IMAGES: Record<number, string> = {
  1: '/buildings/housechurch.png',
  2: '/buildings/branch.png',
  3: '/buildings/church.png',
};

export const COUNTRY_NAME_MAP: Record<string, string> = {
  'Eq. Guinea': 'Equatorial Guinea',
  'Central African Rep.': 'Central African Republic',
  'S. Sudan': 'South Sudan',
  'W. Sahara': 'Western Sahara',
};

export const TEAM_ALIASES: Record<string, string> = {
  'BPM': 'EVERGREEN+BPM+MARE',
  'MARE': 'EVERGREEN+BPM+MARE',
  'Evergreen': 'EVERGREEN+BPM+MARE',
  'A to Z': 'A to Z+YITC',   // ✅ 추가
  'YITC': 'A to Z+YITC',     // ✅ 추가
};
