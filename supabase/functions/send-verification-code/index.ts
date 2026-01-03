// supabase/functions/send-verification-code/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting конфигурация
const RATE_LIMIT_WINDOW = 10 * 60 * 1000; // 10 минут
const MAX_REQUESTS = 3;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, fullName = '' } = await req.json();

    // Валидация email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Email noto\'g\'ri yoki bo\'sh' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Инициализируем Supabase клиент
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Проверяем rate limiting
    const tenMinutesAgo = new Date(Date.now() - RATE_LIMIT_WINDOW).toISOString();
    
    const { data: recentRequests, error: rateError } = await supabase
      .from('verification_codes')
      .select('created_at, request_count')
      .eq('email', email)
      .gte('created_at', tenMinutesAgo)
      .order('created_at', { ascending: false });

    if (rateError) throw rateError;

    // Считаем общее количество запросов за последние 10 минут
    const totalRequests = recentRequests?.reduce((sum, item) => {
      return sum + (item.request_count || 1);
    }, 0) || 0;

    if (totalRequests >= MAX_REQUESTS) {
      return new Response(
        JSON.stringify({ error: 'Kodni ko\'p so\'radingiz, 10 daqiqa kuting' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Генерируем 6-значный код
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 минут

    // Сохраняем в базу
    const { error: insertError } = await supabase
      .from('verification_codes')
      .insert({
        email,
        code,
        full_name: fullName,
        expires_at: expiresAt,
        used: false,
        request_count: totalRequests + 1,
        created_at: new Date().toISOString()
      });

    if (insertError) throw insertError;

    // Отправляем email через Resend
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "EduHelper <no-reply@eduhelper.uz>",
        to: email,
        subject: "EduHelper – Tasdiqlash kodi",
        html: `
          <div style="font-family: Arial, sans-serif; text-align: center; padding: 40px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border-radius: 20px; max-width: 600px; margin: 0 auto;">
            <h1 style="margin-bottom: 20px;">EduHelper</h1>
            <p style="font-size: 18px; margin-bottom: 30px;">
              Salom${fullName ? ", " + fullName.split(" ")[0] : ""}!
            </p>
            <h2 style="font-size: 52px; letter-spacing: 12px; background: rgba(255, 255, 255, 0.2); display: inline-block; padding: 20px 40px; border-radius: 20px; margin: 30px 0;">
              ${code}
            </h2>
            <p style="font-size: 16px; margin-top: 30px;">
              Kod 10 daqiqa amal qiladi
            </p>
          </div>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error('Resend error:', errorText);
      throw new Error('Email yuborilmadi');
    }

    // Возвращаем успех
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Kod yuborildi",
        rateLimitInfo: {
          requestsUsed: totalRequests + 1,
          requestsAllowed: MAX_REQUESTS,
          windowMinutes: 10
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Noma\'lum xato',
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});