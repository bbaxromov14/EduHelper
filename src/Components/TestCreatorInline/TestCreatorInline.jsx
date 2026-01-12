// src/components/TestCreatorInline.jsx
import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';

const TestCreatorInline = ({ lessonId, courseId, onClose, onSave }) => {
  const { t } = useTranslation();
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState({ 
    text: '', 
    options: ['', '', ''], 
    correct: 0, 
    points: 10 
  });
  const [title, setTitle] = useState(t('test_for_lesson', 'Dars uchun test'));
  const [passingScore, setPassingScore] = useState(70);
  const [saving, setSaving] = useState(false);

  const addQuestion = () => {
    if (!current.text.trim()) {
      alert(t('enter_question_text', 'Savol matnini kiriting!'));
      return;
    }
    
    const validOptions = current.options.filter(o => o.trim());
    if (validOptions.length < 2) {
      alert(t('minimum_two_options', 'Kamida 2 ta variant bo‘lishi kerak!'));
      return;
    }

    const newQuestion = {
      text: current.text.trim(),
      options: validOptions,
      correct: current.correct,
      points: current.points || 10,
      order: questions.length + 1
    };

    setQuestions([...questions, newQuestion]);
    
    // Reset form for new question
    setCurrent({ 
      text: '', 
      options: ['', '', ''], 
      correct: 0, 
      points: 10 
    });
  };

  const saveTest = async () => {
    if (questions.length === 0) {
      alert(t('enter_at_least_one_question', 'Kamida bitta savol qo‘shing!'));
      return;
    }

    setSaving(true);
    
    try {
      const totalPoints = questions.reduce((sum, q) => sum + (q.points || 10), 0);
      
      const { data: test, error } = await supabase
        .from('tests')
        .insert({
          course_id: courseId,
          lesson_id: lessonId,
          title: title.trim() || t('test_for_lesson', 'Dars uchun test'),
          questions: questions.map((q, i) => ({ ...q, order: i + 1 })),
          passing_score: passingScore,
          total_points: totalPoints,
          time_limit: 300, // 5 минут по умолчанию
          allowed_attempts: 1,
          show_results: true,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // Update lesson to mark it has a test
      await supabase
        .from('lessons')
        .update({ 
          has_test: true, 
          test_id: test.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', lessonId);

      alert(t('test_saved', '✅ Test saqlandi!'));
      
      // Reset state
      setQuestions([]);
      setTitle(t('test_for_lesson', 'Dars uchun test'));
      setPassingScore(70);
      
      // Notify parent
      if (onSave) onSave(test);
      if (onClose) onClose();
      
    } catch (err) {
      console.error('Test save error:', err);
      alert(`${t('error', 'Xatolik')}: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const removeQuestion = (index) => {
    const newQuestions = questions.filter((_, i) => i !== index);
    setQuestions(newQuestions);
  };

  const updateQuestionPoints = (index, newPoints) => {
    const newQuestions = [...questions];
    newQuestions[index].points = parseInt(newPoints) || 1;
    setQuestions(newQuestions);
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-900 p-6 rounded-2xl">
        <h3 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">
          🧪 {t('test_creation', 'Test yaratish')}
        </h3>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          {t('for_lesson', 'Dars uchun')}
        </p>
        
        {/* Test Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              {t('test_title', 'Test nomi')}
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={t('test_for_lesson', 'Dars uchun test')}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              {t('passing_score', 'O‘tish balli')} (%)
            </label>
            <input
              type="number"
              value={passingScore}
              onChange={e => setPassingScore(Math.min(100, Math.max(0, +e.target.value)))}
              min="0"
              max="100"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="70"
            />
          </div>
        </div>
      </div>

      {/* Question Creation Form */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
        <h4 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">
          ✏️ {t('new_question', 'Yangi savol')}
        </h4>
        
        {/* Question Text */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            {t('question_text', 'Savol matni')} *
          </label>
          <textarea
            value={current.text}
            onChange={e => setCurrent({ ...current, text: e.target.value })}
            placeholder={t('enter_question', 'Savolni kiriting...')}
            className="w-full p-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            rows="3"
          />
        </div>

        {/* Options */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
            {t('options', 'Variantlar')} *
          </label>
          <div className="space-y-3">
            {current.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-3">
                <input
                  type="radio"
                  name="correct-option"
                  checked={current.correct === i}
                  onChange={() => setCurrent({ ...current, correct: i })}
                  className="h-5 w-5 text-blue-600"
                />
                <input
                  type="text"
                  value={opt}
                  onChange={e => {
                    const opts = [...current.options];
                    opts[i] = e.target.value;
                    setCurrent({ ...current, options: opts });
                  }}
                  placeholder={`${t('option', 'Variant')} ${i + 1}`}
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                {current.options.length > 2 && (
                  <button
                    onClick={() => {
                      const opts = [...current.options];
                      opts.splice(i, 1);
                      setCurrent({ 
                        ...current, 
                        options: opts,
                        correct: current.correct >= i ? Math.max(0, current.correct - 1) : current.correct
                      });
                    }}
                    className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium hover:bg-red-200 dark:hover:bg-red-800/50"
                  >
                    {t('remove', 'O‘chirish')}
                  </button>
                )}
              </div>
            ))}
          </div>
          
          {/* Add more options button */}
          <button
            onClick={() => setCurrent({ ...current, options: [...current.options, ''] })}
            className="mt-3 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-200 dark:hover:bg-blue-800/50 flex items-center gap-2"
          >
            <span>+</span>
            {t('add_option', 'Variant qo‘shish')}
          </button>
          
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {t('select_correct_answer', 'To‘g‘ri javobni tanlang')}
          </div>
        </div>

        {/* Points */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            {t('points_per_question', 'Har bir savol uchun ball')}
          </label>
          <input
            type="number"
            value={current.points}
            onChange={e => setCurrent({ ...current, points: Math.max(1, +e.target.value) })}
            min="1"
            className="w-32 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        {/* Add Question Button */}
        <button
          onClick={addQuestion}
          className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
        >
          <span>✅</span>
          {t('add_question', 'Savol qo‘shish')}
        </button>
      </div>

      {/* Added Questions List */}
      {questions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-xl font-bold text-gray-800 dark:text-white">
              📋 {t('added_questions', 'Qo‘shilgan savollar')} ({questions.length})
            </h4>
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
              {t('test_total_points', 'Umumiy ball')}: {questions.reduce((sum, q) => sum + (q.points || 10), 0)}
            </div>
          </div>
          
          <div className="space-y-4">
            {questions.map((q, i) => (
              <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-bold text-gray-700 dark:text-gray-300">{i + 1}.</span>
                      <span className="font-medium text-gray-800 dark:text-white">{q.text}</span>
                    </div>
                    
                    <div className="ml-6 space-y-1">
                      {q.options.map((opt, oIndex) => (
                        <div 
                          key={oIndex} 
                          className={`flex items-center gap-2 ${oIndex === q.correct ? 'text-green-600 dark:text-green-400 font-medium' : 'text-gray-600 dark:text-gray-400'}`}
                        >
                          <div className={`w-4 h-4 flex items-center justify-center rounded-full text-xs ${oIndex === q.correct ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
                            {String.fromCharCode(65 + oIndex)}
                          </div>
                          <span>{opt}</span>
                          {oIndex === q.correct && (
                            <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-2 py-0.5 rounded">
                              {t('correct', 'To‘g‘ri')}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2 ml-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">{t('points', 'Ball')}:</span>
                      <input
                        type="number"
                        value={q.points || 10}
                        onChange={e => updateQuestionPoints(i, e.target.value)}
                        min="1"
                        className="w-16 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-center"
                      />
                    </div>
                    <button
                      onClick={() => removeQuestion(i)}
                      className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium hover:bg-red-200 dark:hover:bg-red-800/50"
                    >
                      {t('remove', 'O‘chirish')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Save Test Button */}
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-xl">
                <div className="text-sm text-gray-600 dark:text-gray-300">{t('added_questions', 'Savollar soni')}</div>
                <div className="text-2xl font-bold">{questions.length}</div>
              </div>
              <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-xl">
                <div className="text-sm text-gray-600 dark:text-gray-300">{t('total_points', 'Umumiy ball')}</div>
                <div className="text-2xl font-bold">{questions.reduce((sum, q) => sum + (q.points || 10), 0)}</div>
              </div>
              <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-xl">
                <div className="text-sm text-gray-600 dark:text-gray-300">{t('passing_score', 'O‘tish balli')}</div>
                <div className="text-2xl font-bold">{passingScore}%</div>
              </div>
            </div>
            
            <button
              onClick={saveTest}
              disabled={saving}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <span className="animate-spin">⏳</span>
                  {t('loading', 'Yuklanmoqda...')}
                </>
              ) : (
                <>
                  <span>💾</span>
                  {t('save_test', 'Testni saqlash')}
                </>
              )}
            </button>
            
            <div className="mt-3 text-center text-sm text-gray-500 dark:text-gray-400">
              {t('save_to_supabase', 'Ma\'lumotlar bazasiga saqlanadi')}
            </div>
          </div>
        </div>
      )}

      {/* Close button if no questions yet */}
      {questions.length === 0 && onClose && (
        <div className="text-center">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg font-medium"
          >
            ← {t('back', 'Orqaga')}
          </button>
        </div>
      )}
    </div>
  );
};

export default TestCreatorInline;