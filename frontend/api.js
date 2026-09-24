// ---- Token va foydalanuvchi holatini saqlash ----

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

// Foydalanuvchi admin (is_staff) ekanligini backend orqali tekshiradi.
// Login javobida bu ma'lumot kelmagani uchun, faqat adminlarga ruxsat
// etilgan /books/add/ manziliga GET so'rov yuboramiz (bu yerda GET usuli
// mavjud emas). DRF avval ruxsatni (IsAdminUser) tekshiradi, keyingina
// "usul mavjud emasligini" aytadi — shuning uchun natija aniq bo'ladi:
//   403 -> admin emas
//   405 -> admin (usul yo'q, lekin ruxsat bor edi)
async function checkAdminAccess() {
  if (!Auth.getAccess()) { Auth.setAdmin(false); return false; }
  try {
    const res = await fetch(`${API_BASE_URL}/books/add/`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${Auth.getAccess()}` }
    });
    const isAdmin = res.status !== 403;
    Auth.setAdmin(isAdmin);
    return isAdmin;
  } catch (e) {
    return Auth.isAdmin();
  }
}

// ---- Umumiy fetch o'rovchisi ----

async function apiRequest(path, { method = "GET", body, auth = false, isForm = false } = {}) {
  const headers = {};
  if (!isForm) headers["Content-Type"] = "application/json";
  if (auth && Auth.getAccess()) headers["Authorization"] = `Bearer ${Auth.getAccess()}`;

  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined
    });
  } catch (e) {
    throw new Error("Serverga ulanib bo'lmadi. Backend ishlab turganini va CORS sozlamalarini tekshiring.");
  }

  let data = null;
  try { data = await res.json(); } catch (e) { /* bo'sh javob bo'lishi mumkin */ }

  if (!res.ok) {
    const message = extractErrorMessage(data) || `Xatolik (${res.status})`;
    throw new Error(message);
  }
  return data;
}

function extractErrorMessage(data) {
  if (!data) return null;
  if (typeof data === "string") return data;
  if (data.message) return data.message;
  if (data.detail) return data.detail;
  const firstKey = Object.keys(data)[0];
  if (firstKey) {
    const val = data[firstKey];
    if (Array.isArray(val)) return val[0];
    if (typeof val === "object" && val.message) return val.message;
    if (typeof val === "string") return val;
  }
  return null;
}

// ---- Auth (users app) ----

const UsersAPI = {
  signup: (email_phone_number) =>
    apiRequest("/users/signup/", { method: "POST", body: { email_phone_number } }),

  verify: (code) =>
    apiRequest("/users/verify/", { method: "POST", auth: true, body: { code } }),

  resendCode: () =>
    apiRequest("/users/new-verify/", { method: "GET", auth: true }),

  completeProfile: (payload) =>
    apiRequest("/users/change-user/", { method: "PATCH", auth: true, body: payload }),

  login: (userinput, password) =>
    apiRequest("/users/login/", { method: "POST", body: { userinput, password } }),

  logout: () =>
    apiRequest("/users/logout/", { method: "POST", auth: true, body: { refresh: Auth.getRefresh() } })
};

// ---- Books app ----

const BooksAPI = {
  list: (page = 1) =>
    apiRequest(`/books/?page=${page}`),

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
