// src/utils/premiumManager.js
import { supabase } from '../lib/supabase';

export const premiumManager = {
  // Проверить Premium статус пользователя
  async checkPremiumStatus(userId) {
    try {
      // Получаем профиль пользователя
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('premium_until, is_premium')
        .eq('id', userId)
        .single();

      if (error) throw error;
      if (!profile) return false;

      const { premium_until, is_premium } = profile;
      
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

      return true;
    } catch (error) {
      console.error('Ошибка проверки Premium статуса:', error);
      return false;
    }
  },

  // Активировать Premium
  async activatePremium(userId, premiumData) {
    try {
      const { days = 30, type = 'monthly', transactionId = null } = premiumData;
      
      const premiumUntil = new Date();
      premiumUntil.setDate(premiumUntil.getDate() + days);

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

      return data;
    } catch (error) {
      console.error('Ошибка активации Premium:', error);
      throw error;
    }
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
        .select('premium_until')
        .eq('id', userId)
        .single();

      if (fetchError) throw fetchError;

      let newPremiumUntil;
      
      if (profile.premium_until) {
        // Продлеваем существующий
        const currentUntil = new Date(profile.premium_until);
        currentUntil.setDate(currentUntil.getDate() + additionalDays);
        newPremiumUntil = currentUntil;
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

      return data;
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

      if (error) throw error;

      if (!profile.is_premium || !profile.premium_until) {
        return { is_premium: false };
      }

      const now = new Date();
      const premiumUntil = new Date(profile.premium_until);
      const daysLeft = Math.ceil((premiumUntil - now) / (1000 * 60 * 60 * 24));

      return {
        is_premium: profile.is_premium,
        premium_until: profile.premium_until,
        premium_type: profile.premium_type,
        days_left: Math.max(0, daysLeft),
        is_active: daysLeft > 0,
        premium_activated_at: profile.premium_activated_at,
        premium_extended_at: profile.premium_extended_at
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

      return { checked: premiumUsers?.length || 0, expired: expiredUsers.length };
      
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
  checkAllPremiumUsers
} = premiumManager;