import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { motion } from 'framer-motion';

const Referrals = () => {
    const [user, setUser] = useState(null);
    const [referralCode, setReferralCode] = useState('');
    const [referralLink, setReferralLink] = useState('');
    const [referralStats, setReferralStats] = useState({
        total: 0,
        completed: 0,
        pending: 0,
        earnedMonths: 0
    });
    const [referralsList, setReferralsList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [copySuccess, setCopySuccess] = useState('');

    useEffect(() => {
        loadReferralData();
    }, []);

    const loadReferralData = async () => {
        try {
            setLoading(true);

            // Получаем текущего пользователя
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (!authUser) {
                window.location.href = '/login';
                return;
            }

            setUser(authUser);

            // ЗАМЕНИТЕ ЭТОТ БЛОК (строки 38-45):
            // Загружаем реферальный код пользователя
            const { data: codeData } = await supabase
                .from('referral_codes')
                .select('code')
                .eq('user_id', authUser.id)
                .eq('is_active', true)
                .maybeSingle(); // ← ИСПРАВЛЕНО

            // ДОБАВЬТЕ ЭТУ ЛОГИКУ:
            if (codeData) {
                setReferralCode(codeData.code);
                setReferralLink(`${window.location.origin}/login?ref=${codeData.code}`);
            } else {
                // Если кода нет - показываем кнопку создания
                setReferralCode('');
                setReferralLink('');
            }

            // Загружаем статистику рефералов
            await loadReferralStats(authUser.id);

            // Загружаем список рефералов
            await loadReferralsList(authUser.id);

        } catch (error) {
            console.error('Ошибка загрузки данных рефералов:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadReferralStats = async (userId) => {
        try {
            // Статистика из таблицы referrals
            const { data: referrals } = await supabase
                .from('referrals')
                .select('status')
                .eq('referrer_id', userId);

            if (referrals) {
                const total = referrals.length;
                const completed = referrals.filter(r => r.status === 'completed').length;
                const pending = referrals.filter(r => r.status === 'pending').length;

                setReferralStats({
                    total,
                    completed,
                    pending,
                    earnedMonths: Math.floor(completed / 20) // 1 месяц за 20 рефералов
                });
            }
        } catch (error) {
            console.error('Ошибка загрузки статистики:', error);
        }
    };

    const loadReferralsList = async (userId) => {
        try {
            const { data } = await supabase
                .from('referrals')
                .select(`
          id,
          referred_email,
          status,
          created_at,
          completed_at
        `)
                .eq('referrer_id', userId)
                .order('created_at', { ascending: false });

            setReferralsList(data || []);
        } catch (error) {
            console.error('Ошибка загрузки списка рефералов:', error);
        }
    };

    const generateNewCode = async () => {
        try {
            // Проверка пользователя
            if (!user || !user.id) {
                alert('❌ Пользователь не найден. Попробуйте войти заново.');
                return;
            }

            const code = Math.random().toString(36).substring(2, 8).toUpperCase();

            // Удаляем старый код (если есть)
            await supabase
                .from('referral_codes')
                .delete()
                .eq('user_id', user.id);

            // Создаем новый код
            const { error } = await supabase
                .from('referral_codes')
                .insert({
                    user_id: user.id,
                    code: code,
                    is_active: true,
                    created_at: new Date().toISOString()
                });

            if (error) throw error;

            // Обновляем состояние
            setReferralCode(code);
            setReferralLink(`${window.location.origin}/login?ref=${code}`);

            // Обновляем localStorage
            localStorage.setItem(`referral_code_${user.id}`, code);

            alert('✅ Новый реферальный код создан!');

            // Обновляем страницу через секунду
            setTimeout(() => {
                window.location.reload();
            }, 1000);

        } catch (error) {
            console.error('Ошибка генерации кода:', error);
            alert('❌ Ошибка создания кода. Попробуйте еще раз');
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(referralLink)
            .then(() => {
                setCopySuccess('Скопировано!');
                setTimeout(() => setCopySuccess(''), 3000);
            })
            .catch(err => {
                console.error('Ошибка копирования:', err);
                setCopySuccess('Ошибка копирования');
            });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-indigo-600 mx-auto"></div>
                    <p className="mt-4 text-gray-300">Загрузка...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
            <div className="max-w-6xl mx-auto px-4 py-12">
                {/* Заголовок */}
                <div className="text-center mb-12">
                    <h1 className="text-5xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent mb-4">
                        Referral System
                    </h1>
                    <p className="text-gray-400 text-lg">
                        Taklif qilingan har 20 do'st uchun 1 oy Premium beriladi!
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Левая колонка: Статистика и ссылка */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Статистика */}
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 border border-gray-700"
                        >
                            <h2 className="text-2xl font-bold mb-6 text-white">Sizning statistikangiz</h2>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                <div className="text-center p-6 bg-gray-800/50 rounded-xl">
                                    <div className="text-4xl font-bold text-green-400">{referralStats.total}</div>
                                    <div className="text-gray-400 text-sm mt-2">Jami taklif</div>
                                </div>

                                <div className="text-center p-6 bg-gray-800/50 rounded-xl">
                                    <div className="text-4xl font-bold text-blue-400">{referralStats.completed}</div>
                                    <div className="text-gray-400 text-sm mt-2">Ro'yxatdan o'tgan</div>
                                </div>

                                <div className="text-center p-6 bg-gray-800/50 rounded-xl">
                                    <div className="text-4xl font-bold text-yellow-400">{referralStats.pending}</div>
                                    <div className="text-gray-400 text-sm mt-2">Kutilayotgan</div>
                                </div>

                                <div className="text-center p-6 bg-gray-800/50 rounded-xl">
                                    <div className="text-4xl font-bold text-purple-400">{referralStats.earnedMonths}</div>
                                    <div className="text-gray-400 text-sm mt-2">Oylik Premium</div>
                                </div>
                            </div>

                            {/* Прогресс бар */}
                            <div className="mt-8">
                                <div className="flex justify-between text-sm text-gray-400 mb-2">
                                    <span>Keyingi Premium uchun: {20 - (referralStats.completed % 20)} do'st</span>
                                    <span>{Math.floor((referralStats.completed % 20) / 20 * 100)}%</span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-4">
                                    <div
                                        className="bg-gradient-to-r from-green-500 to-emerald-500 h-4 rounded-full transition-all duration-500"
                                        style={{ width: `${(referralStats.completed % 20) / 20 * 100}%` }}
                                    />
                                </div>
                            </div>
                        </motion.div>

                        {/* Список рефералов */}
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.1 }}
                            className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 border border-gray-700"
                        >
                            <h2 className="text-2xl font-bold mb-6 text-white">Taklif qilingan do'stlar</h2>

                            {referralsList.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-gray-700">
                                                <th className="py-3 text-left text-gray-400">Email</th>
                                                <th className="py-3 text-left text-gray-400">Holati</th>
                                                <th className="py-3 text-left text-gray-400">Sana</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {referralsList.map((ref) => (
                                                <tr key={ref.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                                                    <td className="py-4">{ref.referred_email}</td>
                                                    <td className="py-4">
                                                        <span className={`px-3 py-1 rounded-full text-xs ${ref.status === 'completed'
                                                            ? 'bg-green-900/30 text-green-400'
                                                            : 'bg-yellow-900/30 text-yellow-400'
                                                            }`}>
                                                            {ref.status === 'completed' ? 'Ro\'yxatdan o\'tgan' : 'Kutilmoqda'}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 text-gray-400">
                                                        {new Date(ref.created_at).toLocaleDateString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <div className="text-6xl mb-4">👥</div>
                                    <p className="text-gray-400">Siz hali hech kimni taklif qilmagansiz</p>
                                    <p className="text-sm text-gray-500 mt-2">Do'stlaringizni taklif qilish uchun quyidagi linkdan foydalaning</p>
                                </div>
                            )}
                        </motion.div>
                    </div>

                    {/* Правая колонка: Ссылка и инструкции */}
                    <div className="space-y-8">
                        {/* Реферальная ссылка */}
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-2xl p-8 border border-purple-500/20"
                        >
                            <h2 className="text-2xl font-bold mb-4 text-white">Sizning referral havolangiz</h2>

                            <div className="mb-6">
                                <label className="block text-gray-400 text-sm mb-2">Referral kodingiz:</label>
                                <div className="flex items-center">
                                    <div className="flex-1 bg-gray-800 text-white p-3 rounded-l-lg border border-gray-700">
                                        {referralCode || 'Kod mavjud emas'}
                                    </div>
                                    <button
                                        onClick={generateNewCode}
                                        className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-6 py-3 rounded-r-lg transition"
                                    >
                                        Yangi kod
                                    </button>
                                </div>
                            </div>

                            <div className="mb-6">
                                <label className="block text-gray-400 text-sm mb-2">Havola:</label>
                                {referralLink ? (
                                    <div className="space-y-3">
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={referralLink}
                                                readOnly
                                                className="flex-1 bg-gray-800 text-white text-sm p-3 rounded-lg border border-gray-700"
                                            />
                                            <button
                                                onClick={copyToClipboard}
                                                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-3 rounded-lg transition"
                                            >
                                                {copySuccess || 'Copy'}
                                            </button>
                                        </div>
                                        {copySuccess && (
                                            <p className={`text-sm ${copySuccess.includes('Ошибка') ? 'text-red-400' : 'text-green-400'}`}>
                                                {copySuccess}
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-gray-400 text-sm">Havola yaratish uchun kod yarating</p>
                                )}
                            </div>

                            <button
                                onClick={() => {
                                    const text = `🎓 EduHelper platformasida bilim olishni boshlang! ${referralLink}`;
                                    window.open(`https://t.me/share/url?url=${encodeURIComponent(text)}`, '_blank');
                                }}
                                className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white py-3 rounded-lg font-medium transition mb-3"
                            >
                                📢 Telegramda ulashish
                            </button>
                        </motion.div>

                        {/* Инструкции */}
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 border border-gray-700"
                        >
                            <h3 className="text-xl font-bold mb-4 text-white">Qanday ishlaydi?</h3>

                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-sm font-bold">1</div>
                                    <div>
                                        <h4 className="font-medium">Havolani ulashing</h4>
                                        <p className="text-sm text-gray-400">Do'stlaringizga yuqoridagi havolani yuboring</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-sm font-bold">2</div>
                                    <div>
                                        <h4 className="font-medium">Do'stlaringiz ro'yxatdan o'tsin</h4>
                                        <p className="text-sm text-gray-400">Ular sizning havolangiz orqali ro'yxatdan o'tishadi</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-sm font-bold">3</div>
                                    <div>
                                        <h4 className="font-medium">Mukofotlarni oling</h4>
                                        <p className="text-sm text-gray-400">Har 20 ta ro'yxatdan o'tgan do'st uchun 1 oylik Premium</p>
                                    </div>
                                </div>
                            </div>

                            {/* Таблица наград */}
                            <div className="mt-8">
                                <h4 className="font-bold mb-3 text-white">Mukofotlar:</h4>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center p-3 bg-gray-800/50 rounded-lg">
                                        <span className="text-gray-300">20 do'st</span>
                                        <span className="font-bold text-green-400">1 oy Premium</span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-gray-800/50 rounded-lg">
                                        <span className="text-gray-300">50 do'st</span>
                                        <span className="font-bold text-blue-400">3 oy Premium</span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-gray-800/50 rounded-lg">
                                        <span className="text-gray-300">100 do'st</span>
                                        <span className="font-bold text-purple-400">1 yil Premium</span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        {/* Навигация */}
                        <div className="text-center">
                            <NavLink
                                to="/"
                                className="inline-block text-gray-400 hover:text-white transition"
                            >
                                ← Bosh sahifaga qaytish
                            </NavLink>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Referrals;