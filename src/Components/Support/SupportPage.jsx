import React, { useState } from 'react';
import './SupportPage.css';
import { 
  FaTelegram, 
  FaQuestionCircle, 
  FaPaperPlane, 
  FaClock,
  FaEnvelope,
  FaFileAlt
} from 'react-icons/fa';

const SupportPage = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    category: 'technical',
    message: '',
    attachment: null
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const categories = [
    { value: 'technical', label: 'Texnik muammo' },
    { value: 'account', label: 'Hisob bilan bog\'liq savol' },
    { value: 'payment', label: 'To\'lov masalalari' },
    { value: 'suggestion', label: 'Taklif' },
    { value: 'other', label: 'Boshqa' }
  ];

  const faqItems = [
    {
      question: "Bot javob bermayapti, nima qilish kerak?",
      answer: "1. Botni qayta ishga tushiring (/start)\n2. Internet aloqangizni tekshiring\n3. 5 daqiqadan keyin qayta urinib ko'ring"
    },
    {
      question: "Premium obuna nimalarni o'z ichiga oladi?",
      answer: "Premium obuna: cheksiz savollar, video darslar, imtihon materiallari va birinchi navbatda qo'llab-quvvatlash."
    },
    {
      question: "To'lov qaytariladimi?",
      answer: "Ha, 3 kun ichida istalgan vaqtda to'lovni qaytarishingiz mumkin. EduHelperuz@gmail.com ga murojaat qiling."
    }
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    setFormData(prev => ({ ...prev, attachment: e.target.files[0] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name);
      formDataToSend.append('email', formData.email);
      formDataToSend.append('category', formData.category);
      formDataToSend.append('message', formData.message);
      if (formData.attachment) {
        formDataToSend.append('attachment', formData.attachment);
      }

      // Отправка на ваш сервер
      const response = await fetch('https://ваш-сервер.com/api/support', {
        method: 'POST',
        body: formDataToSend
      });

      if (response.ok) {
        setIsSuccess(true);
        setFormData({
          name: '',
          email: '',
          category: 'technical',
          message: '',
          attachment: null
        });
        
        // Через 5 секунд скрыть сообщение об успехе
        setTimeout(() => setIsSuccess(false), 5000);
      }
    } catch (error) {
      console.error('Xatolik:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="support-container">
      <div className="support-header">
        <h1><FaQuestionCircle /> EduHelper Qo'llab-quvvatlash markazi</h1>
        <p className="subtitle">
          Biz sizning murojaatingizni 24 soat ichida javob berishga harakat qilamiz
        </p>
      </div>

      <div className="support-grid">
        {/* Левая колонка - FAQ */}
        <div className="faq-section">
          <h2><FaQuestionCircle /> Tez-tez so'raladigan savollar (FAQ)</h2>
          <div className="faq-list">
            {faqItems.map((item, index) => (
              <div key={index} className="faq-item">
                <h3>{item.question}</h3>
                <p>{item.answer}</p>
              </div>
            ))}
          </div>

          {/* Telegram Bot информация */}
          <div className="telegram-info">
            <h3><FaTelegram /> Telegram orqali yordam</h3>
            <p>Tezkor javob olish uchun Telegram botimizga yozing:</p>
            <a 
              href="https://t.me/eduhelper_support_bot" 
              target="_blank" 
              rel="noopener noreferrer"
              className="telegram-button"
            >
              <FaTelegram /> @eduhelper_support_bot
            </a>
            <p className="response-time">
              <FaClock /> Javob vaqti: 5-15 daqiqa
            </p>
          </div>
        </div>

        {/* Правая колонка - Форма */}
        <div className="form-section">
          <h2><FaEnvelope /> Javob topilmadi? Bizga yozing!</h2>
          
          {isSuccess && (
            <div className="success-message">
              ✅ Rahmat! Murojaatingiz qabul qilindi. 
              <br />
              Biz sizga <strong>eduhelperuz@gmail.com</strong> manzilidan javob yuboramiz.
            </div>
          )}

          <form onSubmit={handleSubmit} className="support-form">
            <div className="form-group">
              <label htmlFor="name">Ismingiz</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="Ismingizni kiriting"
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Elektron pochta manzilingiz *</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="sizning@email.com"
              />
            </div>

            <div className="form-group">
              <label htmlFor="category">Mavzu *</label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                required
              >
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="message">Xabaringizni batafsil yozing *</label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                required
                rows="5"
                placeholder="Muammoingizni batafsil bayon qiling..."
              />
            </div>

            <div className="form-group">
              <label htmlFor="attachment">
                <FaFileAlt /> Qo'shimcha fayl ilova qilish (ixtiyoriy)
              </label>
              <input
                type="file"
                id="attachment"
                onChange={handleFileChange}
                accept=".jpg,.jpeg,.png,.pdf,.txt"
              />
              <small>Rasm, skrinshot yoki log fayli (maks. 5MB)</small>
            </div>

            <button 
              type="submit" 
              className="submit-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>Yuborilmoqda...</>
              ) : (
                <>
                  <FaPaperPlane /> Murojaatni yuborish
                </>
              )}
            </button>
          </form>

          <div className="contact-info">
            <h3><FaEnvelope /> To'g'ridan-to'g'ri email</h3>
            <p>
              Agar formadan foydalana olmasangiz, to'g'ridan-to'g'ri yozing:
              <br />
              <strong>eduhelperuz@gmail.com</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupportPage;