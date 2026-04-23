import React, { useState, useRef } from 'react';
import { SatelliteSlide } from './components/SatelliteSlide';
import { AtlasSlide } from './components/AtlasSlide';
import { RankingSlide } from './components/RankingSlide';
import { StakeholdersSlide } from './components/StakeholdersSlide';
import { StructureSlide } from './components/StructureSlide';
import { PoliticalPowersSlide } from './components/PoliticalPowersSlide';
import { GovernanceSlide } from './components/GovernanceSlide';
import { EconomicsSlide } from './components/EconomicsSlide';
import { EnvironmentSlide } from './components/EnvironmentSlide';
import { TechnologySlide } from './components/TechnologySlide';
import { PolicySlide } from './components/PolicySlide';
import { RoadmapSlide } from './components/RoadmapSlide';
import { InvestmentSlide } from './components/InvestmentSlide';
import { SocialImpactSlide } from './components/SocialImpactSlide';
import { AnimatePresence, motion } from 'motion/react';
import { SlideNavigationHUD } from './components/SlideNavigationHUD';
import { EnergyFlowSlide } from './components/EnergyFlowSlide';
import { AuthModal } from './components/AuthModal';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [slide, setSlide] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15>(1);
  const [tiffDataCache, setTiffDataCache] = useState<Record<string, { url: string, coordinates: number[][], actual_min?: number, actual_max?: number }>>({});
  const [rasterDataCache, setRasterDataCache] = useState<Record<string, { rasters: any, bbox: number[], width: number, height: number }>>({});
  const rasterCacheRef = useRef<Record<string, { rasters: any, bbox: number[], width: number, height: number }>>({});

  return (
    <div className="w-screen h-screen bg-slate-50 overflow-hidden font-sans relative">
      {!isAuthenticated && <AuthModal onAuthenticate={() => setIsAuthenticated(true)} />}
      
      {/* Glassmorphism Background Blobs */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-amber-400/20 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-400/20 blur-[120px]" />
        <div className="absolute top-[30%] left-[60%] w-[40%] h-[40%] rounded-full bg-emerald-400/10 blur-[120px]" />
      </div>

      <AnimatePresence mode="wait">
        {slide === 1 && (
          <motion.div 
            key="satellite"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.6 }}
            className="w-full h-full"
          >
            <SatelliteSlide 
              onNext={() => setSlide(2)} 
              tiffDataCache={tiffDataCache}
              setTiffDataCache={setTiffDataCache}
              rasterDataCache={rasterDataCache}
              setRasterDataCache={setRasterDataCache}
              rasterCacheRef={rasterCacheRef}
            />
          </motion.div>
        )}
        {slide === 2 && (
          <motion.div 
            key="atlas"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.6 }}
            className="w-full h-full"
          >
            <AtlasSlide onBack={() => setSlide(1)} onNext={() => setSlide(3)} />
          </motion.div>
        )}
        {slide === 3 && (
          <motion.div 
            key="ranking"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.6 }}
            className="w-full h-full relative z-10"
          >
            <RankingSlide onBack={() => setSlide(2)} onNext={() => setSlide(4)} />
          </motion.div>
        )}
        {slide === 4 && (
          <motion.div 
            key="stakeholders"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.6 }}
            className="w-full h-full relative z-10"
          >
            <StakeholdersSlide onBack={() => setSlide(3)} onNext={() => setSlide(5)} />
          </motion.div>
        )}
        {slide === 5 && (
          <motion.div 
            key="energyflow"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.6 }}
            className="w-full h-full relative z-10"
          >
            <EnergyFlowSlide onBack={() => setSlide(4)} onNext={() => setSlide(6)} />
          </motion.div>
        )}
        {slide === 6 && (
          <motion.div 
            key="structure"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.6 }}
            className="w-full h-full relative z-10"
          >
            <StructureSlide onBack={() => setSlide(5)} onNext={() => setSlide(7)} />
          </motion.div>
        )}
        {slide === 7 && (
          <motion.div 
            key="politicalpowers"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.6 }}
            className="w-full h-full"
          >
            <PoliticalPowersSlide onBack={() => setSlide(6)} onNext={() => setSlide(8)} />
          </motion.div>
        )}
        {slide === 8 && (
          <motion.div 
            key="governance"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.6 }}
            className="w-full h-full"
          >
            <GovernanceSlide onBack={() => setSlide(7)} onNext={() => setSlide(9)} />
          </motion.div>
        )}
        {slide === 9 && (
          <motion.div 
            key="economics"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.6 }}
            className="w-full h-full"
          >
            <EconomicsSlide onBack={() => setSlide(8)} onNext={() => setSlide(10)} />
          </motion.div>
        )}
        {slide === 10 && (
          <motion.div 
            key="investment"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.6 }}
            className="w-full h-full relative z-10"
          >
            <InvestmentSlide onBack={() => setSlide(9)} onNext={() => setSlide(11)} />
          </motion.div>
        )}
        {slide === 11 && (
          <motion.div 
            key="environment"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.6 }}
            className="w-full h-full relative z-10"
          >
            <EnvironmentSlide onBack={() => setSlide(10)} onNext={() => setSlide(12)} />
          </motion.div>
        )
        }
        {slide === 12 && (
          <motion.div 
            key="social"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.6 }}
            className="w-full h-full relative z-10"
          >
            <SocialImpactSlide onBack={() => setSlide(11)} onNext={() => setSlide(13)} />
          </motion.div>
        )}
        {slide === 13 && (
          <motion.div 
            key="technology"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.6 }}
            className="w-full h-full relative z-10"
          >
            <TechnologySlide onBack={() => setSlide(12)} onNext={() => setSlide(14)} />
          </motion.div>
        )}
        {slide === 14 && (
          <motion.div 
            key="policy"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.6 }}
            className="w-full h-full relative z-10"
          >
            <PolicySlide onBack={() => setSlide(13)} onNext={() => setSlide(15)} />
          </motion.div>
        )
        }
        {slide === 15 && (
          <motion.div 
            key="roadmap"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full h-full relative z-10"
          >
            <RoadmapSlide onBack={() => setSlide(14)} onRestart={() => setSlide(1)} />
          </motion.div>
        )}
        {slide === 7 && (
          <motion.div 
            key="governance"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.6 }}
            className="w-full h-full"
          >
            <GovernanceSlide onBack={() => setSlide(6)} onNext={() => setSlide(8)} />
          </motion.div>
        )}
        {slide === 8 && (
          <motion.div 
            key="economics"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.6 }}
            className="w-full h-full"
          >
            <EconomicsSlide onBack={() => setSlide(7)} onNext={() => setSlide(9)} />
          </motion.div>
        )}
        {slide === 9 && (
          <motion.div 
            key="investment"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.6 }}
            className="w-full h-full relative z-10"
          >
            <InvestmentSlide onBack={() => setSlide(8)} onNext={() => setSlide(10)} />
          </motion.div>
        )}
        {slide === 10 && (
          <motion.div 
            key="environment"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.6 }}
            className="w-full h-full relative z-10"
          >
            <EnvironmentSlide onBack={() => setSlide(9)} onNext={() => setSlide(11)} />
          </motion.div>
        )}
        {slide === 11 && (
          <motion.div 
            key="social"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.6 }}
            className="w-full h-full relative z-10"
          >
            <SocialImpactSlide onBack={() => setSlide(10)} onNext={() => setSlide(12)} />
          </motion.div>
        )}
        {slide === 12 && (
          <motion.div 
            key="technology"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.6 }}
            className="w-full h-full relative z-10"
          >
            <TechnologySlide onBack={() => setSlide(11)} onNext={() => setSlide(13)} />
          </motion.div>
        )}
        {slide === 13 && (
          <motion.div 
            key="policy"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.6 }}
            className="w-full h-full relative z-10"
          >
            <PolicySlide onBack={() => setSlide(12)} onNext={() => setSlide(14)} />
          </motion.div>
        )}
        {slide === 14 && (
          <motion.div 
            key="roadmap"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full h-full relative z-10"
          >
            <RoadmapSlide onBack={() => setSlide(13)} onRestart={() => setSlide(1)} />
          </motion.div>
        )}
      </AnimatePresence>

      <SlideNavigationHUD currentSlide={slide} onNavigate={setSlide} />
    </div>
  );
}
