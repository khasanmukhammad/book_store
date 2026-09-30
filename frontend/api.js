// ================= Token va foydalanuvchi holati =================

const Auth = {
  getAccess() { return localStorage.getItem("access"); },
  getRefresh() { return localStorage.getItem("refresh"); },
  getAuthStatus() { return localStorage.getItem("auth_status"); },
  getFullName() { return localStorage.getItem("full_name"); },
  isAdmin() { return localStorage.getItem("is_admin") === "true"; },

  setTokens({ access, refresh }) {
    if (access) localStorage.setItem("access", access);
    if (refresh) localStorage.setItem("refresh", refresh);
  },
  setAuthStatus(status) {
    if (status) localStorage.setItem("auth_status", status);
  },
  setFullName(name) {
    if (name) localStorage.setItem("full_name", name);
  },
  setAdmin(isAdmin) {
    localStorage.setItem("is_admin", isAdmin ? "true" : "false");
  },
  isLoggedIn() {
    return !!this.getAccess() && this.getAuthStatus() === "done";
  },
  clear() {
    ["access", "refresh", "auth_status", "full_name", "is_admin"].forEach(k => localStorage.removeItem(k));
  }
};

// ================= Xatoliklar =================

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// DRF xatolik javoblari turlicha ko'rinishda keladi:
//   {"detail": "..."}                      — autentifikatsiya/ruxsat xatolari
//   {"message": "..."}                     — sizning view'laringiz
//   {"message": ["..."], "success": [...]} — ValidationError({...}) dan
//   {"field": ["..."]}                     — serializer validatsiyasi
// Shulardan birinchi tushunarli matnni ajratib olamiz.
function extractErrorMessage(data) {
  if (data === null || data === undefined) return null;
  if (typeof data === "string") return data;
  if (Array.isArray(data)) {
    for (const item of data) {
      const m = extractErrorMessage(item);
      if (m) return m;
    }
    return null;
  }
  if (typeof data === "object") {
    for (const key of ["message", "detail"]) {
      if (data[key] !== undefined) {
        const m = extractErrorMessage(data[key]);
        if (m) return m;
      }
    }
    for (const key of Object.keys(data)) {
      if (key === "success" || key === "code" || key === "message" || key === "detail") continue;
      const m = extractErrorMessage(data[key]);
      if (m) return m;
    }
  }
  return null;
}

// ================= Token yangilash (access muddati tugaganda) =================

let refreshPromise = null;

