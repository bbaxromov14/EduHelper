// Utils/sendCode.js
import emailjs from '@emailjs/browser';

emailjs.init("DbMmAPnnh5nzgRJti");

export const sendVerificationCode = async (email, fullName = "") => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    localStorage.setItem("tempVerification", JSON.stringify({
        email,
        fullName,
        code,
        expiresAt: Date.now() + 10 * 60 * 1000
    }));

    try {
        const result = await emailjs.send(
            "service_p3zrk9h", // <--- ИСПРАВЛЕНО: НОВЫЙ РАБОЧИЙ SERVICE ID
            "template_aqh1z2t",
            {
                to_name: fullName.split(" ")[0] || "Do'stim",
                code: code,
                to_email: email,
                reply_to: email,
            }
        );

        return code;
    } catch (error) {
        console.error("Ошибка отправки EmailJS:", error);
        throw new Error("Kod yuborishda xatolik. Qayta urining.");
    }
};