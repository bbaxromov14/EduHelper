import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/ReactContext';

const Premium = () => {
  const { isAuthenticated, userData } = useAuth();
  const navigate = useNavigate();

  // Текущий тариф пользователя
  const currentTier = userData?.profile?.premium_tier || 'free';

  const plans = [
    {
      tier: 'free',
      name: 'Bepul',
      enName: 'Free',
      price: 0,
      features: [
        'Barcha bepul kurslar',
        'Oddiy sertifikatlar',
        'Reklama (kelajakda)',
        'Cheklangan tezlik'
      ],
      color: 'from-gray-400 to-gray-600',
      textColor: 'text-white',
      buttonText: 'Joriy tarif',
      recommended: false
    },
    {
      tier: 'start',
      name: 'Start',
      enName: 'Start',
      price: 49_000,
      period: 'oyiga',
      features: [
        'Barcha bepul kurslar',
        '50% Premium kurslar',
        'Reklamasiz tajriba',
        'Toʻliq sertifikatlar',
        'Tezroq yuklanish',
        'Prioritet yordam'
      ],
      color: 'from-blue-500 to-indigo-600',
      textColor: 'text-white',
      buttonText: currentTier === 'start' ? 'Joriy tarif' : 'Sotib olish',
      recommended: true
    },
    {
      tier: 'blaze',
      name: 'Blaze',
      enName: 'Blaze',
      price: 99_000,
      period: 'oyiga',
      features: [
        'Barcha kurslar (100%)',
        'Reklamasiz',
        'Offline rejim (tez orada)',
        'Yuklab olish imkoniyati',
        'Eksklyuziv materiallar',
        'Tezkor yordam 24/7',
        'Maxsus badge profilida 🔥'
      ],
      color: 'from-orange-500 to-red-600',
      textColor: 'text-white',
      buttonText: currentTier === 'blaze' ? 'Joriy tarif' : 'Sotib olish',
      recommended: false
    }
  ];

  const handlePurchase = (tier) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (tier === 'free') return;

    // Здесь будет интеграция с Click/Payme
    // Пока — имитация
    alert(`${plans.find(p => p.tier === tier).name} tarifi sotib olinmoqda...\nTez orada toʻlov tizimi ulanadi! 🚀`);
    
    // Пример будущего вызова:
    // initiatePayment(tier, plans.find(p => p.tier === tier).price);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50 dark:from-black dark:via-gray-900 dark:to-purple-950 py-16 px-6">
      <div className="max-w-7xl mx-auto">

        {/* Заголовок */}
        <div className="text-center mb-16">
          <h1 className="text-6xl md:text-8xl font-black mb-6">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-pink-600">
              Premium Obuna
            </span>
          </h1>
          <p className="text-2xl md:text-3xl text-gray-700 dark:text-gray-300 max-w-4xl mx-auto">
            O'zingizga mos tarifni tanlang va cheksiz bilim oling. Reklamasiz, to'liq va qulay!
          </p>
        </div>

        {/* Тарифы */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {plans.map((plan) => (
            <div
              key={plan.tier}
              className={`relative rounded-3xl shadow-2xl overflow-hidden transition-all duration-500 hover:scale-105 ${
                plan.recommended ? 'ring-4 ring-yellow-400 ring-offset-4 ring-offset-transparent' : ''
              }`}
            >
              {/* Рекомендуемый бейдж */}
              {plan.recommended && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-10">
                  <div className="px-8 py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-black text-xl rounded-full shadow-xl">
                    TAVSIYA ETILADI
                  </div>
                </div>
              )}

              <div className={`h-full bg-gradient-to-br ${plan.color} p-10 flex flex-col`}>
                <div className="text-center mb-8">
                  <h3 className="text-4xl md:text-5xl font-black mb-2">{plan.name}</h3>
                  <p className="text-xl opacity-90">{plan.enName}</p>
                </div>

                <div className="text-center mb-10 flex-1">
                  {plan.price === 0 ? (
                    <div className="text-5xl md:text-6xl font-black">Bepul</div>
                  ) : (
                    <div>
                      <span className="text-5xl md:text-6xl font-black">
                        {plan.price.toLocaleString()}
                      </span>
                      <span className="text-2xl ml-2">UZS/{plan.period}</span>
                    </div>
                  )}
                </div>

                <ul className="space-y-4 mb-12 flex-1">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-4 text-lg">
                      <span className="text-3xl">✅</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handlePurchase(plan.tier)}
                  disabled={currentTier === plan.tier}
                  className={`w-full py-6 rounded-2xl text-2xl font-black transition ${
                    currentTier === plan.tier
                      ? 'bg-white/30 cursor-not-allowed'
                      : 'bg-white text-black hover:bg-gray-100 shadow-xl hover:shadow-2xl'
                  }`}
                >
                  {plan.buttonText}
                </button>

                {currentTier === plan.tier && (
                  <p className="text-center mt-4 text-lg opacity-80">
                    Sizda faol tarif ✨
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Дополнительная информация */}
        <div className="text-center mt-20">
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-6">
            Toʻlov tizimlari: <strong>Click</strong>, <strong>Payme</strong>, <strong>Uzcard</strong>, <strong>Humo</strong>
          </p>
          <p className="text-lg text-gray-500 dark:text-gray-500">
            Savollaringiz bo'lsa — <NavLink to="/support" className="text-indigo-600 dark:text-indigo-400 underline">yordam</NavLink> ga murojaat qiling
          </p>
        </div>

        {/* Призыв к действию для неавторизованных */}
        {!isAuthenticated && (
          <div className="text-center mt-16">
            <p className="text-2xl mb-6 text-gray-700 dark:text-gray-300">
              Premium sotib olish uchun avval ro'yxatdan o'ting
            </p>
            <NavLink
              to="/register"
              className="inline-block px-12 py-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-2xl font-bold rounded-full shadow-2xl hover:scale-110 transition"
            >
              Ro'yxatdan o'tish →
            </NavLink>
          </div>
        )}
      </div>
    </div>
  );
};

export default Premium;