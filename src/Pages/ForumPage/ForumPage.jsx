import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/ReactContext';

// 🔥 ПРАВИЛЬНЫЙ ИМПОРТ — объект по умолчанию
import premiumManager from '../../Utils/premiumManager';

const ForumPage = () => {
  const { isAuthenticated, userData } = useAuth();
  const navigate = useNavigate();

  const [premiumInfo, setPremiumInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  // Загружаем Premium информацию пользователя
  useEffect(() => {
    const loadPremiumInfo = async () => {
      if (!isAuthenticated || !userData?.profile?.id) {
        setPremiumInfo({ is_premium: false });
        return;
      }

      try {
        const info = await premiumManager.getPremiumInfo(userData.profile.id);
        setPremiumInfo(info);
      } catch (error) {
        console.error('Ошибка загрузки Premium информации:', error);
        setPremiumInfo({ is_premium: false });
      }
    };

    loadPremiumInfo();
  }, [isAuthenticated, userData]);

  // Тарифные планы
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
      tier: 'monthly',
      name: 'Oylik',
      enName: 'Monthly',
      price: 49000,
      days: 30,
      features: [
        'Barcha bepul kurslar',
        'Premium kurslarga kirish',
        'Reklamasiz tajriba',
        'Toʻliq sertifikatlar',
        'Tezroq yuklanish',
        'Prioritet yordam',
        'Har oy avtomatik yangilanish'
      ],
      color: 'from-blue-500 to-indigo-600',
      textColor: 'text-white',
      buttonText: 'Sotib olish',
      recommended: true
    },
    {
      tier: 'yearly',
      name: 'Yillik',
      enName: 'Yearly',
      price: 299000,
      days: 365,
      discount: '-49%',
      features: [
        'Barcha kurslar (100%)',
        'Reklamasiz',
        'Maxsus badge profilida 🔥',
        'Yuklab olish imkoniyati',
        'Eksklyuziv materiallar',
        'Tezkor yordam 24/7',
        '2 oy bepul (savings)'
      ],
      color: 'from-orange-500 to-red-600',
      textColor: 'text-white',
      buttonText: 'Sotib olish',
      recommended: false
    }
  ];

  // Обработка покупки
  const handlePurchase = async (plan) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (plan.tier === 'free') return;

    setLoading(true);

    try {
      const confirmPurchase = window.confirm(
        `Siz ${plan.name} tarifini sotib olmoqchisiz?\n\n` +
        `Narxi: ${plan.price.toLocaleString()} UZS\n` +
        `Davomiylik: ${plan.days} kun\n\n` +
        `"OK" bosilsa, to'lov sahifasiga o'tasiz.`
      );

      if (!confirmPurchase) {
        setLoading(false);
        return;
      }

      const transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const paymentWindow = window.open('', 'payment', 'width=500,height=600');

      if (paymentWindow) {
        paymentWindow.document.write(`
          <html>
            <head>
              <title>To'lov - EduHelperUZ</title>
              <style>
                body { font-family: -apple-system, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
                .container { background: white; padding: 30px; border-radius: 20px; text-align: center; max-width: 400px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
                h2 { color: #333; margin-bottom: 20px; }
                .amount { font-size: 48px; font-weight: bold; color: #667eea; margin: 20px 0; }
                .loader { border: 4px solid #f3f3f3; border-top: 4px solid #667eea; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 30px auto; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                .success { font-size: 60px; color: #4CAF50; margin: 20px 0; }
              </style>
            </head>
            <body>
              <div class="container">
                <h2>To'lov amalga oshirilmoqda...</h2>
                <div class="loader"></div>
                <p>Iltimos, kuting...</p>
              </div>
              <script>
                setTimeout(() => {
                  document.querySelector('.container').innerHTML = \`
                    <div class="success">✅</div>
                    <h2>To'lov muvaffaqiyatli!</h2>
                    <p>Premium obuna faollashtirildi.</p>
                    <p style="color: #666; margin-top: 20px;">Oyna 3 soniyada yopiladi.</p>
                  \`;
                  window.opener.postMessage({
                    type: 'PAYMENT_SUCCESS',
                    transactionId: '${transactionId}',
                    plan: '${plan.tier}'
                  }, '*');
                  setTimeout(() => window.close(), 3000);
                }, 3000);
              </script>
            </body>
          </html>
        `);
      }

      // Обработчик успешного платежа
      const handlePaymentMessage = async (event) => {
        if (event.data.type === 'PAYMENT_SUCCESS') {
          window.removeEventListener('message', handlePaymentMessage);

          try {
            await premiumManager.activatePremium(userData.profile.id, {
              days: plan.days,
              type: plan.tier,
              transactionId: event.data.transactionId
            });

            const updatedInfo = await premiumManager.getPremiumInfo(userData.profile.id);
            setPremiumInfo(updatedInfo);

            alert(`Tabriklaymiz! ${plan.name} Premium obunangiz faollashtirildi! 🎉`);
            navigate('/courses');
          } catch (error) {
            console.error('Ошибка активации Premium:', error);
            alert('Premium faollashtirishda xatolik. Texnik yordamga murojaat qiling.');
          } finally {
            setLoading(false);
          }
        }
      };

      window.addEventListener('message', handlePaymentMessage);

    } catch (error) {
      console.error('Ошибка покупки Premium:', error);
      alert(`Xatolik: ${error.message || 'Nomaʼlum xatolik'}`);
      setLoading(false);
    }
  };

  // Текущий статус Premium
  const renderCurrentStatus = () => {
    if (!premiumInfo) return null;

    if (premiumInfo.is_premium && premiumInfo.days_left > 0) {
      return (
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-3xl p-8 mb-12 text-center shadow-2xl">
          <div className="text-5xl mb-4">🎉</div>
          <h3 className="text-3xl font-black mb-2">Sizda Premium obuna faol!</h3>
          <p className="text-xl">
            Tugash sanasi: {premiumInfo.formatted_until || new Date(premiumInfo.premium_until).toLocaleDateString('uz-UZ')}
            <span className="font-bold ml-2">({premiumInfo.days_left} kun qoldi)</span>
          </p>
          {premiumInfo.premium_type && (
            <p className="text-lg mt-3 opacity-90">
              Tur: <strong>{premiumInfo.premium_type.toUpperCase()}</strong>
            </p>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50 dark:from-black dark:via-gray-900 dark:to-purple-950 py-16 px-6">
      <div className="max-w-7xl mx-auto">

        <div className="text-center mb-12">
          <h1 className="text-6xl md:text-8xl font-black mb-6">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-pink-600">
              Premium Obuna
            </span>
          </h1>
          <p className="text-2xl md:text-3xl text-gray-700 dark:text-gray-300 max-w-4xl mx-auto">
            O'zingizga mos tarifni tanlang va cheksiz bilim oling. Reklamasiz, to'liq va qulay!
          </p>
        </div>

        {renderCurrentStatus()}

        {loading && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-10 text-center shadow-2xl">
              <div className="w-20 h-20 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
              <p className="text-2xl font-bold">To'lov amalga oshirilmoqda...</p>
              <p className="text-gray-600 dark:text-gray-400 mt-2">Iltimos, kuting</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {plans.map((plan) => {
            const isCurrentPlan = premiumInfo?.premium_type === plan.tier && premiumInfo?.is_premium;

            return (
              <div
                key={plan.tier}
                className={`relative rounded-3xl shadow-2xl overflow-hidden transition-all duration-500 hover:scale-105 ${
                  plan.recommended ? 'ring-4 ring-yellow-400 ring-offset-4' : ''
                }`}
              >
                {plan.discount && (
                  <div className="absolute -top-3 -right-3 z-10">
                    <div className="px-6 py-2 bg-gradient-to-r from-red-500 to-pink-600 text-white font-bold rounded-full shadow-xl rotate-12">
                      {plan.discount}
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
                        <span className="text-2xl ml-2">UZS</span>
                        {plan.days && <p className="text-lg mt-2 opacity-90">{plan.days} kun</p>}
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
                    onClick={() => handlePurchase(plan)}
                    disabled={loading || isCurrentPlan}
                    className={`w-full py-6 rounded-2xl text-2xl font-black transition ${
                      isCurrentPlan
                        ? 'bg-white/30 cursor-not-allowed'
                        : 'bg-white text-black hover:bg-gray-100 shadow-xl hover:shadow-2xl hover:scale-105'
                    }`}
                  >
                    {isCurrentPlan ? 'Faol tarif' : plan.buttonText}
                  </button>

                  {isCurrentPlan && (
                    <p className="text-center mt-4 text-lg opacity-80">
                      Sizda faol tarif ✨
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Дополнительные преимущества, FAQ и т.д. — оставляем без изменений */}
        <div className="mt-16 p-8 bg-white/10 dark:bg-white/5 backdrop-blur-lg rounded-3xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl mb-4">✅</div>
              <h4 className="text-2xl font-bold mb-2">Har qanday vaqtda bekor qilish</h4>
              <p className="text-gray-600 dark:text-gray-400">Obunani istalgan vaqtda to'xtatish mumkin</p>
            </div>
            <div>
              <div className="text-4xl mb-4">💳</div>
              <h4 className="text-2xl font-bold mb-2">To'lov tizimlari</h4>
              <p className="text-gray-600 dark:text-gray-400">Click, Payme, Uzcard, Humo</p>
            </div>
            <div>
              <div className="text-4xl mb-4">🔄</div>
              <h4 className="text-2xl font-bold mb-2">30 kunlik kafolat</h4>
              <p className="text-gray-600 dark:text-gray-400">Agar yoqmasa, pulingizni qaytaramiz</p>
            </div>
          </div>
        </div>

        <div className="mt-16">
          <h3 className="text-4xl font-bold text-center mb-8">Ko'p beriladigan savollar</h3>
          <div className="space-y-4 max-w-3xl mx-auto">
            {[
              { q: "Premium sotib olsam, barcha kurslarga kirish huquqim bo'ladimi?", a: "Ha, Premium obuna bilan barcha kurslar sizga ochiq bo'ladi." },
              { q: "To'lov qanday amalga oshiriladi?", a: "Click, Payme, Uzcard yoki Humo orqali xavfsiz to'lov." },
              { q: "Obunani qanday bekor qilsam bo'ladi?", a: "Profil → Sozlamalar → Premium → 'Obunani bekor qilish'" },
              { q: "Bepul tarifda reklama bo'ladimi?", a: "Hozircha yo'q. Kelajakda minimal reklama bo'lishi mumkin." }
            ].map((faq, i) => (
              <div key={i} className="bg-white/10 dark:bg-white/5 rounded-2xl p-6 hover:bg-white/20 transition">
                <h4 className="text-xl font-bold mb-2">{faq.q}</h4>
                <p className="text-gray-600 dark:text-gray-400">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

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

        <div className="text-center mt-12 pt-8 border-t border-gray-300 dark:border-gray-700">
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
            Savollaringiz bo'lsa — texnik yordamga murojaat qiling
          </p>
          <div className="flex justify-center gap-6">
            <NavLink to="/support" className="px-8 py-3 bg-blue-600 text-white rounded-full font-bold hover:bg-blue-700 transition">
              Yordam markazi
            </NavLink>
            <NavLink to="/contact" className="px-8 py-3 bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-full font-bold hover:bg-gray-300 dark:hover:bg-gray-700 transition">
              Bog'lanish
            </NavLink>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ForumPage;