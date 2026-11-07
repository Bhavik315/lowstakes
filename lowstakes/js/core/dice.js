import { randInt } from './cards.js?v=30';

export const rollDie = () => 1 + randInt(6);
export const rollTwo = () => { const a = rollDie(); const b = rollDie(); return [a, b]; };
export const isHard = ([a, b]) => a === b;
