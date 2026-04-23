import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';

const BASE_PATH = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

export function GovernanceSlide({ onBack, onNext }: { onBack: () => void, onNext: () => void }) {
  return (
    <div className="flex flex-col h-full w-full p-8 lg:p-12 relative z-10 overflow-y-auto">
      <div className="flex justify-between items-start mb-8">
        <div>
          <button 
            onClick={onBack}
            className="text-sm text-gray-500 hover:text-gray-900 mb-4 flex items-center transition-colors"
          >
            &larr; Back
          </button>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Major Political Powers</h2>
          
        </div>
        <button 
          onClick={onNext}
          className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-500/30 text-xs"
        >
          Next <ArrowRight size={14} />
        </button>
      </div>

      {/* Political Parties */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white/30 backdrop-blur-xl border border-white/50 p-8 rounded-3xl shadow-xl"
      >
        
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="bg-white/50 p-10 rounded-2xl border border-white/60 hover:bg-white/70 transition-colors">
            <div className="flex items-start gap-8">
              <div className="w-36 h-36 rounded-xl flex items-center justify-center overflow-hidden shrink-0 bg-white">
                <img src={`${BASE_PATH}/KDP_logo.svg`} alt="KDP" className="w-full h-full object-contain" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-gray-900 text-2xl mb-3">Kurdistan Democratic Party</h4>
                <p className="text-lg font-semibold text-yellow-600 mb-3">President: Masoud Barzani</p>
                <p className="text-lg text-gray-500 mb-3">Founded: 1946 · Ideology: Kurdish nationalism, conservatism</p>
                <p className="text-xl text-gray-600">The largest party in the Kurdistan Parliament, leading the current government coalition. Dominant in Erbil and Duhok governorates with 39 seats in parliament.</p>
              </div>
            </div>
          </div>

          <div className="bg-white/50 p-10 rounded-2xl border border-white/60 hover:bg-white/70 transition-colors">
            <div className="flex items-start gap-8">
              <div className="w-36 h-36 rounded-xl flex items-center justify-center overflow-hidden shrink-0 bg-white">
                <img src={`${BASE_PATH}/PUK_Logo.svg`} alt="PUK" className="w-full h-full object-contain" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-gray-900 text-2xl mb-3">Patriotic Union of Kurdistan</h4>
                <p className="text-lg font-semibold text-green-700 mb-3">President: Bafel Talabani</p>
                <p className="text-lg text-gray-500 mb-3">Founded: 1975 · Ideology: Social democracy, Kurdish nationalism</p>
                <p className="text-xl text-gray-600">The second-largest party and key coalition partner. Dominant in Sulaymaniyah and Halabja governorates with 21 seats in parliament.</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
