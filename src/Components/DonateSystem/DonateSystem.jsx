// src/components/DonateSystemPayPal.jsx
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/ReactContext';
import { NavLink } from 'react-router-dom';

const DonateSystem = () => {
  const [donateAmount, setDonateAmount] = useState(10000);
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [donationId, setDonationId] = useState(null);
  const paypalButtonsRef = useRef(null);
  const [paypalLoaded, setPaypalLoaded] = useState(false);

  // Доступные суммы для быстрого выбора (в сумах)
  const presetAmounts = [
    { value: 5000, label: '5 000 сум' },
    { value: 10000, label: '10 000 сум' },
    { value: 25000, label: '25 000 сум' },
    { value: 50000, label: '50 000 сум' },
    { value: 100000, label: '100 000 сум' },
  ];

  // Загружаем PayPal SDK
  useEffect(() => {
    const loadPayPal = async () => {
      try {
        // Проверяем, не загружен ли уже PayPal
        if (window.paypal) {
          setPaypalLoaded(true);
          return;
        }

        // Загружаем PayPal SDK
        const script = document.createElement('script');
        script.src = 'https://www.paypal.com/sdk/js?client-id=YOUR_PAYPAL_CLIENT_ID&currency=USD&disable-funding=credit,card';
        script.async = true;
        
        script.onload = () => {
          setPaypalLoaded(true);
          renderPayPalButtons();
        };
        
        script.onerror = () => {
          console.error('Failed to load PayPal SDK');
          alert('Не удалось загрузить платежную систему PayPal. Пожалуйста, попробуйте позже.');
        };
        
        document.body.appendChild(script);
      } catch (error) {
        console.error('Error loading PayPal:', error);
      }
    };

    loadPayPal();

    return () => {
      // Очистка при размонтировании компонента
      if (paypalButtonsRef.current) {
        paypalButtonsRef.current = null;
      }
    };
  }, [donateAmount]);

  // Рендерим кнопки PayPal
  const renderPayPalButtons = () => {
    if (!window.paypal || !paypalLoaded) return;

    // Очищаем предыдущие кнопки
    if (paypalButtonsRef.current) {
      paypalButtonsRef.current = null;
    }

    const buttonsContainer = document.getElementById('paypal-button-container');
    if (!buttonsContainer) return;

    buttonsContainer.innerHTML = '';

    window.paypal.Buttons({
      style: {
        layout: 'vertical',
        color: 'gold',
        shape: 'rect',
        label: 'donate',
        height: 48,
        tagline: false
      },

      // Создаем заказ
      createOrder: async (data, actions) => {
        try {
          setIsProcessing(true);
          setPaymentStatus('creating');

          // 1. Конвертируем сумму из сумов в доллары
          const amountInUSD = (donateAmount / 12500).toFixed(2); // 1 USD ≈ 12500 UZS
          
          // 2. Создаем запись о донате в базе
          const { data: donation, error } = await supabase
            .from('donations')
            .insert({
              user_id: user?.id || null,
              amount: donateAmount,
              currency: 'UZS',
              status: 'pending',
              payment_method: 'paypal',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select()
            .single();

          if (error) throw error;

          setDonationId(donation.id);

          // 3. Создаем заказ в PayPal
          return actions.order.create({
            purchase_units: [{
              amount: {
                value: amountInUSD,
                currency_code: "USD",
                breakdown: {
                  item_total: {
                    value: amountInUSD,
                    currency_code: "USD"
                  }
                }
              },
              items: [{
                name: `Поддержка образования в Узбекистане`,
                description: `Донат в размере ${donateAmount.toLocaleString()} сум`,
                quantity: "1",
                unit_amount: {
                  value: amountInUSD,
                  currency_code: "USD"
                },
                category: "DONATION"
              }],
              custom_id: donation.id,
              invoice_id: `DONATION-${donation.id.slice(0, 8)}`
            }],
            application_context: {
              brand_name: "EduHelperUz",
              landing_page: "BILLING",
              user_action: "DONATE",
              shipping_preference: "NO_SHIPPING",
              return_url: `${window.location.origin}/donate/success`,
              cancel_url: `${window.location.origin}/donate/cancel`
            }
          });

        } catch (error) {
          console.error('Error creating PayPal order:', error);
          alert('❌ Ошибка при создании платежа: ' + error.message);
          setIsProcessing(false);
          setPaymentStatus('failed');
          throw error;
        }
      },

      // Когда платеж одобрен
      onApprove: async (data, actions) => {
        try {
          setPaymentStatus('processing');

          // 1. Захватываем платеж
          const details = await actions.order.capture();

          // 2. Обновляем запись доната в базе
          const { error: updateError } = await supabase
            .from('donations')
            .update({
              status: 'completed',
              payment_id: details.id,
              payer_email: details.payer.email_address,
              updated_at: new Date().toISOString(),
              completed_at: new Date().toISOString()
            })
            .eq('id', donationId);

          if (updateError) throw updateError;

          // 3. Обновляем статистику
          await updateDonationStats();

          // 4. Показываем успех
          setPaymentStatus('success');
          setIsProcessing(false);
          
          // 5. Показываем благодарственное сообщение
          alert(`🎉 Спасибо за ваш донат в размере ${donateAmount.toLocaleString()} сум! Вы помогаете развитию образования в Узбекистане!`);
          
          // 6. Перенаправляем на страницу благодарности
          window.location.href = `/donate/thank-you?id=${donationId}&amount=${donateAmount}`;

        } catch (error) {
          console.error('Error capturing payment:', error);
          
          // Обновляем статус в базе как неудачный
          await supabase
            .from('donations')
            .update({
              status: 'failed',
              updated_at: new Date().toISOString()
            })
            .eq('id', donationId);

          setPaymentStatus('failed');
          setIsProcessing(false);
          alert('❌ Произошла ошибка при обработке платежа. Пожалуйста, попробуйте еще раз.');
        }
      },

      // При ошибке
      onError: (err) => {
        console.error('PayPal error:', err);
        setIsProcessing(false);
        setPaymentStatus('failed');
        alert('❌ Ошибка платежной системы. Пожалуйста, попробуйте другой способ оплаты.');
      },

      // При отмене
      onCancel: (data) => {
        setIsProcessing(false);
        setPaymentStatus('cancelled');
        
        // Обновляем статус в базе
        if (donationId) {
          supabase
            .from('donations')
            .update({
              status: 'failed',
              updated_at: new Date().toISOString()
            })
            .eq('id', donationId);
        }
      }

    }).render('#paypal-button-container');
  };

  // Обновление статистики донатов
  const updateDonationStats = async () => {
    try {
      // Обновляем общую статистику
      const { error } = await supabase
        .from('stats')
        .update({ 
          total_donations: supabase.raw('COALESCE(total_donations, 0) + ?', [donateAmount])
        })
        .eq('id', 1);

      if (error) console.error('Error updating donation stats:', error);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // Функция для обновления суммы доната
  const handleAmountChange = (amount) => {
    setDonateAmount(amount);
    setPaymentStatus(null);
    setDonationId(null);
  };

  // Функция для ввода произвольной суммы
  const handleCustomAmount = (e) => {
    const value = parseInt(e.target.value) || 0;
    if (value >= 1000) {
      setDonateAmount(value);
      setPaymentStatus(null);
      setDonationId(null);
    }
  };

  // Форматирование суммы
  const formatAmount = (amount) => {
    return amount.toLocaleString('uz-UZ');
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-xl">
      <h2 className="text-2xl font-bold text-center mb-6 text-gray-800 dark:text-white">
        Поддержите развитие образования в Узбекистане 🎓
      </h2>
      
      <p className="text-gray-600 dark:text-gray-300 mb-6 text-center">
        Ваш донат поможет нам создавать бесплатные образовательные материалы 
        для студентов и школьников по всей стране.
      </p>
      
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Выберите сумму доната (сум):
        </label>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          {presetAmounts.map((amount) => (
            <button
              key={amount.value}
              onClick={() => handleAmountChange(amount.value)}
              disabled={isProcessing}
              className={`py-3 px-4 rounded-lg font-medium transition-colors ${
                donateAmount === amount.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {amount.label}
            </button>
          ))}
        </div>
        
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Или введите свою сумму:
          </label>
          <div className="relative">
            <input
              type="number"
              min="1000"
              step="1000"
              value={donateAmount}
              onChange={handleCustomAmount}
              disabled={isProcessing}
              className="w-full p-3 pl-12 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <span className="absolute left-4 top-3.5 text-gray-500">сум</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Минимальная сумма: 1 000 сум
          </p>
        </div>
      </div>
      
      <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
        <div className="flex justify-between text-sm">
          <span className="text-gray-700 dark:text-gray-300">Выбранная сумма:</span>
          <span className="font-bold text-blue-600 dark:text-blue-400">
            {formatAmount(donateAmount)} сум
          </span>
        </div>
        <div className="flex justify-between text-sm mt-1">
          <span className="text-gray-700 dark:text-gray-300">Примерно в USD:</span>
          <span className="font-bold text-gray-800 dark:text-gray-200">
            ≈ ${(donateAmount / 12500).toFixed(2)}
          </span>
        </div>
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Комиссия PayPal: ~${(donateAmount / 12500 * 0.029 + 0.30).toFixed(2)}
        </div>
      </div>
      
      {/* Статус платежа */}
      {paymentStatus === 'creating' && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            <span className="text-blue-700 dark:text-blue-300">
              Создание платежа...
            </span>
          </div>
        </div>
      )}
      
      {paymentStatus === 'processing' && (
        <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600 mr-2"></div>
            <span className="text-yellow-700 dark:text-yellow-300">
              Обработка платежа...
            </span>
          </div>
        </div>
      )}
      
      {paymentStatus === 'success' && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
          <div className="flex items-center">
            <span className="text-green-700 dark:text-green-300">
              ✅ Платеж успешно завершен! Спасибо за вашу поддержку!
            </span>
          </div>
        </div>
      )}
      
      {paymentStatus === 'failed' && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 rounded-lg">
          <div className="flex items-center">
            <span className="text-red-700 dark:text-red-300">
              ❌ Платеж не удался. Пожалуйста, попробуйте еще раз.
            </span>
          </div>
        </div>
      )}
      
      {paymentStatus === 'cancelled' && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900/30 rounded-lg">
          <div className="flex items-center">
            <span className="text-gray-700 dark:text-gray-300">
              ⚠️ Платеж отменен.
            </span>
          </div>
        </div>
      )}
      
      {/* Контейнер для кнопок PayPal */}
      <div id="paypal-button-container" className="mt-4"></div>
      
      {!paypalLoaded && (
        <div className="text-center py-4 text-gray-500">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mr-2"></div>
          Загрузка платежной системы PayPal...
        </div>
      )}
      
      <div className="mt-4 text-center">
        <div className="flex items-center justify-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
          <div className="flex items-center">
            <span className="mr-1">🌍</span>
            <span>Международные карты</span>
          </div>
          <div className="flex items-center">
            <span className="mr-1">🔒</span>
            <span>SSL защита</span>
          </div>
          <div className="flex items-center">
            <span className="mr-1">💳</span>
            <span>Visa/Mastercard</span>
          </div>
        </div>
      </div>
      
      <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          💳 Оплата производится через защищенную систему PayPal<br />
          🔐 Ваши платежные данные защищены по стандарту PCI DSS Level 1<br />
          🌍 Принимаем карты со всего мира<br />
          📄 Вы получите чек на email после оплаты
        </p>
        
        <div className="mt-4 flex justify-center space-x-2">
          <img 
            src="https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_111x69.jpg" 
            alt="PayPal" 
            className="h-8"
          />
          <img 
            src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" 
            alt="Visa" 
            className="h-8 opacity-70"
          />
          <img 
            src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" 
            alt="Mastercard" 
            className="h-8 opacity-70"
          />
        </div>
        <NavLink
          to="/"
          className="inline-block mb-8 text-indigo-600 dark:text-indigo-400 hover:underline text-lg"
        >
          ← Ortga
        </NavLink>
      </div>
    </div>
  );
};

export default DonateSystem;