import { Character } from '../types';

export const CHARACTERS: Character[] = [
  {
    id: 'leila',
    name: 'Leila "The Swift Ace"',
    description: 'A agile master of rapid placement. She maintains high movement speed and curved ball trajectories, clad in premium athletic white sports-underwear.',
    imageUrl: '/src/assets/images/character_leila_1781178728344.png',
    speed: 1.25,
    power: 1.05,
    curve: 1.3,
    soundFX: 'Leila High-Pitch Cue',
    color: '#38bdf8', // light blue
    underwearStyle: 'Minimalist sport-mesh support bra and premium matching high-cut athletic athletic undergarments.'
  },
  {
    id: 'elena',
    name: 'Elena "The Volley Queen"',
    description: 'An enthusiastic star wearing vibrant modern lavender active-wear underwear. Her energetic hits increase ball speed significantly with raw explosive power.',
    imageUrl: '/src/assets/images/character_elena_1781178746545.png',
    speed: 1.1,
    power: 1.35,
    curve: 1.05,
    soundFX: 'Elena Deep Exhale Key',
    color: '#c084fc', // purple
    underwearStyle: 'Vibrant lavender active-mesh performance stretch bra and matching quick-dry coordinates.'
  },
  {
    id: 'naomi',
    name: 'Naomi "The Golden Spin"',
    description: 'A champion displaying calm confidence, clad in luxurious sporty swimwear-style black and gold edge bikini-underwear. Outstanding statistics balance.',
    imageUrl: '/src/assets/images/character_naomi_1781178765964.png',
    speed: 1.15,
    power: 1.15,
    curve: 1.25,
    soundFX: 'Naomi Sharp Echo',
    color: '#fbbf24', // golden yellow
    underwearStyle: 'Luxury black gold-gilded metallic trim sports-bralette and dynamic designer side-tie bikini panties.'
  }
];

export const TENNIS_COURT_BG = '/src/assets/images/tennis_court_bg_1781178785718.png';
