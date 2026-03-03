// src/Pages/Test/TestPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/ReactContext.jsx';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';
import confetti from 'canvas-confetti';

const TestPage = () => {
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const { t } = useTranslation();

  const [test, setTest] = useState(null);
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [newPointsEarned, setNewPointsEarned] = useState(0);
  const [alreadyEarnedQuestions, setAlreadyEarnedQuestions] = useState([]);
  const [attemptNumber, setAttemptNumber] = useState(1);
  const [hasMoreAttempts, setHasMoreAttempts] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadTestAndHistory = async () => {
      try {
        setLoading(true);

        // 1. Загружаем урок
        const { data: lessonData, error: lessonError } = await supabase
          .from('lessons')
          .select('title, test_id, course_id')
          .eq('id', lessonId)
          .single();

        if (lessonError || !lessonData?.test_id) {
          alert('Test topilmadi!');
          navigate(-1);
          return;
        }

        setLesson(lessonData);

        // 2. Загружаем тест
        const { data: testData, error: testError } = await supabase
          .from('tests')
          .select('*')
          .eq('id', lessonData.test_id)
          .single();

        if (testError || !testData) {
          alert('Test topilmadi!');
          navigate(-1);
          return;
        }

        // Нормализуем вопросы
        let questions = [];
        if (Array.isArray(testData.questions)) {
          questions = testData.questions;
        } else if (typeof testData.questions === 'string') {
          try {
            questions = JSON.parse(testData.questions);
          } catch (e) {
            console.error('Ошибка парсинга questions:', e);
            questions = [];
          }
        }

        // Сортируем вопросы по order
        questions.sort((a, b) => (a.order || 0) - (b.order || 0));

        const normalizedTest = {
          ...testData,
          questions: questions
        };

        setTest(normalizedTest);
        setTimeLeft(normalizedTest.time_limit || 300);

        // 3. Проверяем доступность попыток
        if (authUser && authUser.id) {
          // Загружаем все попытки
          const { data: results, error: resultsError } = await supabase
            .from('test_results')
            .select('user_answers, attempt_number')
            .eq('user_id', authUser.id)
            .eq('test_id', normalizedTest.id)
            .order('attempt_number', { ascending: false });

          if (!resultsError) {
            // Определяем номер следующей попытки
            if (results && results.length > 0) {
              const lastAttempt = results[0].attempt_number || 0;
              setAttemptNumber(lastAttempt + 1);
              
              // Проверяем, есть ли еще попытки
              const attemptsAllowed = normalizedTest.attempts_allowed || 1;
              setHasMoreAttempts(attemptsAllowed === 0 || lastAttempt < attemptsAllowed);
            }

            // Собираем вопросы, за которые уже получены баллы
            const earned = new Set();
            results?.forEach(result => {
              if (result.user_answers) {
                Object.keys(result.user_answers).forEach(qIndexStr => {
                  const qIndex = parseInt(qIndexStr);
                  const userAnswer = result.user_answers[qIndexStr];
                  const correctAnswer = normalizedTest.questions[qIndex]?.correct;

                  if (userAnswer !== null && userAnswer !== undefined && 
                      userAnswer === correctAnswer && correctAnswer !== undefined) {
                    earned.add(qIndex);
                  }
                });
              }
            });

            setAlreadyEarnedQuestions(Array.from(earned));
          }
        }

      } catch (error) {
        console.error('Критическая ошибка:', error);
        alert('Test yuklashda xatolik');
        navigate(-1);
      } finally {
        setLoading(false);
      }
    };

    loadTestAndHistory();
  }, [lessonId, authUser, navigate]);

  useEffect(() => {
    if (timeLeft <= 0 || showResults) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          finishTest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, showResults]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const selectAnswer = (qIndex, optionIndex) => {
    setAnswers({ ...answers, [qIndex]: optionIndex });
  };

  const finishTest = async () => {
    if (showResults || isSaving) return;
    
    setIsSaving(true);

    let newPoints = 0;
    const userAnswers = {};

    // Собираем ответы и считаем баллы
    test.questions.forEach((q, i) => {
      const userAnswer = answers[i];
      userAnswers[i] = userAnswer !== undefined ? userAnswer : null;
      
      const isCorrect = userAnswer === q.correct;
      const alreadyEarned = alreadyEarnedQuestions.includes(i);

      if (isCorrect && !alreadyEarned) {
        newPoints += q.points || 10;
      }
    });

    setNewPointsEarned(newPoints);
    setShowResults(true);

    if (newPoints > 0) {
      confetti({
        particleCount: 200,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#10b981', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444']
      });
    }

    // Сохраняем попытку в базу
    if (authUser && authUser.id && hasMoreAttempts) {
      try {
        const totalQuestions = test.questions.length;
        const correctCount = test.questions.reduce((count, q, i) => {
          return count + (answers[i] === q.correct ? 1 : 0);
        }, 0);
        
        const score = totalQuestions > 0 
          ? Math.round((correctCount / totalQuestions) * 100)
          : 0;

        // ВАЖНО: Получаем актуальный attempt_number перед сохранением
        let currentAttemptNumber = attemptNumber;
        
        // Проверяем, нет ли уже такой попытки
        const { data: existingAttempt } = await supabase
          .from('test_results')
          .select('attempt_number')
          .eq('user_id', authUser.id)
          .eq('test_id', test.id)
          .eq('attempt_number', currentAttemptNumber)
          .maybeSingle();

        // Если такая попытка уже существует, увеличиваем номер
        if (existingAttempt) {
          // Находим максимальный attempt_number
          const { data: maxAttemptData } = await supabase
            .from('test_results')
            .select('attempt_number')
            .eq('user_id', authUser.id)
            .eq('test_id', test.id)
            .order('attempt_number', { ascending: false })
            .limit(1)
            .single();
            
          currentAttemptNumber = (maxAttemptData?.attempt_number || 0) + 1;
        }

        // Формируем данные для сохранения
        const resultData = {
          user_id: authUser.id,
          test_id: test.id,
          lesson_id: lessonId,
          course_id: courseId,
          score: score,
          points_earned: newPoints,
          total_questions: totalQuestions,
          correct_answers: correctCount,
          user_answers: userAnswers,
          attempt_number: currentAttemptNumber,
          completed_at: new Date().toISOString()
        };

        const { error } = await supabase
          .from('test_results')
          .insert([resultData]);

        if (error) {
          console.error('Ошибка сохранения результатов:', error);
          
          // Если все еще ошибка дублирования, пробуем еще раз с увеличенным номером
          if (error.code === '23505') {
            const finalAttemptNumber = currentAttemptNumber + 1;
            const retryData = {
              ...resultData,
              attempt_number: finalAttemptNumber
            };

            const { error: retryError } = await supabase
              .from('test_results')
              .insert([retryData]);

            if (!retryError) {
              // Успешно сохранили с новым номером
              const updatedEarned = new Set(alreadyEarnedQuestions);
              test.questions.forEach((q, i) => {
                if (answers[i] === q.correct) {
                  updatedEarned.add(i);
                }
              });
              setAlreadyEarnedQuestions(Array.from(updatedEarned));
              setAttemptNumber(finalAttemptNumber + 1);
            }
          }
        } else {
          // Если сохранение успешно
          const updatedEarned = new Set(alreadyEarnedQuestions);
          test.questions.forEach((q, i) => {
            if (answers[i] === q.correct) {
              updatedEarned.add(i);
            }
          });
          setAlreadyEarnedQuestions(Array.from(updatedEarned));
          setAttemptNumber(currentAttemptNumber + 1);
        }

      } catch (err) {
        console.error('Ошибка сохранения попытки:', err);
        alert('Natijalarni saqlashda xatolik');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const tryAgain = () => {
    // Сбрасываем состояние теста
    setShowResults(false);
    setAnswers({});
    setCurrentQuestionIndex(0);
    setTimeLeft(test.time_limit || 300);
    setNewPointsEarned(0);
    
    // Не нужно обновлять attemptNumber здесь - он обновится при следующем сохранении
    // setAttemptNumber(prev => prev + 1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 flex items-center justify-center">
        <div className="text-3xl text-white font-bold">{t('loading', 'Yuklanmoqda...')}</div>
      </div>
    );
  }

  if (!test || !test.questions || test.questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-6">😔</div>
          <h2 className="text-3xl text-white font-bold mb-4">
            Test topilmadi yoki savollar mavjud emas
          </h2>
          <button
            onClick={() => navigate(`/subject/${courseId}`)}
            className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl text-white font-bold text-xl hover:scale-105 transition"
          >
            Kursga qaytish
          </button>
        </div>
      </div>
    );
  }

  // Если попытки закончились, показываем лучший результат
  if (!hasMoreAttempts && !showResults) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 py-12 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 md:p-12 border border-white/20 shadow-2xl">
            <h1 className="text-4xl md:text-5xl font-black text-white mb-8">
              ⛔ Urinishlar tugadi
            </h1>
            
            <div className="bg-white/10 rounded-2xl p-8 mb-8">
              <h3 className="text-2xl font-bold text-white mb-6">
                Sizning eng yaxshi natijangiz
              </h3>
              
              <div className="text-center text-white text-xl">
                Eng yaxshi natijangizni progress sahifasida ko'rishingiz mumkin
              </div>
            </div>
            
            <div className="text-center">
              <button
                onClick={() => navigate(`/subject/${courseId}`)}
                className="px-12 py-6 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl text-white font-bold text-2xl shadow-2xl hover:scale-105 transition"
              >
                Kursga qaytish
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = test.questions[currentQuestionIndex];
  const isQuestionEarned = alreadyEarnedQuestions.includes(currentQuestionIndex);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 md:p-12 border border-white/20 shadow-2xl">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl md:text-5xl font-black text-white">
                ❓ {lesson?.title} — Test
              </h1>
              <div className="text-lg text-white opacity-80 mt-2">
                Urinish: {attemptNumber} • {t('questions', 'Savollar')}: {test.questions.length}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-yellow-400">⏱ {formatTime(timeLeft)}</div>
              <div className="text-lg text-white opacity-80">
                {currentQuestionIndex + 1} / {test.questions.length}
              </div>
            </div>
          </div>

          {/* Индикатор, что за этот вопрос баллы уже получены */}
          {isQuestionEarned && (
            <div className="mb-6 p-4 bg-green-600/30 border border-green-500 rounded-xl text-green-300 text-center font-bold text-lg">
              ✅ Bu savol uchun ball allaqachon olingan!
            </div>
          )}

          {!showResults ? (
            <>
              <div className="mb-10">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl md:text-3xl font-bold text-white">
                    {currentQuestion?.text || `${t('question', 'Savol')} ${currentQuestionIndex + 1}`}
                  </h2>
                  <span className={`text-xl font-bold ${isQuestionEarned ? 'text-gray-500 line-through' : 'text-yellow-400'}`}>
                    +{currentQuestion?.points || 10} {t('points', 'ball')}
                  </span>
                </div>

                <div className="space-y-4">
                  {currentQuestion?.options?.map((option, i) => (
                    <button
                      key={i}
                      onClick={() => selectAnswer(currentQuestionIndex, i)}
                      className={`w-full p-6 text-left rounded-2xl text-xl font-medium transition-all ${
                        answers[currentQuestionIndex] === i
                          ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg scale-105'
                          : 'bg-white/20 hover:bg-white/30 text-white border border-white/10'
                      }`}
                    >
                      {String.fromCharCode(65 + i)}. {option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center">
                <button
                  onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                  disabled={currentQuestionIndex === 0}
                  className="px-8 py-4 bg-white/20 hover:bg-white/30 rounded-xl text-white font-bold disabled:opacity-50 transition"
                >
                  ← Oldingi
                </button>

                <div className="flex gap-4">
                  {currentQuestionIndex === test.questions.length - 1 ? (
                    <button
                      onClick={finishTest}
                      disabled={isSaving}
                      className="px-12 py-5 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl text-white font-bold text-2xl shadow-2xl hover:scale-105 transition disabled:opacity-50"
                    >
                      {isSaving ? 'Saqlanmoqda...' : 'Yakunlash'}
                    </button>
                  ) : (
                    <button
                      onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}
                      className="px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl text-white font-bold transition hover:scale-105"
                    >
                      Keyingi →
                    </button>
                  )}
                </div>
              </div>

              {/* Навигация по вопросам */}
              <div className="mt-8">
                <div className="flex flex-wrap gap-2 justify-center">
                  {test.questions.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentQuestionIndex(i)}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        currentQuestionIndex === i
                          ? 'bg-blue-600 text-white'
                          : answers[i] !== undefined
                          ? 'bg-green-500 text-white'
                          : 'bg-white/20 text-white'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-16">
              <div className="text-9xl mb-8">🎉</div>
              <h2 className="text-5xl font-black text-white mb-8">
                Test tugadi!
              </h2>
              
              <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 mb-10">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                  <div className="text-center">
                    <div className="text-4xl text-blue-400 font-black mb-2">
                      {test.questions.filter((q, i) => answers[i] === q.correct).length}/{test.questions.length}
                    </div>
                    <div className="text-lg text-gray-300">To'g'ri javoblar</div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl text-green-400 font-black mb-2">
                      +{newPointsEarned} {t('points', 'ball')}
                    </div>
                    <div className="text-lg text-gray-300">Yangi ballar</div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl text-yellow-400 font-black mb-2">
                      {Math.round((test.questions.filter((q, i) => answers[i] === q.correct).length / test.questions.length) * 100)}%
                    </div>
                    <div className="text-lg text-gray-300">Natija</div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl text-purple-400 font-black mb-2">
                      {attemptNumber}
                    </div>
                    <div className="text-lg text-gray-300">Urinish</div>
                  </div>
                </div>
                
                <div className="text-center">
                  {newPointsEarned > 0 ? (
                    <p className="text-2xl text-white mb-10">
                      Yangi to'g'ri javoblar uchun rahmat! 🔥
                    </p>
                  ) : (
                    <p className="text-2xl text-gray-300 mb-10">
                      Bu safar yangi ball olmadingiz — lekin bilimlaringizni mustahkamladingiz! 👏
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                {hasMoreAttempts && (
                  <button
                    onClick={tryAgain}
                    className="px-12 py-6 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl text-white font-bold text-2xl shadow-2xl hover:scale-105 transition"
                  >
                    Qayta urinish
                  </button>
                )}
                <button
                  onClick={() => navigate(`/subject/${courseId}`)}
                  className="px-12 py-6 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl text-white font-bold text-2xl shadow-2xl hover:scale-105 transition"
                >
                  Kursga qaytish
                </button>
                {authUser && (
                  <button
                    onClick={() => navigate('/progress')}
                    className="px-12 py-6 bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl text-white font-bold text-2xl shadow-2xl hover:scale-105 transition"
                  >
                    Progressni ko'rish
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TestPage;