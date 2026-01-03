import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing');

  useEffect(() => {
    const processAuthCallback = async () => {
      try {

        // Получаем текущую сессию
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("❌ Ошибка получения сессии:", sessionError);
          setStatus('error');
          setTimeout(() => navigate('/login'), 2000);
          return;
        }

        // Проверяем URL на наличие ошибок
        const urlParams = new URLSearchParams(window.location.search);
        const error = urlParams.get('error');
        const errorDescription = urlParams.get('error_description');

        if (error) {
          console.error("❌ OAuth ошибка:", error, errorDescription);
          setStatus('error');
          setTimeout(() => navigate(`/login?error=${error}`), 2000);
          return;
        }

        if (session) {
          setStatus('success');
          
          // Добавляем небольшую задержку для лучшего UX
          setTimeout(() => {
            const returnTo = localStorage.getItem('preAuthPath') || '/';
            localStorage.removeItem('preAuthPath');
            navigate(returnTo, { replace: true });
          }, 1500);
        } else {
          setStatus('no_session');
          setTimeout(() => navigate('/login'), 2000);
        }

      } catch (error) {
        console.error("❌ Непредвиденная ошибка:", error);
        setStatus('error');
        setTimeout(() => navigate('/login'), 2000);
      }
    };

    // Обработчик изменений состояния авторизации
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        
        if (event === 'SIGNED_IN' && session) {
          processAuthCallback();
        } else if (event === 'SIGNED_OUT') {
          navigate('/login');
        }
      }
    );

    // Запускаем обработку при монтировании
    processAuthCallback();

    // Отписываемся при размонтировании
    return () => {
      subscription?.unsubscribe();
    };
  }, [navigate]);

  // Разные состояния отображения
  const renderContent = () => {
    switch (status) {
      case 'processing':
        return (
          <>
            <div className="w-20 h-20 border-4 border-t-cyan-500 border-r-transparent border-b-purple-500 border-l-transparent rounded-full animate-spin mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-white mb-4">Кирилмоқда...</h1>
            <p className="text-white/70">Google hisobingiz билан боғланилмоқда</p>
          </>
        );
      
      case 'success':
        return (
          <>
            <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">✓</span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-4">Муваффақиятли!</h1>
            <p className="text-white/70">Кириш амалга оширилди</p>
          </>
        );
      
      case 'error':
        return (
          <>
            <div className="w-20 h-20 bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">✗</span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-4">Хатолик!</h1>
            <p className="text-white/70">Авторизация амалга ошмади</p>
            <p className="text-sm text-white/50 mt-2">Логин саҳифасига қайтамиз...</p>
          </>
        );
      
      case 'no_session':
        return (
          <>
            <div className="w-20 h-20 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">!</span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-4">Сессия топилмади</h1>
            <p className="text-white/70">Илтимос, қайта кириб кўринг</p>
          </>
        );
      
      default:
        return (
          <>
            <div className="w-20 h-20 border-4 border-gray-300 rounded-full animate-pulse mx-auto mb-6" />
            <p className="text-white/70">Юкланмоқда...</p>
          </>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-10 border border-white/10 shadow-2xl">
          <div className="text-center">
            <div className="mb-8">
              <div className="inline-block p-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-purple-600">
                <span className="text-3xl font-black text-white">EH</span>
              </div>
            </div>
            
            {renderContent()}
            
            {/* Дополнительная информация */}
            <div className="mt-10 pt-6 border-t border-white/10">
              <p className="text-sm text-white/50">
                Агар муаммо давом этса, браузерингиз кешини тозалаб кўринг
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthCallback;