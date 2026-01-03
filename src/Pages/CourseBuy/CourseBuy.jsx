import React, { useState, useEffect } from 'react';
import { useParams, NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/ReactContext';

const CourseBuy = () => {
  const { id } = useParams(); // Получаем ID курса из URL
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCourse = async () => {
      try {
        const { data, error } = await supabase
          .from('courses')
          .select('*')
          .eq('id', id)
          .single();

        if (error || !data) {
          alert('Kurs topilmadi yoki xatolik yuz berdi');
          navigate('/subjects');
          return;
        }

        // Проверяем, что это действительно платный курс
        if (data.access_type !== 'paid') {
          navigate(`/subject/${id}`);
          return;
        }

        setCourse(data);
      } catch (err) {
        console.error('Xato:', err);
        alert('Kursni yuklashda xatolik');
        navigate('/subjects');
      } finally {
        setLoading(false);
      }
    };

    fetchCourse();
  }, [id, navigate]);

  const handleBuy = () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    // Здесь будет реальная оплата через Click/Payme
    alert(
      `"${course.title}" kursi muvaffaqiyatli sotib olindi!\nTez orada to'lov tizimi ulanadi 🚀\nNarxi: ${course.price?.toLocaleString() || '?'} UZS`
    );

    // После "покупки" можно открыть курс
    // navigate(`/subject/${id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl">Yuklanmoqda...</div>
      </div>
    );
  }

  if (!course) {
    return null; // navigate уже сработал
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50 dark:from-black dark:via-gray-900 dark:to-purple-950 py-16 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Кнопка назад */}
        <NavLink
          to="/subjects"
          className="inline-block mb-8 text-indigo-600 dark:text-indigo-400 hover:underline text-lg"
        >
          ← Barcha kurslarga qaytish
        </NavLink>

        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden">
          <div className="grid md:grid-cols-2">
            {/* Изображение */}
            <div className="relative h-96 md:h-full">
              <img
                src={course.cover_image_url || course.image_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80'}
                alt={course.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-6 left-6 text-white">
                <h1 className="text-4xl md:text-5xl font-black">{course.title}</h1>
                <p className="text-xl mt-2 opacity-90">Umrbod kirish • Sertifikat bilan</p>
              </div>
            </div>

            {/* Информация и покупка */}
            <div className="p-10 md:p-16 flex flex-col justify-center">
              <div className="mb-10">
                <div className="text-6xl md:text-7xl font-black text-orange-500">
                  {course.price?.toLocaleString() || '?'} UZS
                </div>
                <p className="text-2xl text-gray-600 dark:text-gray-400 mt-4">
                  Bir martalik to'lov — umrbod foydalanish
                </p>
              </div>

              <ul className="space-y-4 mb-10 text-lg">
                <li className="flex items-center gap-3">
                  <span className="text-2xl">✅</span> Barcha darslar umrbod ochiq
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-2xl">✅</span> Rasmiy sertifikat
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-2xl">✅</span> Reklamasiz tajriba
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-2xl">✅</span> Yangi darslar bepul qo'shiladi
                </li>
              </ul>

              <button
                onClick={handleBuy}
                className="w-full py-6 bg-gradient-to-r from-orange-500 to-red-600 text-white text-2xl md:text-3xl font-black rounded-2xl shadow-2xl hover:scale-105 transition transform"
              >
                HOZIR SOTIB OLISH
              </button>

              <p className="text-center mt-8 text-gray-500">
                Yoki barcha kurslarga kirish uchun{' '}
                <NavLink to="/premium" className="text-indigo-600 dark:text-indigo-400 font-bold underline">
                  Premium obuna
                </NavLink>{' '}
                sotib oling
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseBuy;