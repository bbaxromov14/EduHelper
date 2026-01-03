// src/Pages/Test/TestPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/ReactContext.jsx';
import { supabase } from '../../lib/supabase';
import confetti from 'canvas-confetti';

const TestPage = () => {
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();

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

  useEffect(() => {
    
    const loadTestAndHistory = async () => {
      try {
        setLoading(true);

        // 1. Загружаем урок (чтобы получить test_id)
        const { data: lessonData, error: lessonError } = await supabase
          .from('lessons')
          .select('title, test_id')
          .eq('id', lessonId)
          .single();


        if (lessonError || !lessonData?.test_id) {
          console.error('Ошибка загрузки урока или нет test_id:', lessonError);
          alert('Тест не найден!');
          navigate(-1);
          return;
        }

        setLesson(lessonData);

        // 2. Загружаем сам тест
        const { data: testData, error: testError } = await supabase
          .from('tests')
          .select('*')
          .eq('id', lessonData.test_id)
          .single();


        if (testError || !testData) {
          console.error('Ошибка загрузки теста:', testError);
          alert('Тест не найден!');
          navigate(-1);
          return;
        }

        // Проверяем и нормализуем структуру questions
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

        // Создаем новый объект теста с нормализованными вопросами
        const normalizedTest = {
          ...testData,
          questions: questions
        };


        setTest(normalizedTest);
        setTimeLeft(normalizedTest.time_limit || 300);

        // 3. Загружаем историю всех попыток пользователя по этому тесту
        if (authUser && authUser.id) {
          
          const { data: results, error: resultsError } = await supabase
            .from('test_results')
            .select('user_answers, attempt_number')
            .eq('user_id', authUser.id)
            .eq('test_id', normalizedTest.id)
            .order('attempt_number', { ascending: false });


          if (resultsError) {
            console.error('Ошибка загрузки истории тестов:', resultsError);
          } else {
            const earned = new Set();
            
            // Определяем номер следующей попытки
            if (results && results.length > 0) {
              const lastAttempt = results[0].attempt_number || 0;
              setAttemptNumber(lastAttempt + 1);
            }

            // Собираем вопросы, за которые уже получены баллы
            results?.forEach(result => {
              if (result.user_answers) {
                Object.keys(result.user_answers).forEach(qIndexStr => {
                  const qIndex = parseInt(qIndexStr);
                  const userAnswer = result.user_answers[qIndexStr];
                  
                  // Используем нормализованный тест для получения правильного ответа
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
        alert('Ошибка загрузки теста');
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
    if (showResults) return;

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
    if (authUser && authUser.id) {
      try {
        // Подсчет результатов
        const totalQuestions = test.questions.length;
        const correctCount = test.questions.reduce((count, q, i) => {
          return count + (answers[i] === q.correct ? 1 : 0);
        }, 0);
        
        const score = totalQuestions > 0 
          ? Math.round((correctCount / totalQuestions) * 100)
          : 0;

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
          attempt_number: attemptNumber,
          completed_at: new Date().toISOString()
        };


        const { data, error } = await supabase
          .from('test_results')
          .insert([resultData])
          .select();

        if (error) {
          console.error('Ошибка Supabase при сохранении test_results:', error);
          console.error('Детали ошибки:', error.details, error.hint, error.code);
          
          // Попробуем сохранить без ненужных полей
          const minimalData = {
            user_id: authUser.id,
            test_id: test.id,
            lesson_id: lessonId,
            course_id: courseId,
            score: score,
            points_earned: newPoints,
            user_answers: userAnswers,
            attempt_number: attemptNumber,
            completed_at: new Date().toISOString()
          };
          
          
          const { data: minData, error: minError } = await supabase
            .from('test_results')
            .insert([minimalData])
            .select();
            
          if (minError) {
            alert(`Ошибка сохранения: ${minError.message}`);
          } else {
          }
        } else {
        }

        // Обновляем локальное состояние
        const updatedEarned = new Set(alreadyEarnedQuestions);
        test.questions.forEach((q, i) => {
          if (answers[i] === q.correct) {
            updatedEarned.add(i);
          }
        });
        setAlreadyEarnedQuestions(Array.from(updatedEarned));

      } catch (err) {
        console.error('Ошибка сохранения попытки:', err);
        alert('Ошибка при сохранении результатов теста');
      }
    } else {
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 flex items-center justify-center">
        <div className="text-3xl text-white font-bold">Test yuklanmoqda...</div>
      </div>
    );
  }

  if (!test || !test.questions || test.questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-6">😔</div>
          <h2 className="text-3xl text-white font-bold mb-4">Test topilmadi yoki savollar mavjud emas</h2>
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

  const currentQuestion = test.questions[currentQuestionIndex];
  const isQuestionEarned = alreadyEarnedQuestions.includes(currentQuestionIndex);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 md:p-12 border border-white/20 shadow-2xl">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl md:text-5xl font-black text-white">
              ❓ {lesson?.title} — Test
            </h1>
            <div className="text-right">
              <div className="text-2xl font-bold text-yellow-400">⏱ {formatTime(timeLeft)}</div>
              <div className="text-lg text-white opacity-80">
                {currentQuestionIndex + 1} / {test.questions.length}
              </div>
              {attemptNumber > 1 && (
                <div className="text-sm text-gray-300">
                  Urinish: {attemptNumber}
                </div>
              )}
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
                    {currentQuestion?.text || `Savol ${currentQuestionIndex + 1}`}
                  </h2>
                  <span className={`text-xl font-bold ${isQuestionEarned ? 'text-gray-500 line-through' : 'text-yellow-400'}`}>
                    +{currentQuestion?.points || 10} ball
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
                      {i + 1}. {option}
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

                {currentQuestionIndex === test.questions.length - 1 ? (
                  <button
                    onClick={finishTest}
                    className="px-12 py-5 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl text-white font-bold text-2xl shadow-2xl hover:scale-105 transition"
                  >
                    Yakunlash
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
            </>
          ) : (
            <div className="text-center py-16">
              <div className="text-9xl mb-8">🎉</div>
              <h2 className="text-5xl font-black text-white mb-8">
                Test tugadi!
              </h2>
              
              <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 mb-10">
                <div className="grid grid-cols-2 gap-6 mb-8">
                  <div className="text-center">
                    <div className="text-4xl text-blue-400 font-black mb-2">
                      {test.questions.filter((q, i) => answers[i] === q.correct).length}/{test.questions.length}
                    </div>
                    <div className="text-lg text-gray-300">To'g'ri javoblar</div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl text-green-400 font-black mb-2">
                      +{newPointsEarned} ball
                    </div>
                    <div className="text-lg text-gray-300">Yangi ballar</div>
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl text-yellow-400 font-bold mb-4">
                    Umumiy ballaringiz: {authUser ? "Progress sahifasida ko'rasiz" : newPointsEarned}
                  </div>
                </div>
              </div>
              
              {newPointsEarned > 0 ? (
                <p className="text-2xl text-white mb-10">
                  Yangi to'g'ri javoblar uchun rahmat! 🔥
                </p>
              ) : (
                <p className="text-2xl text-gray-300 mb-10">
                  Bu safar yangi ball olmadingiz — lekin bilimlaringizni mustahkamladingiz! 👏
                </p>
              )}
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => navigate(`/subject/${courseId}`)}
                  className="px-12 py-6 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl text-white font-bold text-2xl shadow-2xl hover:scale-105 transition"
                >
                  Kursga qaytish
                </button>
                <button
                  onClick={() => navigate('/progress')}
                  className="px-12 py-6 bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl text-white font-bold text-2xl shadow-2xl hover:scale-105 transition"
                >
                  Progressni ko'rish
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TestPage;