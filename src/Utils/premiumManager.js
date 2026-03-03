// src/utils/premiumManager.js
import { supabase } from '../lib/supabase';

// Цены планов (можно вынести в отдельный конфиг или таблицу БД позже)
const PLAN_PRICES = {
  monthly: 49000,
  yearly: 299000,
  lifetime: 999000,
};

const VALID_PLAN_TYPES = ['monthly', 'yearly', 'lifetime'];

export const premiumManager = {
  // Проверить Premium статус пользователя
  async checkPremiumStatus(userId) {
    if (!userId) return false;

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('premium_until, is_premium, premium_type')
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return false; // пользователь не найден
        throw error;
      }

      if (!profile || !profile.is_premium || !profile.premium_until) {
        return false;
      }

      // Особый случай: lifetime не истекает
      if (profile.premium_type === 'lifetime') {
        return {
          is_active: true,
          until: null, // бесконечно
          type: 'lifetime',
        };
      }

      const now = new Date().toISOString();
      const premiumUntil = profile.premium_until;

      if (premiumUntil < now) {
        await this.revokePremium(userId, 'expired');
        return false;
      }

      return {
        is_active: true,
        until: new Date(premiumUntil),
        type: profile.premium_type || 'monthly',
      };
    } catch (error) {
      console.error('Ошибка проверки Premium статуса:', error);
      return false;
    }
  },

  // Активировать или продлить Premium
  async activatePremium(userId, premiumData) {
    if (!userId) throw new Error('userId обязателен');

    const { days = 30, type = 'monthly', transactionId = null } = premiumData || {};

    // Валидация
    if (days <= 0) throw new Error('Количество дней должно быть положительным');
    if (!VALID_PLAN_TYPES.includes(type)) throw new Error('Неверный тип плана');

    try {
      const currentStatus = await this.checkPremiumStatus(userId);

      let premiumUntil;

      if (type === 'lifetime') {
        // Для lifetime — просто ставим флаг, дата не нужна
        premiumUntil = null;
      } else {
        const baseDate = currentStatus && currentStatus.is_active && currentStatus.until
          ? new Date(currentStatus.until)
          : new Date();

        premiumUntil = new Date(baseDate);
        premiumUntil.setDate(premiumUntil.getDate() + days);
      }

      const updateData = {
        is_premium: true,
        premium_type: type,
        premium_activated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (type !== 'lifetime') {
        updateData.premium_until = premiumUntil.toISOString();
      } else {
        updateData.premium_until = null; // очищаем, если был обычный срок
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;

      // Логируем активацию
      await this.logPremiumAction(userId, 'activated', {
        days,
        type,
        transactionId,
        premium_until: type === 'lifetime' ? 'lifetime' : premiumUntil?.toISOString(),
      });

      // Создаём транзакцию, если есть ID
      if (transactionId) {
        await this.createTransaction(userId, { type, days }, transactionId);
      }

      return {
        success: true,
        data,
        premium_until: type === 'lifetime' ? 'lifetime' : premiumUntil,
        days_added: days,
      };
    } catch (error) {
      console.error('Ошибка активации Premium:', error);
      throw error;
    }
  },

  // Создать запись о транзакции
  async createTransaction(userId, premiumData, transactionId) {
    try {
      const { data, error } = await supabase
        .from('premium_transactions')
        .insert([
          {
            user_id: userId,
            transaction_id: transactionId,
            plan_type: premiumData.type,
            amount: PLAN_PRICES[premiumData.type] || PLAN_PRICES.monthly,
            days_added: premiumData.days || null,
            status: 'completed',
            created_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Ошибка создания транзакции:', error);
      return null;
    }
  },

  // Отменить Premium
  async revokePremium(userId, reason = 'manual') {
    if (!userId) throw new Error('userId обязателен');

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          is_premium: false,
          premium_until: null,
          premium_revoked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) throw error;

      await this.logPremiumAction(userId, 'revoked', { reason });

      return { success: true, message: 'Premium отменён' };
    } catch (error) {
      console.error('Ошибка отмены Premium:', error);
      throw error;
    }
  },

  // Продлить Premium (добавить дни)
  async extendPremium(userId, additionalDays) {
    if (!userId || additionalDays <= 0) {
      throw new Error('Неверные параметры');
    }

    try {
      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('premium_until, premium_type')
        .eq('id', userId)
        .single();

      if (fetchError) throw fetchError;

      if (profile.premium_type === 'lifetime') {
        // Ничего не делаем — уже вечный
        return { success: true, message: 'Lifetime подписка не требует продления' };
      }

      let newPremiumUntil = new Date();
      if (profile.premium_until) {
        const currentUntil = new Date(profile.premium_until);
        const now = new Date();
        newPremiumUntil = currentUntil > now ? currentUntil : now;
      }

      newPremiumUntil.setDate(newPremiumUntil.getDate() + additionalDays);

      const { data, error } = await supabase
        .from('profiles')
        .update({
          is_premium: true,
          premium_until: newPremiumUntil.toISOString(),
          premium_extended_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;

      await this.logPremiumAction(userId, 'extended', {
        additional_days: additionalDays,
        new_premium_until: newPremiumUntil.toISOString(),
      });

      return {
        success: true,
        data,
        premium_until: newPremiumUntil,
        days_added: additionalDays,
      };
    } catch (error) {
      console.error('Ошибка продления Premium:', error);
      throw error;
    }
  },

  // Получить подробную информацию о Premium
  async getPremiumInfo(userId) {
    if (!userId) return { is_premium: false };

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

      if (error || !profile) {
        return { is_premium: false };
      }

      if (!profile.is_premium) {
        return { is_premium: false };
      }

      if (profile.premium_type === 'lifetime') {
        return {
          is_premium: true,
          premium_type: 'lifetime',
          days_left: Infinity,
          is_active: true,
          formatted_until: 'Пожизненно',
        };
      }

      const now = new Date();
      const premiumUntil = new Date(profile.premium_until);
      const daysLeft = Math.ceil((premiumUntil - now) / (1000 * 60 * 60 * 24));

      if (daysLeft <= 0) {
        await this.revokePremium(userId, 'auto_expired');
        return { is_premium: false };
      }

      return {
        is_premium: true,
        premium_until: profile.premium_until,
        premium_type: profile.premium_type,
        days_left: daysLeft,
        is_active: true,
        premium_activated_at: profile.premium_activated_at,
        premium_extended_at: profile.premium_extended_at,
        formatted_until: premiumUntil.toLocaleDateString('uz-UZ', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      };
    } catch (error) {
      console.error('Ошибка получения информации о Premium:', error);
      return { is_premium: false };
    }
  },

  // Остальные методы (без изменений в логике, но с исправлением this)
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

  async logPremiumAction(userId, action, metadata = {}) {
    try {
      const { error } = await supabase.from('premium_logs').insert([
        {
          user_id: userId,
          action,
          metadata,
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;
    } catch (error) {
      console.error('Ошибка логирования Premium действия:', error);
    }
  },

  async checkAllPremiumUsers() {
    // ... (оставляем как было, но можно улучшить пагинацией позже)
    try {
      const { data: premiumUsers, error } = await supabase
        .from('profiles')
        .select('id, premium_until, is_premium, premium_type')
        .eq('is_premium', true);

      if (error) throw error;

      const now = new Date().toISOString();
      const expiredUsers = [];

      for (const user of premiumUsers || []) {
        if (user.premium_type === 'lifetime') continue;

        if (user.premium_until && user.premium_until < now) {
          expiredUsers.push(user.id);

          await supabase
            .from('profiles')
            .update({
              is_premium: false,
              premium_revoked_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);

          await this.logPremiumAction(user.id, 'auto_expired', {
            original_premium_until: user.premium_until,
          });
        }
      }

      return {
        checked: premiumUsers?.length || 0,
        expired: expiredUsers.length,
        expired_users: expiredUsers,
      };
    } catch (error) {
      console.error('Ошибка фоновой проверки Premium:', error);
      return { checked: 0, expired: 0 };
    }
  },

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

  async getPremiumStats() {
    try {
      const { count: totalPremium, error: countError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_premium', true);

      if (countError) throw countError;

      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      const { data: recentTransactions, error: transError } = await supabase
        .from('premium_transactions')
        .select('amount')
        .gte('created_at', lastMonth.toISOString())
        .eq('status', 'completed');

      if (transError) throw transError;

      const monthlyRevenue = recentTransactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

      const { data: planDistribution } = await supabase
        .from('profiles')
        .select('premium_type')
        .eq('is_premium', true);

      const distribution = {};
      planDistribution?.forEach((p) => {
        const type = p.premium_type || 'monthly';
        distribution[type] = (distribution[type] || 0) + 1;
      });

      return {
        total_premium_users: totalPremium || 0,
        monthly_revenue: monthlyRevenue,
        plan_distribution: distribution,
        average_revenue_per_user: totalPremium > 0 ? Math.round(monthlyRevenue / totalPremium) : 0,
      };
    } catch (error) {
      console.error('Ошибка получения статистики:', error);
      return {
        total_premium_users: 0,
        monthly_revenue: 0,
        plan_distribution: {},
        average_revenue_per_user: 0,
      };
    }
  },
};

// Основной экспорт — только объект
// УБРАЛИ деструктурированный экспорт, чтобы не ломать this
export default premiumManager;