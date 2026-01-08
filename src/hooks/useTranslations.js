// src/hooks/useTranslations.js
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export const useTranslations = () => {
  const [translations, setTranslations] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTranslations = async () => {
      try {
        const { data, error } = await supabase
          .from('translations')
          .select('*')
          .order('category', { ascending: true });
        
        if (error) throw error;
        
        // Группируем переводы по категориям
        const grouped = {};
        data.forEach(item => {
          if (!grouped[item.category]) {
            grouped[item.category] = [];
          }
          grouped[item.category].push(item);
        });
        
        setTranslations(grouped);
      } catch (error) {
        console.error('Ошибка загрузки переводов:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTranslations();
  }, []);

  return { translations, loading };
};