// Vercel Serverless Function: Enviar mensajes por WhatsApp y SMS Masivos
// Amar Show Center Acapulco CRM

const DEFAULT_API_KEY = process.env.SMS_MASIVOS_API_KEY || '4272002b8a218faa777e3fd9b7aac07f40c40cfc';
const DEFAULT_INSTANCE_ID = process.env.SMS_MASIVOS_INSTANCE_ID || 'irbj0fq0-87gb-vgvo-slds-h09p35skot74';

const setCors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');
};

const normalizePhone = (phone) => {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) return '52' + digits;
  if (digits.length === 12 && digits.startsWith('52')) return digits;
  if (digits.length === 13 && digits.startsWith('521')) return '52' + digits.slice(3);
  return digits;
};

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Consultar créditos
  if (req.method === 'GET' || req.query?.action === 'credits') {
    try {
      const apiKey = req.query?.apiKey || DEFAULT_API_KEY;
      const creditRes = await fetch('https://api.smsmasivos.com.mx/credits/consult', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey
        }
      });
      const data = await creditRes.json();
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Use POST.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) {}
    }
    body = body || {};

    const phone = normalizePhone(body.to || body.phone || body.numero || body.number);
    const message = (body.message || body.mensaje || '').trim();
    const channel = (body.channel || body.canal || 'whatsapp').toLowerCase();
    const apiKey = body.apiKey || DEFAULT_API_KEY;
    const instanceId = body.instanceId || DEFAULT_INSTANCE_ID;

    if (!phone) {
      return res.status(400).json({ success: false, error: 'Número de teléfono requerido a 10 dígitos o formato 52XXXXXXXXXX.' });
    }
    if (!message) {
      return res.status(400).json({ success: false, error: 'El mensaje de la campaña no puede estar vacío.' });
    }

    let result = null;
    let usedChannel = channel;

    // 1. Enviar por WhatsApp si el canal es 'whatsapp' o 'auto'
    if (channel.includes('whatsapp') || channel === 'auto') {
      try {
        const waRes = await fetch('https://api.smsmasivos.com.mx/whatsapp/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': apiKey
          },
          body: JSON.stringify({
            instance_id: instanceId,
            number: phone,
            message: message
          })
        });

        const waData = await waRes.json();
        if (waData.success || waData.status === 200) {
          return res.status(200).json({
            success: true,
            channel: 'whatsapp',
            phone: phone,
            data: waData
          });
        } else {
          result = waData;
          // Si falló WhatsApp y era auto o híbrido, intentamos fallback por SMS
          if (channel === 'auto' || channel.includes('sms')) {
            usedChannel = 'sms';
          } else {
            return res.status(waRes.status >= 400 ? waRes.status : 400).json({
              success: false,
              channel: 'whatsapp',
              error: waData.message || 'Error al enviar por WhatsApp',
              data: waData
            });
          }
        }
      } catch (waErr) {
        if (channel === 'whatsapp') {
          return res.status(500).json({ success: false, channel: 'whatsapp', error: waErr.message });
        }
        usedChannel = 'sms';
      }
    }

    // 2. Enviar por SMS
    if (usedChannel.includes('sms') || channel === 'sms') {
      const smsRes = await fetch('https://api.smsmasivos.com.mx/sms/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey
        },
        body: JSON.stringify({
          numbers: phone,
          message: message
        })
      });

      const smsData = await smsRes.json();
      const isSuccess = smsData.success || smsData.status === 200 || smsData.code === 'sms_01';
      return res.status(isSuccess ? 200 : 400).json({
        success: isSuccess,
        channel: 'sms',
        phone: phone,
        data: smsData,
        error: isSuccess ? null : (smsData.message || 'Error al enviar SMS')
      });
    }

    return res.status(400).json({ success: false, error: 'Canal no soportado: ' + channel });
  } catch (error) {
    console.error('Error in send-message handler:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
