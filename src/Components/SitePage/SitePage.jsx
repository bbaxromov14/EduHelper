import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import DOMPurify from 'dompurify';
import ReactMarkdown from 'react-markdown';

const SitePage = () => {
  const { slug } = useParams();
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadPage();
  }, [slug]);

  const loadPage = async () => {
    try {
      const { data, error } = await supabase
        .from('site_pages')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

      if (error) throw error;
      
      if (!data) {
        setError('Страница не найдена');
      } else {
        setPage(data);
      }
    } catch (err) {
      console.error('Ошибка загрузки страницы:', err);
      setError('Ошибка загрузки страницы');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-4">404</h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">{error || 'Страница не найдена'}</p>
        </div>
      </div>
    );
  }

  // Определяем язык (можно получать из настроек пользователя или браузера)
  const language = 'ru'; // или 'uz' или 'en'
  
  const title = page[`title_${language}`] || page.title_uz;
  const content = page[`content_${language}`] || page.content_uz;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 md:p-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-8">
            {DOMPurify.sanitize(title)}
          </h1>
          
          <div className="prose prose-lg dark:prose-invert max-w-none">
            <ReactMarkdown>
              {DOMPurify.sanitize(content)}
            </ReactMarkdown>
          </div>

          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Последнее обновление: {new Date(page.last_updated).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SitePage;