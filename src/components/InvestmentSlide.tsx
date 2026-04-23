import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, TrendingUp, Landmark, Briefcase, HandCoins } from 'lucide-react';

export function InvestmentSlide({ onBack, onNext }: { onBack: () => void, onNext: () => void }) {
  return (
    <div className="flex flex-col h-full w-full p-8 lg:p-12 relative z-10 overflow-y-auto">
      <div className="flex justify-between items-start mb-8">
        <div>
          <button 
            onClick={onBack}
            className="text-sm text-gray-500 hover:text-gray-900 mb-4 flex items-center transition-colors"
          >
            &larr; Back to Economics
          </button>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Investment Opportunities</h2>
          
        </div>
        <button 
          onClick={onNext}
          className="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all shadow-lg shadow-indigo-500/30 text-xs"
        >
          Next <ArrowRight size={14} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white/40 backdrop-blur-xl border border-white/60 p-8 rounded-3xl shadow-xl"
        >
          <div className="flex items-center gap-3 mb-6">
            <Landmark className="text-indigo-600" size={28} />
            <h3 className="text-2xl font-bold text-gray-900">Foreign Direct Investment (FDI)</h3>
          </div>
          <p className="text-gray-700 leading-relaxed mb-6">
            The Kurdistan Region offers a secure and lucrative environment for foreign investors looking to capitalize on the Middle East's green energy transition. With new investment laws providing tax holidays and land grants, the barriers to entry for utility-scale solar projects have never been lower.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/50 p-4 rounded-2xl border border-white/60">
              <div className="text-3xl font-light text-indigo-600 mb-1">10-Year</div>
              <div className="text-sm font-medium text-gray-600">Corporate Tax Holiday</div>
            </div>
            <div className="bg-white/50 p-4 rounded-2xl border border-white/60">
              <div className="text-3xl font-light text-indigo-600 mb-1">100%</div>
              <div className="text-sm font-medium text-gray-600">Foreign Ownership Allowed</div>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-white/40 backdrop-blur-xl border border-white/60 p-8 rounded-3xl shadow-xl"
        >
          <div className="flex items-center gap-3 mb-6">
            <HandCoins className="text-indigo-600" size={28} />
            <h3 className="text-2xl font-bold text-gray-900">Public-Private Partnerships</h3>
          </div>
          <p className="text-gray-700 leading-relaxed mb-6">
            The KRG is actively seeking PPPs to modernize the grid and establish large-scale solar farms. These partnerships guarantee power purchase agreements (PPAs) backed by the regional government, ensuring long-term revenue stability for developers.
          </p>
          <div className="space-y-4">
            <div className="flex items-center gap-4 bg-white/50 p-4 rounded-2xl border border-white/60">
              <Briefcase className="text-indigo-500" size={24} />
              <div>
                <div className="font-bold text-gray-900">Guaranteed PPAs</div>
                <div className="text-sm text-gray-600">15 to 25-year government-backed contracts</div>
              </div>
            </div>
            <div className="flex items-center gap-4 bg-white/50 p-4 rounded-2xl border border-white/60">
              <TrendingUp className="text-indigo-500" size={24} />
              <div>
                <div className="font-bold text-gray-900">Projected ROI</div>
                <div className="text-sm text-gray-600">Estimated 12-15% internal rate of return (IRR)</div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="bg-indigo-900/80 backdrop-blur-xl border border-indigo-500/30 p-8 rounded-3xl shadow-2xl text-white"
      >
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="md:w-2/3">
            <h3 className="text-2xl font-bold mb-3">Green Bonds & Financing</h3>
            <p className="text-indigo-100 leading-relaxed">
              To accelerate the transition, local banks in collaboration with international financial institutions are launching Green Bonds. These instruments provide low-interest capital specifically earmarked for renewable energy and infrastructure projects in the Kurdistan Region.
            </p>
          </div>
          <div className="md:w-1/3 flex justify-center">
            <div className="text-center">
              <div className="text-5xl font-light text-indigo-300 mb-2">$500M</div>
              <div className="text-sm font-medium text-indigo-200 uppercase tracking-wider">Initial Green Bond Target</div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
