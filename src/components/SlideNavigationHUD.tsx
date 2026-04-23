import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const SLIDES = [
  { id: 1, title: 'Data Layers' },
  { id: 2, title: 'Sites' },
  { id: 3, title: 'Site Rankings' },
  { id: 4, title: 'Stakeholders' },
  { id: 5, title: 'Energy Flow' },
  { id: 6, title: 'Regional Administration' },
  { id: 7, title: 'Regional Governance' },
  { id: 8, title: 'Political Powers' },
  { id: 9, title: 'Economics' },
  { id: 10, title: 'Investment' },
  { id: 11, title: 'Environment' },
  { id: 12, title: 'Social Impact' },
  { id: 13, title: 'Technology' },
  { id: 14, title: 'Policy' },
  { id: 15, title: 'Roadmap' },
];

interface SlideNavigationHUDProps {
  currentSlide: number;
  onNavigate: (slide: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15) => void;
}

export function SlideNavigationHUD({ currentSlide, onNavigate }: SlideNavigationHUDProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [hoveredSlide, setHoveredSlide] = useState<number | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const threshold = window.innerHeight - 100;
      setIsVisible(e.clientY >= threshold);
    };
    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-auto"
          >
            <div className="flex items-center gap-1.5 bg-white/40 backdrop-blur-xl border border-white/60 rounded-full px-3 py-2 shadow-2xl">
              {SLIDES.map((slide) => (
                <div key={slide.id} className="relative">
                  <button
                    onClick={() => onNavigate(slide.id as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15)}
                    onMouseEnter={() => setHoveredSlide(slide.id)}
                    onMouseLeave={() => setHoveredSlide(null)}
                    className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-200
                      ${currentSlide === slide.id 
                        ? 'bg-amber-500 text-slate-900 shadow-lg shadow-amber-500/30' 
                        : 'bg-slate-200/50 text-slate-700 hover:bg-slate-300/70 hover:text-slate-900'
                      }
                    `}
                  >
                    {slide.id}
                  </button>
                  <AnimatePresence>
                    {hoveredSlide === slide.id && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-white/70 backdrop-blur-md text-slate-800 text-xs font-medium rounded-lg shadow-xl whitespace-nowrap border border-white/40"
                      >
                        {slide.title}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white/70" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
