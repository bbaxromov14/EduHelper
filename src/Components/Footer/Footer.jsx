import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const Footer = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState({
    totalStudents: 334,
    totalCourses: 0,
    totalLessons: 0,
    premiumUsers: 0,
    certificatesIssued: 0
  });

  const [recentCourses, setRecentCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [referralLink, setReferralLink] = useState('');
  const [referralStats, setReferralStats] = useState({
    total: 0,
    completed: 0,
    pending: 0,
    earnedMonths: 0
  });
  const [copySuccess, setCopySuccess] = useState('');

  // Функция загрузки статистики рефералов
  const loadReferralStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      // Загружаем сохраненный код из localStorage
      const savedCode = localStorage.getItem(`referral_code_${user.id}`);
      if (savedCode) {
        const link = `${window.location.origin}/login?ref=${savedCode}`;
        setReferralLink(link);
      }

      // Пока просто заглушка - статистика будет позже

    } catch (error) {
      console.error(t('referral_stats_error') || "Ошибка загрузки статистики рефералов:", error);
    }
  };

  const saveReferralCode = async (code) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      // Сохраняем реферальный код
      localStorage.setItem(`referral_code_${user.id}`, code);

    } catch (error) {
      console.error(t('referral_save_error') || "Ошибка сохранения реферального кода:", error);
    }
  };

  const generateReferralLink = async () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const link = `${window.location.origin}/login?ref=${code}`;
    setReferralLink(link);
    await saveReferralCode(code);
  };

  const copyToClipboard = () => {
    if (!referralLink) return;

    navigator.clipboard.writeText(referralLink)
      .then(() => {
        setCopySuccess(t('copied') || 'Скопировано!');
        setTimeout(() => setCopySuccess(''), 3000);
      })
      .catch(err => {
        console.error(t('copy_error') || "Ошибка копирования:", err);
        setCopySuccess(t('copy_failed') || 'Ошибка копирования');
      });
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // Загружаем статистику рефералов
        await loadReferralStats();

        // Количество студентов (из profiles)
        const { count: studentsCount } = await supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true });

        // Количество курсов
        const { count: coursesCount } = await supabase
          .from('courses')
          .select('id', { count: 'exact', head: true })
          .eq('is_published', true);

        // Общее количество уроков
        const { data: allCourses } = await supabase
          .from('courses')
          .select('lesson_count')
          .eq('is_published', true);

        const totalLessons = allCourses?.reduce((sum, c) => sum + (c.lesson_count || 0), 0) || 0;

        // Последние 3 курса
        const { data: recentData } = await supabase
          .from('courses')
          .select('id, title, lesson_count, is_free')
          .eq('is_published', true)
          .order('created_at', { ascending: false })
          .limit(3);

        setRecentCourses(recentData || []);

        // Обновляем общую статистику
        setStats({
          totalStudents: studentsCount || 334,
          totalCourses: coursesCount || 0,
          totalLessons: totalLessons,
          premiumUsers: 0,
          certificatesIssued: 0
        });

      } catch (error) {
        console.error(t('footer_load_error') || "Footer yuklashda xato:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Realtime обновление курсов
    const channel = supabase
      .channel('footer-courses')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'courses' }, loadData)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [t]);

  if (loading) {
    return (
      <footer className="bg-gradient-to-b from-gray-900 via-black to-gray-900 text-white py-8">
        <div className="text-center">{t('loading') || 'Yuklanmoqda...'}</div>
      </footer>
    );
  }

  return (
    <footer className="relative bg-gradient-to-b from-gray-900 via-black to-gray-900 text-white overflow-hidden">
      <div className="absolute inset-0 opacity-30">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 blur-3xl animate-pulse"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Бренд + рефералка + соцсети */}
          <div className="space-y-6 lg:col-span-2">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 bg-gradient-to-br from-[#0AB685] to-[#1855D4] rounded-2xl flex items-center justify-center text-2xl font-bold shadow-2xl animate-pulse">
                EH
              </div>
              <div>
                <h1 className="text-4xl font-black bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  EduHelper<span className="text-xs ml-1 bg-gradient-to-r from-[#0AB685] to-[#1855D4] bg-clip-text text-transparent">Uz</span>
                </h1>
                <p className="text-sm text-gray-400 mt-1">{t('platform_subtitle') || 'Next Generation Learning Platform'}</p>
              </div>
            </div>

            <p className="text-gray-300 text-lg leading-relaxed max-w-xs">
              {t('footer_motto') || 'Biz bilan bilim olish — bu '}<span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 font-bold">{t('lifestyle') || 'hayot tarziga'}</span> {t('becomes') || 'aylanadi'}
            </p>

            <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 p-4 rounded-xl border border-purple-500/20">
              <h5 className="font-bold text-white mb-2">📢 {t('invite_friends') || 'Do\'stlaringizni taklif qiling!'}</h5>
              <p className="text-sm text-gray-300 mb-2">
                20 {t('friends') || 'do\'st'} — 1 {t('month_premium') || 'oy Premium'} <br />
                50 {t('friends') || 'do\'st'} — 3 {t('months_premium') || 'oy Premium'} <br />
                100 {t('friends') || 'do\'st'} — 1 {t('year_premium') || 'yil Premium'}
              </p>

              {/* РЕФЕРАЛЬНАЯ ССЫЛКА */}
              {referralLink ? (
                <div className="mt-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={referralLink}
                      readOnly
                      className="flex-1 bg-gray-800 text-white text-sm p-2 rounded"
                    />
                    <button
                      onClick={copyToClipboard}
                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded transition-all duration-300"
                    >
                      {copySuccess || t('copy_button') || 'Copy'}
                    </button>
                  </div>
                  {copySuccess && (
                    <p className={`text-xs mt-1 ${copySuccess.includes(t('error') || 'Ошибка') ? 'text-red-400' : 'text-green-400'}`}>
                      {copySuccess}
                    </p>
                  )}
                </div>
              ) : (
                <button
                  onClick={generateReferralLink}
                  className="text-sm bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-4 py-2 rounded-lg transition-all duration-300"
                >
                  {t('get_referral_link') || 'Referral Link olish'}
                </button>
              )}

              {/* Статистика рефералов (если есть) */}
              {referralStats.total > 0 && (
                <div className="mt-3 text-xs text-gray-400">
                  {t('invited') || 'Taklif qilingan'}: {referralStats.completed}/{referralStats.total}
                  <br />
                  {t('earned_premium') || 'Olingan Premium'}: {referralStats.earnedMonths} {t('months') || 'oy'}
                </div>
              )}
            </div>

            {/* 4 соцсети */}
            <div className="flex gap-4">
              <a href="https://www.instagram.com/b_bahromoov/" target="_blank" rel="noopener noreferrer" className="group w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center hover:scale-110 hover:rotate-6 transition-all duration-300 shadow-lg">
                <span className="text-2xl group-hover:animate-bounce">I</span>
              </a>
              <a href="https://t.me/eduhelperuz" target="_blank" rel="noopener noreferrer" className="group w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center hover:scale-110 hover:-rotate-6 transition-all duration-300 shadow-lg">
                <span className="text-2xl group-hover:animate-bounce">T</span>
              </a>
              <a href="#" className="group w-12 h-12 bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl flex items-center justify-center hover:scale-110 hover:rotate-6 transition-all duration-300 shadow-lg">
                <span className="text-2xl group-hover:animate-bounce">in</span>
              </a>
              <a href="#" className="group w-12 h-12 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl flex items-center justify-center hover:scale-110 hover:-rotate-6 transition-all duration-300 shadow-lg">
                <span className="text-2xl group-hover:animate-bounce">YT</span>
              </a>
            </div>
          </div>

          {/* Tezkor Havolalar */}
          <div>
            <h4 className="text-xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
              {t('quick_links') || 'Tezkor Havolalar'}
            </h4>
            <div className="space-y-3">
              {[
                { name: t('home') || 'Home', path: '/' },
                { name: t('courses') || 'Courses', path: '/subjects' },
                { name: t('forum') || 'Forum', path: '/forum' },
                { name: t('progress') || 'Progress', path: '/progress' },
                { name: t('achievements') || 'Achievements', path: '/achievements' },
                { name: t('premium') || 'Premium', path: '/premium' }
              ].map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className="block text-gray-300 hover:text-white hover:translate-x-2 transition-all duration-300 flex items-center gap-2"
                >
                  <span className="text-purple-400">→</span> {item.name}
                </NavLink>
              ))}
            </div>
          </div>

          {/* Yangi Kurslar */}
          <div>
            <h4 className="text-xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-400">
              {t('new_courses') || 'Yangi Kurslar'}
            </h4>
            <div className="space-y-4">
              {recentCourses.length > 0 ? (
                recentCourses.map(course => (
                  <div key={course.id} className="bg-white/5 backdrop-blur-sm rounded-lg p-3 border border-white/10 hover:border-purple-500/50 transition-all duration-300">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-teal-500 rounded-lg flex items-center justify-center text-xs font-bold">
                        {t('new') || 'New'}
                      </div>
                      <div>
                        <h5 className="font-medium text-white">{course.title}</h5>
                        <p className="text-xs text-gray-400 mt-1">
                          {course.is_free ? t('free') || '🆓 Bepul' : t('premium') || '⭐ Premium'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-gray-400 text-sm">{t('courses_loading') || 'Kurslar yuklanmoqda...'}</div>
              )}
            </div>

            {/* Mobil Ilova */}
            <div className="mt-6 bg-gradient-to-r from-blue-900/30 to-purple-900/30 p-4 rounded-xl border border-blue-500/20">
              <h5 className="font-bold text-white mb-2">📱 {t('mobile_app') || 'Mobil Ilova'}</h5>
              <p className="text-sm text-gray-300 mb-2">
                {t('coming_soon') || 'Tez orada App Store va Google Play\'da!'}
              </p>
              <div className="flex gap-2">
                <button className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg transition-all duration-300 flex-1">
                  iOS
                </button>
                <button className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg transition-all duration-300 flex-1">
                  Android
                </button>
              </div>
            </div>
          </div>

          {/* Qo'llab-quvvatlash + статистика */}
          <div>
            <h4 className="text-xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
              {t('support_us') || 'Bizni Qo\'llab-quvvatlang'}
            </h4>

            <NavLink to="/donate">
              <button className="group relative w-full px-8 py-4 bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 text-white font-bold rounded-2xl shadow-2xl hover:shadow-orange-500/50 transform hover:scale-105 transition-all duration-300 overflow-hidden mb-6">
                <span className="relative z-10 flex items-center justify-center gap-3">
                  {t('donate') || 'Donate qilish'}
                  <span className="text-2xl group-hover:animate-ping">❤️</span>
                </span>
                <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
              </button>
            </NavLink>

            <p className="text-gray-300 mb-4 leading-relaxed text-sm">
              {t('donation_impact') || 'Har bir donatsiya — yangi darslik, test va imkoniyatlar yaratishga yordam beradi.'}
            </p>

            <div className="mb-6">
              <h5 className="text-sm font-medium text-white mb-2">{t('payment_systems') || 'To\'lov tizimlari:'}</h5>
              <div className="flex flex-wrap gap-2">
                <div className="px-3 py-1 bg-green-900/30 text-green-400 rounded-lg text-xs border border-green-500/20">Payme</div>
                <div className="px-3 py-1 bg-blue-900/30 text-blue-400 rounded-lg text-xs border border-blue-500/20">Click</div>
                <div className="px-3 py-1 bg-purple-900/30 text-purple-400 rounded-lg text-xs border border-purple-500/20">Uzcard</div>
                <div className="px-3 py-1 bg-yellow-900/30 text-yellow-400 rounded-lg text-xs border border-yellow-500/20">Humo</div>
              </div>
            </div>

            {/* Статистика */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 text-center border border-white/10">
                <div className="text-2xl font-black text-green-400">
                  {stats.totalStudents.toLocaleString()}+
                </div>
                <div className="text-gray-400 text-xs">{t('students') || 'O\'quvchi'}</div>
              </div>
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 text-center border border-white/10">
                <div className="text-2xl font-black text-blue-400">
                  {stats.totalCourses}+
                </div>
                <div className="text-gray-400 text-xs">{t('courses') || 'Kurslar'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Нижняя часть */}
        <div className="mt-16 pt-8 border-t border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-center md:text-left">
              <p className="text-gray-400 text-lg">
                © 2025 <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-yellow-500 font-bold">EduHelper</span>.
                {t('made_with_love') || ' Made with '}<span className="text-red-500 animate-pulse">❤️</span>{t('for_education') || ' for education'}
              </p>
              <p className="text-gray-500 text-sm mt-2">
                {t('every_child_deserves') || 'Har bir bola o\'qishga loyiq. Biz shu yo\'lda birgamiz.'}
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-6">
              <NavLink to="/page/maxfiylik" className="text-gray-400 hover:text-white text-sm transition-colors duration-300">
                {t('privacy_policy') || 'Maxfiylik siyosati'}
              </NavLink>
              <NavLink to="/page/foydalanish" className="text-gray-400 hover:text-white text-sm transition-colors duration-300">
                {t('terms_of_use') || 'Foydalanish shartlari'}
              </NavLink>
              <NavLink to="/page/faq" className="text-gray-400 hover:text-white text-sm transition-colors duration-300">
                {t('faq') || 'Savol-Javob'}
              </NavLink>
              <NavLink to="/page/support" className="text-gray-400 hover:text-white text-sm transition-colors duration-300">
                {t('technical_support') || 'Texnik yordam'}
              </NavLink>
            </div>
          </div>

          <div className="mt-6 text-center">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-900/30 to-purple-900/30 px-4 py-2 rounded-full border border-blue-500/20">
              <span className="text-yellow-400">{t('by_bahromov') || 'by bahromov'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent"></div>
    </footer>
  );
};

export default Footer;