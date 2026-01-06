import React, { useState, useEffect } from 'react'
import { Route, Routes, BrowserRouter } from 'react-router-dom'
import Mainlayout from './Mainlayout'
import items from './Utils/Utils'
import Login from './Pages/Login/Login'
import { AuthProvider } from './context/ReactContext.jsx'
import Subject from './Pages/Subject/Subject.jsx'
import Profile from './Components/Profile/Profile.jsx'
import AdminPanel from './Pages/AdminPanel/AdminPanel.jsx'
import VerifyCode from './Pages/VerifyCode/VerifyCode.jsx'
import CourseManage from './Pages/AdminPanel/CourseManage.jsx'
import ProtectedRoute from './Components/ProtectedRoute/ProtectedRoute.jsx'
import AuthCallback from './Pages/AuthCallback.jsx'
import DonateSystem from './Components/DonateSystem/DonateSystem.jsx'
import Premium from './Pages/Premium/Premium'
import CourseBuy from './Pages/CourseBuy/CourseBuy.jsx'
import CheckEmail from './Pages/CheckEmail.jsx'
import { checkSupabaseConnection } from './lib/supabase'
import TestPage from './Pages/Test/TestPage.jsx'
import Achievements from './Pages/Achievements/Achievements.jsx'
import SitePage from './Components/SitePage/SitePage.jsx'
import Referrals from './Pages/Referrals/Referrals.jsx'
import ForumPage from './Pages/ForumPage/ForumPage.jsx'

// УДАЛИ ЭТУ СТРОКУ — больше не нужна отдельная страница
// import TestCreator from './Components/TestCreator/TestCreator.jsx'

const App = () => {
  const [appLoading, setAppLoading] = useState(true);
  const [appError, setAppError] = useState(null);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        
        const connection = await checkSupabaseConnection();
        
        if (!connection.success) {
          throw new Error(`Подключение не удалось: ${connection.error || 'Неизвестная ошибка'}`);
        }
        
      } catch (error) {
        console.error("Ошибка инициализации:", error);
        setAppError(error.message);
      } finally {
        setAppLoading(false);
      }
    };

    initializeApp();
  }, []);

  const safeItems = React.useMemo(() => {
    if (!Array.isArray(items)) {
      console.error('Items is not an array');
      return [];
    }
    return items.filter(item =>
      item &&
      typeof item.id !== 'undefined' &&
      typeof item.path === 'string' &&
      React.isValidElement(item.element)
    );
  }, []);

  if (appLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-cyan-500 mx-auto mb-6"></div>
          <p className="text-xl text-white font-medium">Tizim yuklanmoqda...</p>
          <p className="text-gray-400 mt-2">Iltimos kuting</p>
        </div>
      </div>
    );
  }

  if (appError) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center p-8 max-w-lg">
          <div className="text-6xl mb-6">⚠️</div>
          <h1 className="text-3xl font-bold text-red-500 mb-4">Xatolik yuz berdi</h1>
          <p className="text-white mb-6 bg-gray-900/50 p-4 rounded-lg">
            {appError}
          </p>
          <div className="space-y-4">
            <button 
              onClick={() => window.location.reload()} 
              className="w-full px-6 py-3 bg-cyan-600 rounded-lg hover:bg-cyan-700 text-white font-medium"
            >
              Qayta yuklash
            </button>
            <p className="text-gray-400 text-sm">
              Agar muammo takrorlansa, iltimos administratorga murojaat qiling
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path='/' element={<Mainlayout />}>
            {safeItems.map(parent => (
              <Route
                key={parent.id}
                path={parent.path}
                element={parent.element}
              />
            ))}

            <Route
              path="profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />

            <Route
              path="subject/:subjectId"
              element={
                <ProtectedRoute>
                  <Subject />
                </ProtectedRoute>
              }
            />

            <Route
              path="eh-secret-admin-2025"
              element={
                <ProtectedRoute adminOnly={true}>
                  <AdminPanel />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Остальные роуты вне Mainlayout */}
          <Route path="/verify-code" element={<VerifyCode />} />
          <Route path="login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/donate" element={<DonateSystem />} />
          <Route path="/premium" element={<Premium />} />
          <Route path="/course-buy/:id" element={<CourseBuy />} />
          <Route path="/check-email" element={<CheckEmail />} />
          <Route path="/test/:courseId/:lessonId" element={<TestPage />} />
          <Route path="/achievements" element={<Achievements />} />
          <Route path="/page/:slug" element={<SitePage />} />
          <Route path="/referrals" element={<Referrals />} />
          <Route path="/forum" element={<ForumPage />} />

          {/* КЛЮЧЕВОЙ РОУТ — управление уроками (доступ только админу) */}
          <Route
            path="/course-manage/:courseId"
            element={
              <ProtectedRoute adminOnly={true}>
                <CourseManage />
              </ProtectedRoute>
            }
          />

          {/* 404 — в конце */}
          <Route
            path="*"
            element={
              <div className="min-h-screen flex items-center justify-center bg-black">
                <div className="text-center">
                  <h1 className="text-4xl font-bold text-white mb-4">404 - Sahifa topilmadi</h1>
                  <p className="text-gray-400 mb-6">Siz qidirgan sahifa mavjud emas</p>
                  <a 
                    href="/" 
                    className="px-6 py-3 bg-cyan-600 rounded-lg hover:bg-cyan-700 text-white"
                  >
                    Bosh sahifaga qaytish
                  </a>
                </div>
              </div>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App