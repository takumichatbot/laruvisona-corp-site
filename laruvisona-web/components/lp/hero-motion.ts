'use client';
import { createContext, useContext } from 'react';
export const HeroMotion = createContext({
  paused: true,
  reduced: true,
  visible: false,
});
export const useHeroMotion = () => useContext(HeroMotion);
