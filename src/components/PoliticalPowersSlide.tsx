import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Landmark, ArrowRight, ShieldCheck } from 'lucide-react';

export function PoliticalPowersSlide({ onBack, onNext }: { onBack: () => void, onNext: () => void }) {
  const [imgError, setImgError] = useState<Record<string, boolean>>({});

  const handleImgError = (name: string) => {
    setImgError(prev => ({ ...prev, [name]: true }));
  };

  const PersonCard = ({ name, title, subtitle, party, desc, image, imgKey, icon: Icon, delay = 0 }: {
    name: string; title: string; subtitle: string; party: string; desc: string;
    image: string; imgKey: string; icon: React.ComponentType<{ className?: string; size?: number }>; delay?: number;
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="bg-white/40 backdrop-blur-xl border border-white/60 p-3 rounded-2xl shadow-md flex gap-3 items-start"
    >
      <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 border-2 border-white shadow-sm bg-gray-100">
        <img
          src={imgError[imgKey] ? `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=10B981&color=fff&size=128` : image}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => handleImgError(imgKey)}
        />
      </div>
      <div>
        <div className="flex items-center gap-1 mb-0.5">
          <Icon className="text-emerald-600" size={12} />
          <span className="text-[8px] font-bold text-gray-500 uppercase tracking-wider">{title}</span>
        </div>
        <h4 className="text-xs font-bold text-gray-900">{name}</h4>
        <p className={`text-[9px] font-semibold mb-1 ${
            party === 'PUK' ? 'text-emerald-600' :
            party === 'Goran Movement' ? 'text-slate-800' :
            'text-yellow-600'
          }`}>{party}</p>
        <p className="text-[10px] text-gray-600 leading-tight">{desc}</p>
      </div>
    </motion.div>
  );

  return (
    <div className="flex flex-col h-full w-full p-4 lg:p-6 relative z-10 overflow-y-auto">
      <div className="flex justify-between items-start mb-4 shrink-0">
        <div>
          <button
            onClick={onBack}
            className="text-xs text-gray-500 hover:text-gray-900 mb-2 flex items-center transition-colors"
          >
            &larr; Back
          </button>
          <h2 className="text-2xl font-bold text-gray-900">Regional Governance</h2>
        </div>
        <button
          onClick={onNext}
          className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-500/30 text-xs"
        >
          Next <ArrowRight size={14} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
        {/* President Column */}
        <div className="flex flex-col gap-3">
          <PersonCard
            name="Nechirvan Barzani"
            title="President"
            subtitle="Kurdistan Region"
            party="KDP"
            desc="Serving as President of the Kurdistan Region since 2019. A key figure in regional diplomacy and economic development."
            image="https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Nechirvan_Barzani_in_2019.jpg/400px-Nechirvan_Barzani_in_2019.jpg"
            imgKey="president"
            icon={ShieldCheck}
          />
          <PersonCard
            name="Jaafar Sheikh Mustafa"
            title="Vice President 1"
            subtitle=""
            party="PUK"
            desc="First Vice President of the Kurdistan Region, supporting the President in regional governance."
            image="https://ui-avatars.com/api/?name=Jaafar+Sheikh+Mustafa&background=0D8ABC&color=fff&size=128"
            imgKey="deputy-president"
            icon={ShieldCheck}
            delay={0.05}
          />
          <PersonCard
            name="Mustafa Said Qadir"
            title="Vice President 2"
            subtitle=""
            party="Goran Movement"
            desc="Second Vice President of the Kurdistan Region, assisting in regional administration."
            image="https://ui-avatars.com/api/?name=Mustafa+Said+Qadir&background=0D8ABC&color=fff&size=128"
            imgKey="deputy-president-2"
            icon={ShieldCheck}
            delay={0.1}
          />
        </div>

        {/* Prime Minister Column */}
        <div className="flex flex-col gap-3">
          <PersonCard
            name="Masrour Barzani"
            title="Prime Minister"
            subtitle="KRG"
            party="KDP"
            desc="Leading the KRG cabinet since 2019. Focused on institutional reform, digitalization, and energy infrastructure."
            image="https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Masrour_Barzani_2020.jpg/400px-Masrour_Barzani_2020.jpg"
            imgKey="pm"
            icon={Landmark}
          />
          <PersonCard
            name="Qubad Talabani"
            title="Deputy Prime Minister"
            subtitle=""
            party="PUK"
            desc="Deputy Prime Minister of the Kurdistan Region, representing Sulaymaniyah and the PUK party."
            image="https://ui-avatars.com/api/?name=Qubad+Talabani&background=10B981&color=fff&size=128"
            imgKey="dpm"
            icon={Landmark}
            delay={0.05}
          />
          <PersonCard
            name="Kamal Mohammad Salih"
            title="Ministry of Electricity"
            subtitle=""
            party="KDP"
            desc="Minister of Electricity overseeing energy generation, transmission, and distribution infrastructure."
            image="https://ui-avatars.com/api/?name=Kamal+Mohammad+Salih&background=3B82F6&color=fff&size=128"
            imgKey="moe"
            icon={Landmark}
            delay={0.1}
          />
        </div>
      </div>
    </div>
  );
}

export default PoliticalPowersSlide;