// src/pages/CheckEmail.jsx
import React from "react";
import { useLocation, NavLink } from "react-router-dom";
import { motion } from "framer-motion";

const CheckEmail = () => {
  const { state } = useLocation();
  const email = state?.email || "pochta manzilingizga";

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-950 via-black to-blue-950" />
      
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative z-10 max-w-md w-full text-center bg-white/10 backdrop-blur-3xl rounded-3xl p-12 border border-white/20"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
          className="text-9xl mb-8"
        >
          📧
        </motion.div>

        <h1 className="text-4xl font-black mb-6 bg-gradient-to-r from-cyan-400 to-pink-400 bg-clip-text text-transparent">
          Emailni tasdiqlang
        </h1>

        <p className="text-lg leading-relaxed opacity-90 mb-10">
          <strong>{email}</strong> manziliga tasdiqlash xati yuborildi.<br />
          Iltimos, pochta qutingizni (shu jumladan "Spam" papkasini) tekshiring va havolani bosing.
        </p>

        <NavLink
          to="/login"
          className="inline-block px-10 py-5 rounded-2xl bg-gradient-to-r from-cyan-500 to-purple-500 font-bold text-xl hover:from-cyan-400 hover:to-purple-400 transition-all"
        >
          Kirish sahifasiga qaytish
        </NavLink>
      </motion.div>
    </div>
  );
};

export default CheckEmail;