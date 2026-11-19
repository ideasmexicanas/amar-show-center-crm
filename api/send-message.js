// Vercel Serverless Function: Enviar mensajes por WhatsApp y SMS Masivos
// Amar Show Center Acapulco CRM

const DEFAULT_API_KEY = process.env.SMS_MASIVOS_API_KEY || '4272002b8a218faa777e3fd9b7aac07f40c40cfc';
const DEFAULT_INSTANCE_ID = process.env.SMS_MASIVOS_INSTANCE_ID || 'irbj0fq0-87gb-vgvo-slds-h09p35skot74';

const setCors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');
};

const parsePhone = (raw) => {
  if (!raw) return { country_code: 52, number: '' };
  let digits = String(raw).replace(/\D/g, '');
  let country_code = 52;

  if (digits.length === 12 && digits.startsWith('52')) {
    country_code = 52;
    digits = digits.slice(2);
  } else if (digits.length === 13 && digits.startsWith('521')) {
    country_code = 52;
    digits = digits.slice(3);
  } else if (digits.length === 11 && digits.startsWith('1')) {
    country_code = 1;
    digits = digits.slice(1);
  } else if (digits.length > 10) {
    digits = digits.slice(-10);
  }

  return { country_code, number: digits };
};

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Consultar créditos disponibles en SMS Masivos
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

    const rawPhone = body.to || body.phone || body.numero || body.number;
    const phoneData = parsePhone(rawPhone);
    const message = (body.message || body.mensaje || '').trim();
    const channel = (body.channel || body.canal || 'whatsapp').toLowerCase();
    const apiKey = body.apiKey || DEFAULT_API_KEY;
    const instanceId = body.instanceId || DEFAULT_INSTANCE_ID;

    if (!phoneData.number || phoneData.number.length < 10) {
      return res.status(400).json({ success: false, error: 'Número de teléfono inválido. Debe contener 10 dígitos.' });
    }
    if (!message) {
      return res.status(400).json({ success: false, error: 'El mensaje no puede estar vacío.' });
    }

    let waSuccess = false;
    let waResponse = null;

    // 1. Intentar enviar por WhatsApp si el canal solicitado es WhatsApp o Auto
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
            number: phoneData.number,
            country_code: phoneData.country_code,
            message: message
          })
        });

        waResponse = await waRes.json();
        if (waResponse.success || waResponse.status === 200 || waResponse.code === 'whatsapp_21') {
          waSuccess = true;
          return res.status(200).json({
            success: true,
            channel: 'whatsapp',
            phone: `${phoneData.country_code}${phoneData.number}`,
            data: waResponse
          });
        }
      } catch (waErr) {
        waResponse = { error: true, message: waErr.message };
      }
    }

    // 2. Si el canal solicitado fue estrictamente SMS, o si WhatsApp falló (por límite de velocidad 419 o desconexión), enviar por SMS como respaldo confiable
    if (channel === 'sms' || !waSuccess) {
      try {
        const smsRes = await fetch('https://api.smsmasivos.com.mx/sms/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': apiKey
          },
          body: JSON.stringify({
            numbers: phoneData.number,
            country_code: phoneData.country_code,
            message: message
          })
        });

        const smsData = await smsRes.json();
        const isSmsOk = smsData.success || smsData.status === 200 || smsData.code === 'sms_11';

        if (isSmsOk) {
          return res.status(200).json({
            success: true,
            channel: waSuccess ? 'whatsapp' : (channel === 'sms' ? 'sms' : 'sms (respaldo)'),
            phone: `${phoneData.country_code}${phoneData.number}`,
            data: smsData,
            note: !waSuccess && channel.includes('whatsapp') ? 'Enviado por SMS debido a que WhatsApp presentó límite temporal.' : null
          });
        } else {
          return res.status(400).json({
            success: false,
            channel: 'sms',
            error: smsData.message || 'Error al enviar por SMS Masivos',
            data: smsData,
            waError: waResponse
          });
        }
      } catch (smsErr) {
        return res.status(500).json({
          success: false,
          error: smsErr.message,
          waError: waResponse
        });
      }
    }

    return res.status(400).json({
      success: false,
      error: waResponse?.message || 'No se pudo enviar el mensaje',
      data: waResponse
    });
  } catch (error) {
    console.error('Error in send-message handler:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
