// src/components/RegisterWithVerification.jsx
import { useState } from 'react';
import { supabase, signUpWithEmail } from '../lib/supabase'; // Импорт ваших функций

const RegisterWithVerification = () => {
  const [form, setForm] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    deviceId: generateDeviceId() // Генерируем device ID для web
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Генерация device ID для web (замена для DeviceInfo)
  function generateDeviceId() {
    const deviceId = localStorage.getItem('device_id');
    if (deviceId) return deviceId;
    
    const newDeviceId = 'web_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('device_id', newDeviceId);
    return newDeviceId;
  }

  const checkDeviceLimit = async (deviceId) => {
    try {
      const { data, error } = await supabase
        .from('device_tracking')
        .select('count')
        .eq('device_id', deviceId)
        .single();

      // Если ошибка "нет данных" - это нормально
      if (error && error.code !== 'PGRST116') {
        console.error('Ошибка проверки устройства:', error);
        throw new Error('Ошибка проверки устройства');
      }

      if (data && data.count >= 3) {
        throw new Error('С одного устройства можно создать только 3 аккаунта');
      }
      return true;
    } catch (err) {
      throw err;
    }
  };

  const updateDeviceTracking = async (deviceId, userId) => {
    try {
      const { data: deviceData } = await supabase
        .from('device_tracking')
        .select('count, users')
        .eq('device_id', deviceId)
        .single();

      if (deviceData) {
        // Обновляем существующую запись
        await supabase
          .from('device_tracking')
          .update({
            count: deviceData.count + 1,
            last_registration: new Date().toISOString(),
            users: [...(deviceData.users || []), userId]
          })
          .eq('device_id', deviceId);
      } else {
        // Создаем новую запись
        await supabase
          .from('device_tracking')
          .insert({
            device_id: deviceId,
            count: 1,
            last_registration: new Date().toISOString(),
            users: [userId]
          });
      }
    } catch (error) {
      console.error('Ошибка обновления device tracking:', error);
    }
  };

  const validateForm = () => {
    if (!form.email || !form.password || !form.fullName) {
      throw new Error('Заполните все обязательные поля');
    }
    
    if (!form.email.includes('@')) {
      throw new Error('Введите корректный email');
    }
    
    if (form.password.length < 6) {
      throw new Error('Пароль должен содержать минимум 6 символов');
    }
  };

  const registerUser = async () => {
    setError('');
    setLoading(true);

    try {
      // 1. Валидация формы
      validateForm();

      // 2. Проверка лимита устройств
      await checkDeviceLimit(form.deviceId);

      // 3. Регистрация пользователя (используем вашу функцию)
      const authData = await signUpWithEmail(
        form.fullName,
        form.email,
        form.password
      );

      if (authData?.user) {
        // 4. Обновляем профиль дополнительными данными
        const { error: updateError } = await supabase
          .from('profiles') // Используем profiles, а не users
          .update({
            phone: form.phone,
            device_id: form.deviceId,
            referral_code: Math.random().toString(36).substring(2, 8).toUpperCase()
          })
          .eq('id', authData.user.id);

        if (updateError) {
          console.error('Ошибка обновления профиля:', updateError);
        }

        // 5. Обновляем счетчик устройств
        await updateDeviceTracking(form.deviceId, authData.user.id);

        // 6. Редирект или сообщение об успехе
        alert('✅ Регистрация успешна! Проверьте email для подтверждения.');
        
        // Можно добавить редирект:
        // window.location.href = '/verify-email';
      }
      
    } catch (err) {
      console.error('Ошибка регистрации:', err);
      setError(err.message);
      alert(`Ошибка: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-container">
      <h2>Регистрация</h2>
      
      {error && (
        <div className="error-message" style={{ color: 'red', marginBottom: '10px' }}>
          {error}
        </div>
      )}
      
      <div style={{ marginBottom: '15px' }}>
        <input
          type="text"
          placeholder="Полное имя *"
          value={form.fullName}
          onChange={(e) => setForm({...form, fullName: e.target.value})}
          style={{ width: '100%', padding: '10px', marginBottom: '10px' }}
          disabled={loading}
        />
        
        <input
          type="email"
          placeholder="Email *"
          value={form.email}
          onChange={(e) => setForm({...form, email: e.target.value})}
          style={{ width: '100%', padding: '10px', marginBottom: '10px' }}
          disabled={loading}
        />
        
        <input
          type="password"
          placeholder="Пароль (минимум 6 символов) *"
          value={form.password}
          onChange={(e) => setForm({...form, password: e.target.value})}
          style={{ width: '100%', padding: '10px', marginBottom: '10px' }}
          disabled={loading}
        />
        
        <input
          type="tel"
          placeholder="Телефон"
          value={form.phone}
          onChange={(e) => setForm({...form, phone: e.target.value})}
          style={{ width: '100%', padding: '10px', marginBottom: '10px' }}
          disabled={loading}
        />
      </div>
      
      <button 
        onClick={registerUser}
        disabled={loading}
        style={{
          width: '100%',
          padding: '12px',
          backgroundColor: loading ? '#ccc' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? 'Регистрация...' : 'Зарегистрироваться'}
      </button>
      
      <div style={{ marginTop: '15px', fontSize: '12px', color: '#666' }}>
        * Обязательные поля
      </div>
    </div>
  );
};

export default RegisterWithVerification;