@echo off
set "TOKEN=APP_USR-213738831362508-121117-6ab571005239609e127247395675955d-1317727434"
set "PUBKEY=APP_USR-2b9dbc49-a073-4cfe-98b0-51f4916d80a9"
set "SITEURL=https://www.miniveci.cl"
echo|set /p="%TOKEN%"| vercel env add MERCADOPAGO_ACCESS_TOKEN production
echo|set /p="%PUBKEY%"| vercel env add NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY production
echo|set /p="%SITEURL%"| vercel env add NEXT_PUBLIC_SITE_URL production
