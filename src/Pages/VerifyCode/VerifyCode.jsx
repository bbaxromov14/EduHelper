import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/ReactContext';
import { sendVerificationCode } from '../../Utils/sendCode';
import { toast } from 'react-toastify';
import { supabase } from '../../lib/supabase'; // Добавляем Supabase

export default function VerifyCode() {
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const location = useLocation();
  const navigate = useNavigate();
  const inputsRef = useRef([]);
  const { completeLogin, refreshUser } = useAuth();
  
  const { email, fullName, action, userId } = location.state || {};
  const savedEmail = email || localStorage.getItem('emailForSignIn');
  const savedUserId = userId || localStorage.getItem('tempUserId');

  // Повторная отправка кода
  const resendCode = async () => {
    if (!savedEmail) return toast.error('Email не найден');

    setLoading(true);
    
    try {
      await sendVerificationCode(savedEmail, fullName || "User");
      toast.success('Kod qayta yuborildi!');
      
      // Фокус на первый инпут
      inputsRef.current[0]?.focus();
      
    } catch (error) {
      toast.error('Xatolik yuz berdi: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Обновляем код при вводе
  const handleInput = (e, index) => {
    const value = e.target.value;
    
    // Разрешаем только цифры
    if (!/^\d?$/.test(value)) {
      e.target.value = '';
      return;
    }

    // Обновляем состояние кода
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Автопереход к следующему инпуту
    if (value && index < 5) {
      inputsRef.current[index + 1].focus();
    }
    
    // Если пользователь удалил значение, переходим назад
    if (!value && index > 0) {
      inputsRef.current[index - 1].focus();
    }
  };

  // Проверка кода с Supabase
  const checkCode = async () => {
    const enteredCode = code.join('');
    
    if (enteredCode.length !== 6) {
      toast.error('Toʻliq kod kiriting (6 ta raqam)');
      return;
    }

    setLoading(true);

    try {
      // Проверяем код из localStorage
      const tempData = JSON.parse(localStorage.getItem('verificationData') || '{}');
      const savedCode = tempData.code;

      if (enteredCode !== savedCode) {
        toast.error('Notoʻgʻri kod');
        setLoading(false);
        return;
      }

      // Если код верный, обрабатываем в зависимости от действия
      if (action === "register") {
        // 1. Обновляем профиль в Supabase
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            email_verified: true,
            is_verified: true,
            verified_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('email', savedEmail);

        if (updateError) {
          console.error('Ошибка обновления профиля:', updateError);
          toast.error('Профильni yangilashda xatolik');
          throw updateError;
        }

        // 2. Подтверждаем email в Supabase Auth
        const { error: confirmError } = await supabase.auth.updateUser({
          email_confirm: true
        });

        if (confirmError) {
          console.warn('Не удалось подтвердить email в Auth:', confirmError);
        }

        // 3. Обновляем пользователя в контексте
        if (refreshUser) {
          await refreshUser();
        }

        // 4. Создаем начальный прогресс для пользователя
        if (savedUserId) {
          try {
            // Получаем все курсы
            const { data: courses } = await supabase
              .from('courses')
              .select('id')
              .eq('is_published', true);

            if (courses && courses.length > 0) {
              // Создаем записи прогресса для каждого курса
              const progressEntries = courses.map(course => ({
                user_id: savedUserId,
                course_id: course.id,
                progress_percent: 0,
                completed: false,
                last_accessed: new Date().toISOString(),
                created_at: new Date().toISOString()
              }));

              const { error: progressError } = await supabase
                .from('enrollments')
                .insert(progressEntries);

              if (progressError) {
                console.warn('Не удалось создать записи прогресса:', progressError);
              }
            }
          } catch (progressError) {
            console.warn('Ошибка создания прогресса:', progressError);
          }
        }

        // 5. Очищаем временные данные
        localStorage.removeItem('verificationData');
        localStorage.removeItem('tempUserData');
        localStorage.removeItem('tempUserId');

      } else if (action === "login") {
        // Для входа просто подтверждаем код
        const tempData = JSON.parse(localStorage.getItem('tempLoginData') || '{}');
        
        if (tempData.email === savedEmail && tempData.code === enteredCode) {
          // Обновляем пользователя
          if (refreshUser) {
            await refreshUser();
          }
          
          localStorage.removeItem('tempLoginData');
        }
      } else if (action === "reset-password") {
        // Для сброса пароля
        navigate('/reset-password', {
          state: { 
            email: savedEmail,
            verificationCode: enteredCode 
          }
        });
        return;
      }

      toast.success('Muvaffaqiyatli tasdiqlandi! ✅');
      
      // Редирект на главную
      setTimeout(() => {
        navigate('/');
      }, 1500);

    } catch (error) {
      console.error('Verification error:', error);
      toast.error('Tasdiqlashda xatolik: ' + (error.message || 'Noma\'lum xatolik'));
    } finally {
      setLoading(false);
    }
  };

  // Автопроверка при заполнении всех 6 цифр
  useEffect(() => {
    if (code.every(digit => digit !== '') && code.length === 6) {
      const timer = setTimeout(() => {
        checkCode();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [code]);

  // Если email не найден - отправляем обратно
  useEffect(() => {
    if (!savedEmail) {
      toast.error('Email topilmadi');
      navigate('/login');
    } else {
      // Автофокус на первый инпут при загрузке
      setTimeout(() => {
        inputsRef.current[0]?.focus();
      }, 300);
    }
  }, [savedEmail, navigate]);

  // Обработка Ctrl+V для вставки кода
  useEffect(() => {
    const handlePaste = (e) => {
      const pastedText = e.clipboardData.getData('text');
      if (/^\d{6}$/.test(pastedText)) {
        const digits = pastedText.split('');
        const newCode = [...code];
        
        digits.forEach((digit, index) => {
          if (index < 6) {
            newCode[index] = digit;
            if (inputsRef.current[index]) {
              inputsRef.current[index].value = digit;
            }
          }
        });
        
        setCode(newCode);
        e.preventDefault();
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [code]);

  // Обработка клавиш
  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputsRef.current[index - 1].focus();
    }
    if (e.key === 'Enter' && code.every(digit => digit !== '')) {
      checkCode();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl p-8 w-full max-w-md">
        
        {/* Заголовок */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center">
            <span className="text-3xl font-bold text-white">✓</span>
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">Tasdiqlash</h2>
          <p className="text-gray-300">
            {savedEmail} ga yuborilgan kodni kiriting
          </p>
        </div>

        {/* Поля для ввода кода */}
        <div className="flex justify-center gap-3 mb-8">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <input
              key={index}
              ref={el => inputsRef.current[index] = el}
              type="text"
              maxLength="1"
              value={code[index]}
              className="w-14 h-14 text-3xl font-bold text-center bg-white/5 border-2 border-white/20 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 focus:outline-none text-white transition-all disabled:opacity-50"
              onInput={(e) => handleInput(e, index)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              disabled={loading}
              inputMode="numeric"
            />
          ))}
        </div>

        {/* Кнопка проверки */}
        <button
          onClick={checkCode}
          disabled={loading || code.some(digit => digit === '')}
          className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-6"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              Tekshirilmoqda...
            </span>
          ) : 'Tasdiqlash'}
        </button>

        {/* Дополнительные опции */}
        <div className="text-center space-y-4">
          <button
            onClick={resendCode}
            disabled={loading}
            className="text-blue-400 hover:text-blue-300 transition-colors text-sm font-medium"
          >
            📨 Kodni qayta yuborish
          </button>
          
          <div className="text-gray-400 text-sm">
            Kod 10 daqiqa davomida amal qiladi
          </div>
          
          <button
            onClick={() => navigate('/login')}
            className="text-gray-400 hover:text-gray-300 transition-colors text-sm"
          >
            ← Kirish sahifasiga qaytish
          </button>
        </div>

        {/* Статус действия */}
        <div className="mt-8 p-4 bg-white/5 rounded-xl text-center">
          <p className="text-sm text-gray-300">
            {action === "register" && "Yangi hisobingizni tasdiqlash"}
            {action === "login" && "Kirishni tasdiqlash"}
            {action === "reset-password" && "Parolni tiklashni tasdiqlash"}
          </p>
        </div>
      </div>
    </div>
  );
}