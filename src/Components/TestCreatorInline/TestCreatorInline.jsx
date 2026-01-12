import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';

const TestCreatorInline = ({ lessonId, courseId, onClose, onSave, lessonTitle }) => {
  const { t } = useTranslation();
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState({ 
    text: '', 
    options: ['', '', ''], 
    correct: 0, 
    points: 10,
    type: 'single_choice',
    explanation: ''
  });
  
  const [title, setTitle] = useState(`${t('for_lesson')}: ${lessonTitle || ''}`);
  const [passingScore, setPassingScore] = useState(70);
  const [timeLimit, setTimeLimit] = useState(0);
  const [allowedAttempts, setAllowedAttempts] = useState(1);
  const [showResults, setShowResults] = useState(true);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Добавление вопроса
  const addQuestion = () => {
    setError('');
    setSuccess('');
    
    // Валидация
    if (!current.text.trim()) {
      setError(t('enter_question_text'));
      return;
    }
    
    if (current.type === 'single_choice' || current.type === 'multiple_choice') {
      const validOptions = current.options.filter(o => o.trim());
      if (validOptions.length < 2) {
        setError(t('enter_at_least_one_question'));
        return;
      }
      
      if (current.correct === undefined) {
        setError(t('correct_answer'));
        return;
      }
    }

    const newQuestion = {
      id: Date.now(),
      text: current.text.trim(),
      type: current.type,
      points: current.points,
      explanation: current.explanation.trim(),
      order: questions.length + 1
    };

    // Добавляем варианты ответов для типов с выбором
    if (current.type === 'single_choice' || current.type === 'multiple_choice') {
      newQuestion.options = current.options.filter(o => o.trim());
      newQuestion.correct = current.type === 'single_choice' 
        ? current.correct 
        : Array.isArray(current.correct) ? current.correct : [];
    }

    setQuestions([...questions, newQuestion]);
    
    // Сброс формы
    setCurrent({ 
      text: '', 
      options: ['', '', ''], 
      correct: 0, 
      points: 10,
      type: 'single_choice',
      explanation: ''
    });
    
    setSuccess(t('new_question'));
    setTimeout(() => setSuccess(''), 2000);
  };

  // Удаление вопроса
  const removeQuestion = (index) => {
    const newQuestions = questions.filter((_, i) => i !== index);
    setQuestions(newQuestions.map((q, i) => ({ ...q, order: i + 1 })));
  };

  // Удаление варианта ответа
  const removeOption = (optionIndex) => {
    const newOptions = [...current.options];
    newOptions.splice(optionIndex, 1);
    
    let newCorrect = current.correct;
    if (current.type === 'single_choice') {
      if (current.correct === optionIndex) newCorrect = 0;
      else if (current.correct > optionIndex) newCorrect = current.correct - 1;
    }
    
    setCurrent({ ...current, options: newOptions, correct: newCorrect });
  };

  // Сохранение теста
  const saveTest = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    if (questions.length === 0) {
      setError(t('enter_at_least_one_question'));
      setLoading(false);
      return;
    }

    try {
      const testData = {
        course_id: courseId,
        lesson_id: lessonId,
        title: title.trim(),
        questions: questions.map(q => {
          const { id, ...rest } = q; // Удаляем временный id
          return rest;
        }),
        passing_score: passingScore,
        time_limit: timeLimit || null,
        allowed_attempts: allowedAttempts,
        show_results: showResults,
        total_points: questions.reduce((s, q) => s + q.points, 0),
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: test, error: supabaseError } = await supabase
        .from('tests')
        .insert(testData)
        .select()
        .single();

      if (supabaseError) throw supabaseError;

      // Обновляем урок
      const { error: updateError } = await supabase
        .from('lessons')
        .update({ 
          has_test: true, 
          test_id: test.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', lessonId);

      if (updateError) throw updateError;

      setSuccess(t('test_saved'));
      
      setTimeout(() => {
        onSave();
        onClose();
      }, 1500);

    } catch (err) {
      console.error('Ошибка сохранения теста:', err);
      setError(`${t('error')}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-h-[80vh] overflow-y-auto p-1">
      {/* Заголовок */}
      <div className="text-center">
        <h3 className="text-2xl font-bold text-gray-800 dark:text-white">
          {t('test_creation')}
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          {t('test_for_lesson')}
        </p>
      </div>

      {/* Сообщения */}
      {error && (
        <div className="p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-xl border border-red-300 dark:border-red-700">
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-xl border border-green-300 dark:border-green-700">
          ✅ {success}
        </div>
      )}

      {/* Настройки теста */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
        <h4 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">
          {t('test_settings')}
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('test_title')}
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={t('test_title')}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('passing_score')}
            </label>
            <input
              type="number"
              value={passingScore}
              onChange={e => setPassingScore(Math.min(100, Math.max(0, +e.target.value)))}
              min="0"
              max="100"
              placeholder="70"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('time_limit')}
            </label>
            <input
              type="number"
              value={timeLimit}
              onChange={e => setTimeLimit(+e.target.value)}
              min="0"
              placeholder="0 (no limit)"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('allowed_attempts')}
            </label>
            <input
              type="number"
              value={allowedAttempts}
              onChange={e => setAllowedAttempts(+e.target.value)}
              min="1"
              max="10"
              placeholder="1"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showResults}
              onChange={e => setShowResults(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-gray-700 dark:text-gray-300">{t('show_results')}</span>
          </label>
        </div>
      </div>

      {/* Создание вопроса */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
        <h4 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">
          {t('new_question')}
        </h4>
        
        <div className="space-y-4">
          {/* Тип вопроса */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('question_type')}
            </label>
            <select
              value={current.type}
              onChange={e => {
                const newType = e.target.value;
                setCurrent({
                  ...current,
                  type: newType,
                  options: newType === 'true_false' ? [t('true'), t('false')] : ['', '', ''],
                  correct: newType === 'true_false' ? 0 : 0
                });
              }}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="single_choice">{t('single_choice')}</option>
              <option value="multiple_choice">{t('multiple_choice')}</option>
              <option value="true_false">{t('true_false')}</option>
              <option value="text_answer">{t('text_answer')}</option>
            </select>
          </div>

          {/* Текст вопроса */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('question_text')}
            </label>
            <textarea
              value={current.text}
              onChange={e => setCurrent({ ...current, text: e.target.value })}
              placeholder={t('enter_question')}
              className="w-full p-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              rows="3"
            />
          </div>

          {/* Варианты ответов (для типов с выбором) */}
          {(current.type === 'single_choice' || current.type === 'multiple_choice' || current.type === 'true_false') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                {t('options')}
              </label>
              <div className="space-y-3">
                {current.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-3">
                    {current.type === 'single_choice' ? (
                      <input
                        type="radio"
                        name="correctOption"
                        checked={current.correct === i}
                        onChange={() => setCurrent({ ...current, correct: i })}
                        className="w-5 h-5 text-blue-600"
                      />
                    ) : (
                      <input
                        type="checkbox"
                        checked={Array.isArray(current.correct) ? current.correct.includes(i) : false}
                        onChange={(e) => {
                          const newCorrect = Array.isArray(current.correct) ? [...current.correct] : [];
                          if (e.target.checked) {
                            newCorrect.push(i);
                          } else {
                            const index = newCorrect.indexOf(i);
                            if (index > -1) newCorrect.splice(index, 1);
                          }
                          setCurrent({ ...current, correct: newCorrect });
                        }}
                        className="w-5 h-5 text-blue-600"
                      />
                    )}
                    
                    <input
                      type="text"
                      value={opt}
                      onChange={e => {
                        const opts = [...current.options];
                        opts[i] = e.target.value;
                        setCurrent({ ...current, options: opts });
                      }}
                      placeholder={`${t('option')} ${i + 1}`}
                      className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      readOnly={current.type === 'true_false'}
                    />
                    
                    {current.type !== 'true_false' && i >= 2 && (
                      <button
                        onClick={() => removeOption(i)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title={t('remove')}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                
                {current.type !== 'true_false' && (
                  <button
                    onClick={() => setCurrent({ ...current, options: [...current.options, ''] })}
                    className="text-blue-600 dark:text-blue-400 text-sm hover:underline flex items-center gap-2"
                  >
                    <span>+</span>
                    <span>{t('add_option')}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Объяснение */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('explanation')}
            </label>
            <textarea
              value={current.explanation}
              onChange={e => setCurrent({ ...current, explanation: e.target.value })}
              placeholder={t('why_correct')}
              className="w-full p-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              rows="2"
            />
          </div>

          {/* Баллы за вопрос */}
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('points_per_question')}
              </label>
              <input
                type="number"
                value={current.points}
                onChange={e => setCurrent({ ...current, points: Math.max(1, +e.target.value) })}
                min="1"
                max="100"
                className="w-24 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <button
              onClick={addQuestion}
              disabled={loading}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <span>+</span>
              <span>{t('add_question')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Добавленные вопросы */}
      {questions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
          <h4 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">
            {t('added_questions')} ({questions.length})
          </h4>
          
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {questions.map((q, i) => (
              <div 
                key={q.id} 
                className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <strong className="text-lg">{i + 1}.</strong>
                      <span className="text-sm px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                        {q.points} {t('points')}
                      </span>
                      <span className="text-sm px-2 py-1 bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded">
                        {t(q.type)}
                      </span>
                    </div>
                    <p className="text-gray-800 dark:text-gray-200 mb-2">{q.text}</p>
                    
                    {q.options && (
                      <div className="mt-2 space-y-1">
                        {q.options.map((opt, optIndex) => (
                          <div key={optIndex} className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${
                              (q.type === 'single_choice' && q.correct === optIndex) ||
                              (q.type === 'multiple_choice' && q.correct.includes(optIndex))
                                ? 'bg-green-500' 
                                : 'bg-gray-300 dark:bg-gray-500'
                            }`}></span>
                            <span className="text-gray-700 dark:text-gray-300">{opt}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {q.explanation && (
                      <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/30 rounded">
                        <span className="text-sm text-yellow-700 dark:text-yellow-300">
                          💡 {q.explanation}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={() => removeQuestion(i)}
                    className="text-red-500 hover:text-red-700 p-2"
                    title={t('remove')}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Итоговая информация */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('needed_to_pass')}</p>
                <p className="text-xl font-bold">{passingScore}%</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('test_points')}</p>
                <p className="text-xl font-bold">
                  {questions.reduce((s, q) => s + q.points, 0)} {t('points')}
                </p>
              </div>
            </div>
          </div>

          {/* Кнопка сохранения */}
          <button
            onClick={saveTest}
            disabled={loading || questions.length === 0}
            className="w-full mt-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>{t('save_to_supabase')}</span>
              </>
            ) : (
              <>
                             <span>💾</span>
                <span>{t('save_test')}</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Кнопка отмены */}
      <div className="text-center">
        <button
          onClick={onClose}
          className="px-6 py-3 bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold rounded-lg transition"
        >
          {t('cancel')}
        </button>
      </div>
    </div>
  );
};

export default TestCreatorInline;