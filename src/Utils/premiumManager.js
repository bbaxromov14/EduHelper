// src/utils/premiumManager.js
import { supabase } from '../lib/supabase';

export const premiumManager = {
  // Проверить Premium статус пользователя
  async checkPremiumStatus(userId) {
    try {
      // Получаем профиль пользователя
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('premium_until, is_premium, premium_type')
        .eq('id', userId)
        .single();

      if (error) {
        // Если пользователь не найден
        if (error.code === 'PGRST116') {
          return false;
        }
        throw error;
      }
      if (!profile) return false;

      const { premium_until, is_premium, premium_type } = profile;
      
      // Если нет премиума
      if (!premium_until || !is_premium) {
        return false;
      }

      const now = new Date();
      const premiumUntil = new Date(premium_until);

      // Если премиум истек
      if (premiumUntil < now) {
        // Автоматически снимаем премиум
        await this.revokePremium(userId, 'expired');
        return false;
      }

      return {
        is_active: true,
        until: premiumUntil,
        type: premium_type || 'monthly'
      };
    } catch (error) {
      console.error('Ошибка проверки Premium статуса:', error);
      return false;
    }
  },

  // Активировать Premium
  async activatePremium(userId, premiumData) {
    try {
      const { days = 30, type = 'monthly', transactionId = null } = premiumData;
      
      let premiumUntil;
      const now = new Date();
      
      // Проверяем, есть ли уже Premium
      const currentStatus = await this.checkPremiumStatus(userId);
      
      if (currentStatus && currentStatus.is_active) {
        // Продлеваем существующий Premium
        premiumUntil = new Date(currentStatus.until);
        premiumUntil.setDate(premiumUntil.getDate() + days);
      } else {
        // Создаем новый Premium
        premiumUntil = new Date();
        premiumUntil.setDate(premiumUntil.getDate() + days);
      }

      const { data, error } = await supabase
        .from('profiles')
        .update({
          is_premium: true,
          premium_until: premiumUntil.toISOString(),
          premium_type: type,
          premium_activated_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;

      // Логируем активацию
      await this.logPremiumAction(userId, 'activated', {
        days,
        type,
        transactionId,
        premium_until: premiumUntil.toISOString()
      });

      // Создаем транзакцию оплаты
      if (transactionId) {
        await this.createTransaction(userId, premiumData, transactionId);
      }

      return {
        success: true,
        data,
        premium_until: premiumUntil,
        days_added: days
      };
    } catch (error) {
      console.error('Ошибка активации Premium:', error);
      throw error;
    }
  },

  // Создать транзакцию оплаты
  async createTransaction(userId, premiumData, transactionId) {
    try {
      const { data, error } = await supabase
        .from('premium_transactions')
        .insert([{
          user_id: userId,
          transaction_id: transactionId,
          plan_type: premiumData.type,
          amount: this.getPlanPrice(premiumData.type),
          days_added: premiumData.days,
          status: 'completed',
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Ошибка создания транзакции:', error);
      // Не прерываем основной поток
      return null;
    }
  },

  // Получить цену плана
  getPlanPrice(planType) {
    const prices = {
      'monthly': 49000,
      'yearly': 299000,
      'lifetime': 999000
    };
    return prices[planType] || 49000;
  },

  // Отменить Premium
  async revokePremium(userId, reason = 'manual') {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          is_premium: false,
          premium_until: null,
          premium_revoked_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) throw error;

      // Логируем отмену
      await this.logPremiumAction(userId, 'revoked', { reason });

      return { success: true, message: 'Premium отменен' };
    } catch (error) {
      console.error('Ошибка отмены Premium:', error);
      throw error;
    }
  },

  // Продлить Premium
  async extendPremium(userId, additionalDays) {
    try {
      // Получаем текущий Premium статус
      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('premium_until, premium_type')
        .eq('id', userId)
        .single();

      if (fetchError) throw fetchError;

      let newPremiumUntil;
      const now = new Date();
      
      if (profile.premium_until) {
        // Продлеваем существующий
        const currentUntil = new Date(profile.premium_until);
        
        // Если Premium еще активен, продлеваем от даты окончания
        if (currentUntil > now) {
          newPremiumUntil = new Date(currentUntil);
        } else {
          // Если истек, начинаем заново
          newPremiumUntil = new Date();
        }
        newPremiumUntil.setDate(newPremiumUntil.getDate() + additionalDays);
      } else {
        // Создаем новый
        newPremiumUntil = new Date();
        newPremiumUntil.setDate(newPremiumUntil.getDate() + additionalDays);
      }

      const { data, error } = await supabase
        .from('profiles')
        .update({
          is_premium: true,
          premium_until: newPremiumUntil.toISOString(),
          premium_extended_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;

      // Логируем продление
      await this.logPremiumAction(userId, 'extended', {
        additional_days: additionalDays,
        new_premium_until: newPremiumUntil.toISOString()
      });

      return {
        success: true,
        data,
        premium_until: newPremiumUntil,
        days_added: additionalDays
      };
    } catch (error) {
      console.error('Ошибка продления Premium:', error);
      throw error;
    }
  },

  // Получить информацию о Premium
  async getPremiumInfo(userId) {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select(`
          is_premium,
          premium_until,
          premium_type,
          premium_activated_at,
          premium_extended_at,
          premium_revoked_at
        `)
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { is_premium: false };
        }
        throw error;
      }

      if (!profile.is_premium || !profile.premium_until) {
        return { is_premium: false };
      }

      const now = new Date();
      const premiumUntil = new Date(profile.premium_until);
      const daysLeft = Math.ceil((premiumUntil - now) / (1000 * 60 * 60 * 24));

      // Проверяем, не истек ли Premium
      if (daysLeft <= 0) {
        // Автоматически снимаем
        await this.revokePremium(userId, 'auto_expired');
        return { is_premium: false };
      }

      return {
        is_premium: true,
        premium_until: profile.premium_until,
        premium_type: profile.premium_type,
        days_left: Math.max(0, daysLeft),
        is_active: daysLeft > 0,
        premium_activated_at: profile.premium_activated_at,
        premium_extended_at: profile.premium_extended_at,
        formatted_until: premiumUntil.toLocaleDateString('uz-UZ', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      };
    } catch (error) {
      console.error('Ошибка получения информации о Premium:', error);
      return { is_premium: false };
    }
  },

  // Получить всех Premium пользователей
  async getAllPremiumUsers() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_premium', true)
        .order('premium_until', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Ошибка загрузки Premium пользователей:', error);
      return [];
    }
  },

  // Логирование действий Premium
  async logPremiumAction(userId, action, metadata = {}) {
    try {
      const { error } = await supabase
        .from('premium_logs')
        .insert([{
          user_id: userId,
          action,
          metadata,
          created_at: new Date().toISOString()
        }]);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Ошибка логирования Premium действия:', error);
      // Не прерываем основной поток из-за ошибки логирования
      return { success: false, error };
    }
  },

  // Фоновая задача для проверки всех пользователей
  async checkAllPremiumUsers() {
    try {
      // Получаем всех пользователей с активным Premium
      const { data: premiumUsers, error } = await supabase
        .from('profiles')
        .select('id, premium_until, is_premium')
        .eq('is_premium', true)
        .not('premium_until', 'is', null);

      if (error) throw error;

      const now = new Date();
      const expiredUsers = [];

      // Проверяем каждого пользователя
      for (const user of premiumUsers || []) {
        if (user.premium_until) {
          const premiumUntil = new Date(user.premium_until);
          
          if (premiumUntil < now) {
            // Premium истек
            expiredUsers.push(user.id);
            
            // Обновляем статус
            await supabase
              .from('profiles')
              .update({
                is_premium: false,
                premium_revoked_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', user.id);

            // Логируем
            await this.logPremiumAction(user.id, 'auto_expired', {
              original_premium_until: user.premium_until
            });
          }
        }
      }

      return { 
        checked: premiumUsers?.length || 0, 
        expired: expiredUsers.length,
        expired_users: expiredUsers 
      };
      
    } catch (error) {
      console.error('Ошибка фоновой проверки Premium:', error);
      return { checked: 0, expired: 0, error: error.message };
    }
  },

  // Получить логи Premium для пользователя
  async getPremiumLogs(userId, limit = 50) {
    try {
      const { data, error } = await supabase
        .from('premium_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Ошибка загрузки Premium логов:', error);
      return [];
    }
  },

  // Получить транзакции пользователя
  async getUserTransactions(userId, limit = 20) {
    try {
      const { data, error } = await supabase
        .from('premium_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Ошибка загрузки транзакций:', error);
      return [];
    }
  },

  // Проверить и обновить Premium статус
  async checkAndUpdatePremium(userId) {
    try {
      const isPremium = await this.checkPremiumStatus(userId);
      const info = await this.getPremiumInfo(userId);
      
      return {
        is_premium: isPremium,
        info: info
      };
    } catch (error) {
      console.error('Ошибка проверки статуса:', error);
      return { is_premium: false, info: null };
    }
  },

  // Получить статистику Premium
  async getPremiumStats() {
    try {
      // Общее количество Premium пользователей
      const { count: totalPremium, error: countError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_premium', true);

      if (countError) throw countError;

      // Доходы за последний месяц
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      const { data: recentTransactions, error: transError } = await supabase
        .from('premium_transactions')
        .select('amount')
        .gte('created_at', lastMonth.toISOString())
        .eq('status', 'completed');

      if (transError) throw transError;

      const monthlyRevenue = recentTransactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

      // Распределение по планам
      const { data: planDistribution, error: planError } = await supabase
        .from('profiles')
        .select('premium_type')
        .eq('is_premium', true);

      if (planError) throw planError;

      const distribution = {};
      planDistribution?.forEach(p => {
        const type = p.premium_type || 'monthly';
        distribution[type] = (distribution[type] || 0) + 1;
      });

      return {
        total_premium_users: totalPremium || 0,
        monthly_revenue: monthlyRevenue,
        plan_distribution: distribution,
        average_revenue_per_user: totalPremium > 0 ? Math.round(monthlyRevenue / totalPremium) : 0
      };
    } catch (error) {
      console.error('Ошибка получения статистики:', error);
      return {
        total_premium_users: 0,
        monthly_revenue: 0,
        plan_distribution: {},
        average_revenue_per_user: 0
      };
    }
  }
};

// Экспорт для удобства использования
export const {
  checkPremiumStatus,
  activatePremium,
  revokePremium,
  extendPremium,
  getPremiumInfo,
  getAllPremiumUsers,
  checkAllPremiumUsers,
  checkAndUpdatePremium,
  getPremiumStats
} = premiumManager;