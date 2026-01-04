import { supabase } from '../lib/supabase';

export const paymentService = {
  // Создать платежную транзакцию
  async createTransaction(userId, amount, planType, provider = 'test') {
    try {
      const transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const { data, error } = await supabase
        .from('payment_transactions')
        .insert([{
          user_id: userId,
          transaction_id: transactionId,
          amount: amount,
          plan_type: planType,
          provider: provider,
          status: 'pending',
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Ошибка создания транзакции:', error);
      throw error;
    }
  },

  // Обновить статус транзакции
  async updateTransactionStatus(transactionId, status, metadata = {}) {
    try {
      const { data, error } = await supabase
        .from('payment_transactions')
        .update({
          status: status,
          updated_at: new Date().toISOString(),
          metadata: metadata
        })
        .eq('transaction_id', transactionId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Ошибка обновления транзакции:', error);
      throw error;
    }
  },

  // Получить историю платежей пользователя
  async getUserTransactions(userId, limit = 20) {
    try {
      const { data, error } = await supabase
        .from('payment_transactions')
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
  }
};