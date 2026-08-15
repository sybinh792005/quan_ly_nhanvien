import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword, setPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const $ = id => document.getElementById(id), 
      email = $("email"), 
      password = $("password"), 
      btn = $("loginBtn"), 
      msg = $("message");

// 1. ĐÃ SỬA LỖI: Bỏ lệnh đọc bảng "người dùng" vì bị Security Rules chặn
async function getProfile(uid) {
    try {
        let s = await getDoc(doc(db, "users", uid));
        return s.exists() ? s.data() : null;
    } catch (error) {
        console.error("Lỗi đọc dữ liệu quyền:", error);
        return null; // Bị chặn hoặc lỗi thì trả về null để xử lý êm đẹp
    }
}

async function login() {
    msg.textContent = "";
    const e = email.value.trim(),
          p = password.value,
          r = document.querySelector('input[name="role"]:checked')?.value;
          
    if (!e || !p) { msg.textContent = "Nhập đầy đủ Email và mật khẩu."; return }
    if (!r) { msg.textContent = "Vui lòng chọn quyền."; return }
    
    btn.disabled = true;
    try {
        await setPersistence(auth, browserSessionPersistence);
        const c = await signInWithEmailAndPassword(auth, e, p);
        const d = await getProfile(c.user.uid);
        
        // 2. Nếu đăng nhập thành công nhưng chưa có thông tin phân quyền
        if (!d) {
            await auth.currentUser?.getIdToken(true);
            msg.textContent = "Đăng nhập thành công nhưng chưa có hồ sơ Firestore cho tài khoản này.";
            return;
        }

        // 3. Chuẩn hóa chuỗi quyền
        const rawRole = String(d.role || d["vai trò"] || "employee").toLowerCase().trim();
        let actual = "employee"; 
        
        if (rawRole === "admin") {
            actual = "admin";
        } else if (rawRole === "manager" || rawRole === "trưởng phòng") {
            actual = "manager";
        }

        // 4. So sánh quyền đã chọn
        if (actual !== r) {
            await (await import("https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js")).signOut(auth);
            let roleVN = actual === "manager" ? "Trưởng phòng" : (actual === "admin" ? "Admin" : "Nhân viên");
            msg.textContent = `Bạn chọn sai quyền. Tài khoản này có vai trò là: ${roleVN}.`;
            return;
        }

        // 5. Điều hướng chính xác
        if (actual === "admin") location.href = "pages/admin/dashboard.html";
        else if (actual === "manager") location.href = "pages/manager/employees.html";
        else location.href = "pages/employee/dashboard.html"; // Sửa lại trỏ về dashboard thay vì profile

    } catch (err) {
        msg.innerHTML = `Lỗi: ${err.message || "Đăng nhập thất bại."}`;
    } finally {
        btn.disabled = false;
    }
}

btn.onclick = login;
password.addEventListener("keypress", e => e.key === "Enter" && login());
email.addEventListener("keypress", e => e.key === "Enter" && login());

$("togglePassword")?.addEventListener("click", () => {
    password.type = password.type === "password" ? "text" : "password";
    $("togglePassword").classList.toggle("fa-eye-slash");
});