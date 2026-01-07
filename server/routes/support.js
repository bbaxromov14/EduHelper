const { Telegraf, Markup } = require('telegraf');
require('dotenv').config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// База данных для хранения тикетов (в продакшене используйте настоящую БД)
const supportTickets = new Map();

bot.start((ctx) => {
  ctx.reply(
    `👋 Assalomu alaykum! *EduHelper qo'llab-quvvatlash botiga* xush kelibsiz!\n\n` +
    `Quyidagi buyruqlardan foydalaning:`,
    {
      parse_mode: 'Markdown',
      ...Markup.keyboard([
        ['📝 Yangi murojaat'],
        ['📋 Mening murojaatlarim'],
        ['ℹ️ Yordam']
      ]).resize()
    }
  );
});

bot.hears('📝 Yangi murojaat', (ctx) => {
  ctx.reply(
    'Murojaatingiz mavzusini tanlang:',
    Markup.inlineKeyboard([
      [
        Markup.button.callback('🔧 Texnik muammo', 'category_technical'),
        Markup.button.callback('👤 Hisob', 'category_account')
      ],
      [
        Markup.button.callback('💰 To\'lov', 'category_payment'),
        Markup.button.callback('💡 Taklif', 'category_suggestion')
      ],
      [
        Markup.button.callback('❓ Boshqa', 'category_other')
      ]
    ])
  );
});

bot.action(/category_(.+)/, (ctx) => {
  const category = ctx.match[1];
  const ticketId = Date.now();
  
  supportTickets.set(ticketId, {
    userId: ctx.from.id,
    username: ctx.from.username || ctx.from.first_name,
    category: category,
    status: 'waiting_for_message',
    createdAt: new Date()
  });

  ctx.deleteMessage();
  ctx.reply(
    `Mavzu: *${getCategoryLabel(category)}*\n\n` +
    `Endi muammoingizni batafsil yozib yuboring. ` +
    `Rasm yoki skrinshot ilova qilishingiz mumkin.`,
    { parse_mode: 'Markdown' }
  );
  
  // Сохраняем ID тикета в сессии
  ctx.session = { currentTicketId: ticketId };
});

bot.on('text', async (ctx) => {
  if (ctx.session && ctx.session.currentTicketId) {
    const ticketId = ctx.session.currentTicketId;
    const ticket = supportTickets.get(ticketId);
    
    if (ticket && ticket.status === 'waiting_for_message') {
      ticket.message = ctx.message.text;
      ticket.status = 'received';
      supportTickets.set(ticketId, ticket);
      
      // Отправка уведомления администратору
      await sendToAdminChat(ticket);
      
      ctx.reply(
        `✅ Murojaatingiz qabul qilindi!\n\n` +
        `📋 *Tiket raqami:* #${ticketId}\n` +
        `⏰ *Javob vaqti:* 15 daqiqa - 2 soat\n\n` +
        `Batafsil ma'lumot: eduhelperuz@gmail.com`,
        { parse_mode: 'Markdown' }
      );
      
      delete ctx.session.currentTicketId;
    }
  }
});

bot.on('photo', async (ctx) => {
  if (ctx.session && ctx.session.currentTicketId) {
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const ticketId = ctx.session.currentTicketId;
    const ticket = supportTickets.get(ticketId);
    
    if (ticket) {
      ticket.photo = photo.file_id;
      supportTickets.set(ticketId, ticket);
      
      ctx.reply('✅ Rasm qabul qilindi. Endi izoh yozishingiz mumkin.');
    }
  }
});

bot.hears('📋 Mening murojaatlarim', (ctx) => {
  const userTickets = Array.from(supportTickets.entries())
    .filter(([_, ticket]) => ticket.userId === ctx.from.id);
  
  if (userTickets.length === 0) {
    ctx.reply('📭 Hozircha murojaatlaringiz yo\'q.');
    return;
  }
  
  let message = '📋 *Sizning murojaatlaringiz:*\n\n';
  
  userTickets.forEach(([id, ticket]) => {
    message += `🔹 *#${id}*\n`;
    message += `📌 ${getCategoryLabel(ticket.category)}\n`;
    message += `⏰ ${ticket.createdAt.toLocaleDateString('uz-UZ')}\n`;
    message += `📊 Holat: ${getStatusLabel(ticket.status)}\n\n`;
  });
  
  ctx.reply(message, { parse_mode: 'Markdown' });
});

bot.hears('ℹ️ Yordam', (ctx) => {
  ctx.reply(
    `*Qo'llab-quvvatlash kanallari:*\n\n` +
    `📧 Email: *eduhelperuz@gmail.com*\n` +
    `🌐 Veb-sahifa: https://eduhelper.uz/support\n` +
    `📞 Telefon: +998 XX XXX XX XX\n\n` +
    `Ish vaqti: 24/7\n` +
    `Javob vaqti: 15 daqiqa - 24 soat`,
    { parse_mode: 'Markdown' }
  );
});

async function sendToAdminChat(ticket) {
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  
  let message = `🆕 *YANGI MUROJAAT* #${ticket.ticketId}\n\n`;
  message += `👤 *Foydalanuvchi:* ${ticket.username}\n`;
  message += `🆔 ID: ${ticket.userId}\n`;
  message += `🏷️ *Mavzu:* ${getCategoryLabel(ticket.category)}\n`;
  message += `📝 *Xabar:* ${ticket.message}\n`;
  message += `⏰ *Vaqt:* ${ticket.createdAt.toLocaleString('uz-UZ')}`;
  
  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Javob berildi', `close_${ticket.ticketId}`),
      Markup.button.callback('📧 Emailga yuborish', `email_${ticket.ticketId}`)
    ]
  ]);
  
  try {
    if (ticket.photo) {
      await bot.telegram.sendPhoto(adminChatId, ticket.photo, {
        caption: message,
        parse_mode: 'Markdown',
        ...keyboard
      });
    } else {
      await bot.telegram.sendMessage(adminChatId, message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    }
  } catch (error) {
    console.error('Admin chatga yuborishda xatolik:', error);
  }
}

function getCategoryLabel(category) {
  const labels = {
    technical: '🔧 Texnik muammo',
    account: '👤 Hisob',
    payment: '💰 To\'lov',
    suggestion: '💡 Taklif',
    other: '❓ Boshqa'
  };
  return labels[category] || category;
}

function getStatusLabel(status) {
  const labels = {
    waiting_for_message: '📝 Xabar kutilmoqda',
    received: '🔄 Ko\'rib chiqilmoqda',
    responded: '✅ Javob berildi',
    closed: '📭 Yopilgan'
  };
  return labels[status] || status;
}

// Запуск бота
bot.launch()
  .then(() => console.log('🤖 Telegram bot ishga tushdi...'))
  .catch(err => console.error('Bot ishga tushirishda xatolik:', err));

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));