async function doRefresh() {
  const refresh = Auth.getRefresh();
  if (!refresh) return false;
  try {
    const res = await fetch(`${API_BASE_URL}/users/login-refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh })
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (!data.access) return false;
    Auth.setTokens({ access: data.access, refresh: data.refresh });
    return true;
  } catch (e) {
    return false;
  }
}

// Bir vaqtda bir nechta so'rov 401 olsa, tokenni faqat bir marta yangilaymiz.
function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

// fetch o'rovchisi: auth=true bo'lsa Bearer token qo'shadi, 401 kelsa
// tokenni yangilab, so'rovni bir marta qayta yuboradi. Yangilab bo'lmasa —
// sessiya tugagan hisoblanadi (silent=true bo'lmasa "session-expired" hodisasi yuboriladi).
async function authFetch(path, options = {}, { auth = false, silent = false, noRefresh = false } = {}) {
  const send = () => {
    const headers = { ...(options.headers || {}) };
    const access = Auth.getAccess();
    if (auth && access) headers["Authorization"] = `Bearer ${access}`;
    return fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  };

  let res = await send();
  if (res.status === 401 && auth && !noRefresh && Auth.getRefresh()) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await send();
    } else {
      Auth.clear();
      if (!silent) window.dispatchEvent(new Event("session-expired"));
    }
  }
  return res;
}

// Foydalanuvchi admin (is_staff) ekanligini tekshiradi. Login javobida bu
// ma'lumot yo'q, shuning uchun faqat adminlarga ruxsat etilgan /books/add/
// manziliga GET so'rov yuboramiz. DRF avval ruxsatni (IsAdminUser),
// keyin "usul mavjudligini" tekshiradi, shuning uchun:
//   405 (yoki 2xx) -> admin;   403 -> admin emas;   401 -> sessiya yo'q
async function checkAdminAccess() {
  if (!Auth.getAccess()) { Auth.setAdmin(false); return false; }
  try {
    const res = await authFetch("/books/add/", { method: "GET" }, { auth: true, silent: true });
    if (res.status === 405 || res.ok) { Auth.setAdmin(true); return true; }
    if (res.status === 403 || res.status === 401) {
      if (Auth.getAccess()) Auth.setAdmin(false);
      return false;
    }
    return Auth.isAdmin(); // kutilmagan holat (masalan 5xx) — avvalgi qiymatni saqlaymiz
  } catch (e) {
    return Auth.isAdmin();
  }
}

// ================= Umumiy so'rov funksiyasi =================

async function apiRequest(path, { method = "GET", body, auth = false, isForm = false, silent = false, noRefresh = false } = {}) {
  const headers = {};
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";

  let res;
  try {
    res = await authFetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : (isForm ? body : JSON.stringify(body))
    }, { auth, silent, noRefresh });
  } catch (e) {
    throw new ApiError("Serverga ulanib bo'lmadi. Backend ishlab turganini va CORS sozlamalarini tekshiring.", 0);
  }

  let data = null;
  try { data = await res.json(); } catch (e) { /* bo'sh yoki JSON bo'lmagan javob */ }

  if (!res.ok) {
    let message = extractErrorMessage(data);
    if (!message) {
      message = res.status >= 500
        ? `Serverda xatolik yuz berdi (${res.status}). Backend terminalidagi xabarni tekshiring.`
        : `Xatolik (${res.status})`;
    }
    throw new ApiError(message, res.status);
  }
  return data;
}

// ================= Auth (users app) =================

const UsersAPI = {
  signup: (email_phone_number) =>
    apiRequest("/users/signup/", { method: "POST", body: { email_phone_number } }),

  verify: (code) =>
    apiRequest("/users/verify/", { method: "POST", auth: true, body: { code } }),

  // Signup oqimida yangi kod so'rash — token orqali (IsAuthenticated).
  resendCode: () =>
    apiRequest("/users/new-verify/", { method: "GET", auth: true }),

  completeProfile: (payload) =>
    apiRequest("/users/change-user/", { method: "PATCH", auth: true, body: payload }),

  login: (userinput, password) =>
    apiRequest("/users/login/", { method: "POST", body: { userinput, password } }),

  logout: () =>
    apiRequest("/users/logout/", {
      method: "POST", auth: true, body: { refresh: Auth.getRefresh() }, silent: true, noRefresh: true
    }),

  forgotPasswordRequest: (email_or_phone) =>
    apiRequest("/users/forget-password/", { method: "POST", body: { email_or_phone } }),

  // Parolni tiklash oqimida yangi kod so'rash — email/telefon orqali
  // (AllowAny, token kerak emas).
  forgotPasswordResend: (email_or_phone) =>
      apiRequest(
    `/users/forgot-resend-code/?email_or_phone=${encodeURIComponent(email_or_phone)}`,
    {
      method: "GET"
    }
  ),

  // Forgot-password kodi ham xuddi shu /users/verify/ orqali tekshiriladi.
  // Kod to'g'ri va maqsadi FORGOT_PASSWORD bo'lsa, backend "reset_token" qaytaradi.
  forgotPasswordVerify: (code) =>
    apiRequest("/users/verify/", { method: "POST", auth: true, body: { code } }),

  resetPassword: (password, confirm_password) =>
    apiRequest("/users/reset-password/", { method: "PATCH", auth: true, body: { password, confirm_password } })
};

// ================= Books app =================

const BooksAPI = {
  list: (page = 1, pageSize) =>
    apiRequest(`/books/?page=${page}${pageSize ? `&page_size=${pageSize}` : ""}`),

  byCategory: (category) =>
    apiRequest(`/books/category/`, { method: "POST", body: { category } }),

  detail: (id) =>
    apiRequest(`/books/${id}/detail/`),

  book: (id) =>
    apiRequest(`/books/${id}/booked/`, { method: "POST", auth: true, body: {} }),

  add: (formData) =>
    apiRequest(`/books/add/`, { method: "POST", auth: true, isForm: true, body: formData }),

  update: (id, formData) =>
    apiRequest(`/books/${id}/`, { method: "PATCH", auth: true, isForm: true, body: formData }),

  remove: (id) =>
    apiRequest(`/books/${id}/`, { method: "DELETE", auth: true })
};

const CATEGORY_LABELS = {
  religious: "Diniy",
  story: "Hikoya",
  fantasy: "Fantastika",
  science: "Ilmiy",
  history: "Tarix",
  other: "Boshqa"
};

const STATUS_LABELS = {
  available: "Bor",
  booked: "Band"
};
