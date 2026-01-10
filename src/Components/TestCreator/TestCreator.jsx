import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next'; // Добавляем хук для переводов

const TestCreator = ({ courseId, lessonId }) => {
  const { t } = useTranslation(); // Инициализируем хук переводов
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState({
    text: '',
    type: 'multiple-choice',
    options: ['', '', '', ''],
    correctAnswer: 0,
    points: 10,
    explanation: '',
    videoTimestamp: '00:00'
  });
  const [testSettings, setTestSettings] = useState({
    title: t('test_for_lesson') || 'Тест по уроку',
    passingScore: 70,
    timeLimit: 300,
    attemptsAllowed: 3,
    showResults: true
  });

  // Обновляем заголовок теста при изменении языка
  React.useEffect(() => {
    setTestSettings(prev => ({
      ...prev,
      title: t('test_for_lesson') || 'Тест по уроку'
    }));
  }, [t]);

  // Добавить вопрос
  const addQuestion = () => {
    if (!currentQuestion.text.trim()) {
      alert(t('enter_question_text') || 'Введите текст вопроса!');
      return;
    }

    const newQuestion = {
      ...currentQuestion,
      id: Date.now() + Math.random(),
      options: currentQuestion.type === 'multiple-choice' || currentQuestion.type === 'single-choice'
        ? currentQuestion.options.filter(opt => opt.trim() !== '')
        : []
    };

    setQuestions([...questions, newQuestion]);
    
    // Сброс формы
    setCurrentQuestion({
      text: '',
      type: 'multiple-choice',
      options: ['', '', '', ''],
      correctAnswer: 0,
      points: 10,
      explanation: '',
      videoTimestamp: '00:00'
    });
  };

  // Удалить вопрос
  const removeQuestion = (id) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  // Сохранить тест в Supabase
  const saveTest = async () => {
    if (questions.length === 0) {
      alert(t('enter_at_least_one_question') || 'Добавьте хотя бы один вопрос!');
      return;
    }

    try {
      // 1. Сохраняем тест в таблицу tests
      const { data: testData, error: testError } = await supabase
        .from('tests')
        .insert({
          course_id: courseId,
          lesson_id: lessonId,
          title: testSettings.title,
          questions: questions.map((q, index) => ({
            ...q,
            order: index + 1,
            id: undefined
          })),
          passing_score: testSettings.passingScore,
          time_limit: testSettings.timeLimit,
          attempts_allowed: testSettings.attemptsAllowed,
          show_results: testSettings.showResults,
          total_points: questions.reduce((sum, q) => sum + q.points, 0),
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (testError) throw testError;

      // 2. Обновляем урок
      const { error: lessonError } = await supabase
        .from('lessons')
        .update({
          has_test: true,
          test_id: testData.id
        })
        .eq('id', lessonId);

      if (lessonError) {
        console.error('Ошибка обновления урока:', lessonError);
      }

      alert(t('test_saved') || '✅ Тест успешно сохранен!');
      setQuestions([]);

    } catch (error) {
      console.error('Ошибка сохранения теста:', error);
      alert(t('save_error') || 'Ошибка: ' + error.message);
    }
  };

  return (
    <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
      <h3 className="text-xl font-bold mb-6">
        📝 {t('test_creation') || 'Создание теста для урока'}
      </h3>

      {/* Настройки теста */}
      <div className="mb-8 p-4 bg-gray-900/50 rounded-xl">
        <h4 className="font-bold mb-4">⚙️ {t('test_settings') || 'Настройки теста'}</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-2">{t('test_title') || 'Название теста'}</label>
            <input
              type="text"
              value={testSettings.title}
              onChange={(e) => setTestSettings({...testSettings, title: e.target.value})}
              className="w-full p-3 bg-gray-800 rounded-lg"
              placeholder={t('for_lesson') || 'Тест по теме...'}
            />
          </div>
          <div>
            <label className="block text-sm mb-2">{t('passing_score') || 'Проходной балл (%)'}</label>
            <input
              type="number"
              min="0"
              max="100"
              value={testSettings.passingScore}
              onChange={(e) => setTestSettings({...testSettings, passingScore: parseInt(e.target.value)})}
              className="w-full p-3 bg-gray-800 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm mb-2">{t('time_limit') || 'Лимит времени (сек)'}</label>
            <input
              type="number"
              min="60"
              max="3600"
              value={testSettings.timeLimit}
              onChange={(e) => setTestSettings({...testSettings, timeLimit: parseInt(e.target.value)})}
              className="w-full p-3 bg-gray-800 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm mb-2">{t('allowed_attempts') || 'Попыток разрешено'}</label>
            <input
              type="number"
              min="1"
              max="10"
              value={testSettings.attemptsAllowed}
              onChange={(e) => setTestSettings({...testSettings, attemptsAllowed: parseInt(e.target.value)})}
              className="w-full p-3 bg-gray-800 rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Форма создания вопроса */}
      <div className="mb-8 p-4 bg-gray-900/50 rounded-xl">
        <h4 className="font-bold mb-4">➕ {t('new_question') || 'Новый вопрос'}</h4>
        
        <div className="space-y-4">
          {/* Текст вопроса */}
          <div>
            <label className="block text-sm mb-2">{t('question_text') || 'Текст вопроса *'}</label>
            <textarea
              value={currentQuestion.text}
              onChange={(e) => setCurrentQuestion({...currentQuestion, text: e.target.value})}
              className="w-full p-3 bg-gray-800 rounded-lg h-24"
              placeholder={t('enter_question') || 'Введите вопрос...'}
            />
          </div>

          {/* Тип вопроса */}
          <div>
            <label className="block text-sm mb-2">{t('question_type') || 'Тип вопроса'}</label>
            <select
              value={currentQuestion.type}
              onChange={(e) => setCurrentQuestion({...currentQuestion, type: e.target.value})}
              className="w-full p-3 bg-gray-800 rounded-lg"
            >
              <option value="multiple-choice">{t('multiple_choice') || 'Множественный выбор'}</option>
              <option value="true-false">{t('true_false') || 'Верно/Неверно'}</option>
              <option value="single-choice">{t('single_choice') || 'Один вариант'}</option>
              <option value="text">{t('text_answer') || 'Текстовый ответ'}</option>
            </select>
          </div>

          {/* Варианты ответов */}
          {(currentQuestion.type === 'multiple-choice' || currentQuestion.type === 'single-choice') && (
            <div>
              <label className="block text-sm mb-2">{t('options') || 'Варианты ответов'}</label>
              {currentQuestion.options.map((option, index) => (
                <div key={index} className="flex items-center gap-3 mb-2">
                  <input
                    type="radio"
                    name="correctAnswer"
                    checked={currentQuestion.correctAnswer === index}
                    onChange={() => setCurrentQuestion({...currentQuestion, correctAnswer: index})}
                    className="w-4 h-4"
                  />
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...currentQuestion.options];
                      newOptions[index] = e.target.value;
                      setCurrentQuestion({...currentQuestion, options: newOptions});
                    }}
                    className="flex-1 p-2 bg-gray-800 rounded-lg"
                    placeholder={`${t('option') || 'Вариант'} ${index + 1}`}
                  />
                  <button
                    onClick={() => {
                      const newOptions = currentQuestion.options.filter((_, i) => i !== index);
                      setCurrentQuestion({...currentQuestion, options: newOptions});
                    }}
                    className="px-3 py-1 bg-red-600 rounded-lg text-sm"
                  >
                    {t('remove') || '✕'}
                  </button>
                </div>
              ))}
              <button
                onClick={() => setCurrentQuestion({
                  ...currentQuestion, 
                  options: [...currentQuestion.options, '']
                })}
                className="mt-2 px-4 py-2 bg-blue-600 rounded-lg text-sm"
              >
                + {t('add_option') || 'Добавить вариант'}
              </button>
            </div>
          )}

          {/* Для верно/неверно */}
          {currentQuestion.type === 'true-false' && (
            <div>
              <label className="block text-sm mb-2">{t('correct_answer') || 'Правильный ответ'}</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="trueFalse"
                    checked={currentQuestion.correctAnswer === 0}
                    onChange={() => setCurrentQuestion({...currentQuestion, correctAnswer: 0})}
                  />
                  {t('true') || 'Верно'}
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="trueFalse"
                    checked={currentQuestion.correctAnswer === 1}
                    onChange={() => setCurrentQuestion({...currentQuestion, correctAnswer: 1})}
                  />
                  {t('false') || 'Неверно'}
                </label>
              </div>
            </div>
          )}

          {/* Баллы и время видео */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-2">{t('points_per_question') || 'Баллы за вопрос'}</label>
              <input
                type="number"
                min="1"
                max="100"
                value={currentQuestion.points}
                onChange={(e) => setCurrentQuestion({...currentQuestion, points: parseInt(e.target.value)})}
                className="w-full p-3 bg-gray-800 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm mb-2">{t('video_time') || 'Время в видео (мм:сс)'}</label>
              <input
                type="text"
                value={currentQuestion.videoTimestamp}
                onChange={(e) => setCurrentQuestion({...currentQuestion, videoTimestamp: e.target.value})}
                className="w-full p-3 bg-gray-800 rounded-lg"
                placeholder="05:30"
              />
            </div>
          </div>

          {/* Объяснение ответа */}
          <div>
            <label className="block text-sm mb-2">{t('explanation') || 'Объяснение (показывается после ответа)'}</label>
            <textarea
              value={currentQuestion.explanation}
              onChange={(e) => setCurrentQuestion({...currentQuestion, explanation: e.target.value})}
              className="w-full p-3 bg-gray-800 rounded-lg h-20"
              placeholder={t('why_answer_correct') || 'Почему этот ответ правильный...'}
            />
          </div>

          {/* Кнопка добавления */}
          <button
            onClick={addQuestion}
            className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg font-bold hover:opacity-90"
          >
            ✅ {t('add_question') || 'Добавить вопрос'}
          </button>
        </div>
      </div>

      {/* Список добавленных вопросов */}
      {questions.length > 0 && (
        <div className="mb-8">
          <h4 className="font-bold mb-4">
            📋 {t('added_questions') || 'Добавленные вопросы'} ({questions.length})
          </h4>
          <div className="space-y-4">
            {questions.map((question, index) => (
              <div key={question.id} className="p-4 bg-gray-900/50 rounded-xl border border-gray-700">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="text-gray-400">#{index + 1}</span>
                    <span className="ml-2 font-bold">{question.text}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="px-2 py-1 bg-yellow-600 rounded text-xs">
                      {question.points} {t('points') || 'баллов'}
                    </span>
                    <button
                      onClick={() => removeQuestion(question.id)}
                      className="px-3 py-1 bg-red-600 rounded-lg text-sm"
                    >
                      {t('remove') || 'Удалить'}
                    </button>
                  </div>
                </div>
                {question.type === 'multiple-choice' && (
                  <div className="mt-2">
                    <div className="text-sm text-gray-400">{t('options') || 'Варианты'}:</div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {question.options.map((opt, idx) => (
                        <div 
                          key={idx} 
                          className={`px-3 py-1 rounded ${idx === question.correctAnswer ? 'bg-green-700' : 'bg-gray-700'}`}
                        >
                          {opt} {idx === question.correctAnswer && '✓'}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {question.explanation && (
                  <div className="mt-2 text-sm text-gray-400">
                    💡 {question.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Итоговая статистика */}
          <div className="mt-6 p-4 bg-blue-900/20 rounded-xl">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-lg font-bold">
                  {t('total_points') || 'Всего баллов'}: {questions.reduce((sum, q) => sum + q.points, 0)}
                </div>
                <div className="text-sm text-gray-400">
                  {t('needed_to_pass') || 'Для прохождения нужно'}: {testSettings.passingScore}%
                </div>
              </div>
              <button
                onClick={saveTest}
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-bold hover:opacity-90"
              >
                💾 {t('save_to_supabase') || 'Сохранить тест в Supabase'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestCreator;