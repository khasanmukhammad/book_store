# Kitob do'koni — frontend

Oddiy HTML/CSS/JavaScript bilan yozilgan frontend. Django REST backend'ingiz bilan
(`book_store` loyihasi) to'g'ridan-to'g'ri ishlaydi.

## Ishga tushirish

1. Django backend'ni ishga tushiring (`python manage.py runserver`), u `http://127.0.0.1:8000`
   manzilida ishlayotgan bo'lishi kerak.
2. Agar backend boshqa portda/manzilda bo'lsa, `config.js` faylidagi `API_BASE_URL`
   qiymatini o'zgartiring.
3. Bu papkani lokal serverda oching — to'g'ridan-to'g'ri fayl sifatida ochish
   (`file://...`) ba'zi brauzerlarda `fetch` so'rovlarini bloklashi mumkin, shuning
   uchun oddiy lokal server orqali ochish tavsiya etiladi:

   ```bash
   cd kitob-frontend
   python -m http.server 5500
   ```

   Keyin brauzerda `http://127.0.0.1:5500` manzilini oching.

## CORS haqida — MUHIM

Frontend va backend boshqa-boshqa portda ishlagani uchun Django tomonda CORS ruxsat
berilishi kerak, aks holda brauzer so'rovlarni bloklaydi.

```bash
pip install django-cors-headers
```

`settings.py`:

```python
INSTALLED_APPS = [
    ...
    "corsheaders",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    ...
]

# Development uchun:
CORS_ALLOW_ALL_ORIGINS = True
```

## Loyiha tuzilishi

- `index.html` — asosiy sahifa qobig'i (header + `#app` konteyner)
- `config.js` — backend manzili
- `api.js` — token boshqaruvi va barcha API chaqiruvlari
- `app.js` — router va har bir sahifaning render funksiyalari
- `style.css` — dizayn

## Sahifalar

| Yo'l | Tavsif |
|---|---|
| `#/` | Kitoblar ro'yxati, kategoriya filtri |
| `#/signup` | Ro'yxatdan o'tish (email/telefon) |
| `#/verify` | Tasdiqlash kodi |
| `#/complete-profile` | Ism, familiya, username, parol |
| `#/login` | Kirish |
| `#/book/<id>` | Kitob tafsiloti + band qilish |
| `#/admin/add` | Kitob qo'shish (admin) |
| `#/admin/manage` | Kitoblarni tahrirlash/o'chirish (admin) |

## Eslatmalar

- Admin huquqi backend tomonidan (`is_staff`) tekshiriladi — frontend buni oldindan
  bilmaydi, shuning uchun "Admin panel" havolasi har bir tizimga kirgan foydalanuvchiga
  ko'rinadi, lekin admin bo'lmagan foydalanuvchi amal bajarsa backend xatolik qaytaradi.
- `PATCH /books/<id>/` endpointi hozirgi backend kodida faqat `title`, `status` va
  `image` maydonlarini yangilashni qo'llab-quvvatlaydi (`BookListSerializer` orqali) —
  shuning uchun tahrirlash formasi ham shu maydonlar bilan cheklangan.
- Profilni to'ldirgandan keyin (`change-user/`) backend yangi token qaytarmaydi,
  shuning uchun foydalanuvchi qayta login qilishi kerak — bu frontendda hisobga olingan.
