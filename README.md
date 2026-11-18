# Amar Show Center · CRM Oficial (Allinone Edition)

Plataforma CRM y de gestión comercial para **Amar Show Center Acapulco**.

## Características
- **Dashboard Bento Allinone**: Métricas en tiempo real de WhatsApp, Instagram, Facebook y comensales del Jueves Pozolero.
- **Pipeline Kanban**: Gestión de prospectos a través de las 12 etapas del flujo comercial.
- **Calendario de Citas & Llamadas**: Sincronización en tiempo real con Supabase y función RPC `horarios_libres`.
- **Campañas de Marketing & Difusión**: Automatizaciones de confirmación inmediata, recordatorios (24h y 2h), seguimiento post-llamada y difusiones masivas segmentadas (SMS Masivos y WhatsApp).
- **Reservaciones Jueves Pozolero**: Control de mesas, número de comensales y confirmaciones directas.
- **Bandeja de Intervención**: Sección para prospectos que requieren atención humana inmediata.

## Conexión y Arquitectura
- Frontend SPA ligero (HTML5, Vanilla JS, CSS3 con tokens de diseño Apple/Allinone).
- Base de datos y funciones RPC en **Supabase** (zona horaria `America/Mexico_City`).
- Integración de mensajería con **SMS Masivos** y **WhatsApp**.
