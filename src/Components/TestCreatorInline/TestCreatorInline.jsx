// src/components/TestCreatorInline.jsx
import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';

const TestCreatorInline = ({ lessonId, courseId, onClose, onSave }) => {
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState({ text: '', options: ['', '', ''], correct: 0, points: 10 });
  const [title, setTitle] = useState('Тест по уроку');
  const [passingScore, setPassingScore] = useState(70);

  const addQuestion = () => {
    if (!current.text.trim()) return alert('Савол киритинг!');
    if (current.options.filter(o => o.trim()).length < 2) return alert('Камуда 2 та вариант бўлиши керак!');

    setQuestions([...questions, {
      text: current.text,
      options: current.options.filter(o => o.trim()),
      correct: current.correct,
      points: current.points
    }]);

    setCurrent({ text: '', options: ['', '', ''], correct: 0, points: 10 });
  };

  const saveTest = async () => {
    if (questions.length === 0) return alert('Камуда битта савол бўлиши керак!');

    try {
      const { data: test } = await supabase
        .from('tests')
        .insert({
          course_id: courseId,
          lesson_id: lessonId,
          title,
          questions: questions.map((q, i) => ({ ...q, order: i + 1 })),
          passing_score: passingScore,
          total_points: questions.reduce((s, q) => s + q.points, 0),
          status: 'active'
        })
        .select()
        .single();

      await supabase
        .from('lessons')
        .update({ has_test: true, test_id: test.id })
        .eq('id', lessonId);

      alert('✅ Тест сақланди!');
      setQuestions([]);
      onSave();
      onClose();
    } catch (err) {
      alert('Хатолик: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Тест номи"
          className="px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
        />
        <input
          type="number"
          value={passingScore}
          onChange={e => setPassingScore(+e.target.value)}
          min="50"
          max="100"
          className="px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
          placeholder="Ўтиш бали (%)"
        />
      </div>

      <div className="p-5 bg-white/70 dark:bg-gray-800/70 rounded-xl">
        <textarea
          value={current.text}
          onChange={e => setCurrent({ ...current, text: e.target.value })}
          placeholder="Савол матни..."
          className="w-full p-4 rounded-lg border mb-4"
          rows="3"
        />

        <div className="space-y-3">
          {current.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-3">
              <input
                type="radio"
                checked={current.correct === i}
                onChange={() => setCurrent({ ...current, correct: i })}
              />
              <input
                type="text"
                value={opt}
                onChange={e => {
                  const opts = [...current.options];
                  opts[i] = e.target.value;
                  setCurrent({ ...current, options: opts });
                }}
                placeholder={`Жавоб ${i + 1}`}
                className="flex-1 px-4 py-2 rounded-lg border"
              />
            </div>
          ))}
          <button
            onClick={() => setCurrent({ ...current, options: [...current.options, ''] })}
            className="text-blue-600 text-sm"
          >
            + Яна битта жавоб
          </button>
        </div>

        <input
          type="number"
          value={current.points}
          onChange={e => setCurrent({ ...current, points: +e.target.value })}
          min="1"
          className="w-24 px-3 py-2 rounded-lg border mt-3"
        />

        <button
          onClick={addQuestion}
          className="w-full mt-4 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl"
        >
          ✅ Савол қўшиш
        </button>
      </div>

      {questions.length > 0 && (
        <div>
          <p className="font-bold mb-3">Қўшилган саволлар ({questions.length})</p>
          <div className="space-y-2">
            {questions.map((q, i) => (
              <div key={i} className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm">
                <strong>{i + 1}.</strong> {q.text} ({q.points} балл)
              </div>
            ))}
          </div>

          <button
            onClick={saveTest}
            className="w-full mt-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition"
          >
            💾 Тестни сақлаш
          </button>
        </div>
      )}
    </div>
  );
};

export default TestCreatorInline;