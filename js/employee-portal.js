import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, addDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const $ = id => document.getElementById(id);
const money = n => Number(n || 0).toLocaleString("vi-VN") + " VNĐ";
const dateKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const timeNow = () => new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

let currentUser = null, userData = null, currentEmployee = null;

// ============================================================
// 1. ĐÃ SỬA LỖI: Bọc try-catch và xóa bảng "người dùng"
// ============================================================
async function getUser(uid) {
    try {
        let s = await getDoc(doc(db, "users", uid));
        return s.exists() ? s.data() : null;
    } catch (error) {
        console.error("Lỗi đọc thông tin users:", error);
        return null;
    }
}

function setText(id, v) { if ($(id)) $(id).textContent = v ?? ""; }

// ============================================================
// HỒ SƠ
// ============================================================
async function loadProfile() {
    setText("profileName", currentEmployee?.name || userData?.name || "");
    setText("profileEmail", currentUser?.email || "");
    setText("profileDepartment", currentEmployee?.department || userData?.department || "");
    setText("profileRole", "Nhân viên");

    if ($("profileNameInput")) $("profileNameInput").value = currentEmployee?.name || userData?.name || "";
    if ($("profilePhoneInput")) $("profilePhoneInput").value = currentEmployee?.phone || userData?.phone || "";
}

async function saveProfile(e) {
    e.preventDefault();
    const phone = $("profilePhoneInput").value.trim();
    const name = $("profileNameInput").value.trim();
    
    try {
        await updateDoc(doc(db, "users", currentUser.uid), { name, phone, updatedAt: serverTimestamp() });
        
        if (currentEmployee) {
            await updateDoc(doc(db, "employees", currentEmployee.id), { name, phone, updatedAt: serverTimestamp() });
            currentEmployee.name = name;
            currentEmployee.phone = phone;
        }

        userData.name = name;
        await loadProfile();
        alert("Đã cập nhật hồ sơ thành công!");
    } catch (error) {
        console.error(error);
        alert("Lỗi khi lưu hồ sơ. Vui lòng thử lại!");
    }
}

// ============================================================
// CHẤM CÔNG
// ============================================================
async function loadAttendance() {
    const body = $("attendanceBody");
    if (!body) return;
    body.innerHTML = `<tr><td colspan="5" style="text-align:center;">Đang tải...</td></tr>`;

    try {
        const snap = await getDocs(query(collection(db, "attendance"), where("uid", "==", currentUser.uid)));
        let rows = [];
        snap.forEach(s => rows.push(s.data()));
        rows.sort((a, b) => String(b.dateKey || b.date).localeCompare(String(a.dateKey || a.date)));

        const today = dateKey(new Date());
        const t = rows.find(x => x.dateKey === today || x.date === new Date().toLocaleDateString("vi-VN"));

        setText("todayDate", new Date().toLocaleDateString("vi-VN"));
        setText("checkInTime", t?.checkIn || "Chưa chấm");
        setText("checkOutTime", t?.checkOut || "Chưa chấm");

        if ($("checkInBtn")) $("checkInBtn").disabled = !!t?.checkIn;
        if ($("checkOutBtn")) $("checkOutBtn").disabled = !t?.checkIn || !!t?.checkOut;

        body.innerHTML = "";
        rows.forEach(x => {
            let status = x.status || (x.checkOut ? "Hoàn thành" : "Đang làm");
            let statusColor = status === "Hoàn thành" ? "green" : "#ffc107";
            body.insertAdjacentHTML("beforeend", `
                <tr>
                    <td>${x.date || ""}</td>
                    <td>${x.checkIn || "—"}</td>
                    <td>${x.checkOut || "—"}</td>
                    <td>${x.overtimeHours ?? 0} giờ</td>
                    <td><b style="color:${statusColor}">${status}</b></td>
                </tr>
            `);
        });
        if (rows.length === 0) body.innerHTML = `<tr><td colspan="5" style="text-align:center;">Chưa có lịch sử chấm công</td></tr>`;
    } catch (error) {
        console.error("Lỗi tải chấm công:", error);
        body.innerHTML = `<tr><td colspan="5" style="text-align:center;color:red;">Lỗi tải dữ liệu chấm công!</td></tr>`;
    }
}

async function checkIn() {
    const todayStr = dateKey(new Date());
    const id = `${currentUser.uid}_${todayStr}`;
    const ref = doc(db, "attendance", id);
    
    try {
        const old = await getDoc(ref);
        if (old.exists() && old.data().checkIn) { alert("Bạn đã check-in hôm nay."); return; }

        await setDoc(ref, {
            uid: currentUser.uid,
            email: currentUser.email,
            employeeCode: currentEmployee?.code || "",
            name: currentEmployee?.name || userData?.name || currentUser.email,
            department: currentEmployee?.department || userData?.department || "",
            dateKey: todayStr,
            date: new Date().toLocaleDateString("vi-VN"),
            checkIn: timeNow(),
            checkOut: "",
            workDays: 1,
            overtimeHours: 0,
            status: "Đang làm",
            updatedAt: serverTimestamp()
        }, { merge: true });

        alert("Check-in thành công!");
        await loadAttendance();
    } catch (error) {
        console.error(error);
        alert("Lỗi Check-in: " + error.message);
    }
}

async function checkOut() {
    const todayStr = dateKey(new Date());
    const id = `${currentUser.uid}_${todayStr}`;
    const ref = doc(db, "attendance", id);
    
    try {
        const s = await getDoc(ref);
        if (!s.exists() || !s.data().checkIn) { alert("Bạn chưa check-in."); return; }

        await updateDoc(ref, { 
            checkOut: timeNow(), 
            status: "Hoàn thành",
            updatedAt: serverTimestamp() 
        });
        
        alert("Check-out thành công!");
        await loadAttendance();
    } catch (error) {
        console.error(error);
        alert("Lỗi Check-out: " + error.message);
    }
}

// ============================================================
// BẢNG LƯƠNG
// ============================================================
async function loadSalary() {
    const body = $("salaryBody");
    if (!body) return;
    
    if (!currentEmployee) {
        setText("salaryMessage", "Chưa có hồ sơ lương liên kết với email này trên hệ thống.");
        return;
    }

    try {
        const e = currentEmployee;
        const salary = Number(e.salary || 0);
        const days = Number(e.workDays || 0);
        const allow = Number(e.allowance || 0);
        const deduction = Number(e.deduction || 0);
        
        const ot = Number(e.overtimeHours || 0);
        const rate = String(e.position || "").toLowerCase().includes("manager") ? 300000 : 200000;
        
        const total = Math.round((salary / 22) * days + allow + (ot * rate) - deduction);

        setText("salaryTotal", money(total));
        setText("salaryBase", money(salary));
        setText("salaryAllowance", money(allow));
        setText("salaryDays", days);
        setText("salaryOvertime", ot);

        body.innerHTML = `
            <tr>
                <td>${e.code || "---"}</td>
                <td>${e.name || ""}</td>
                <td>${money(salary)}</td>
                <td>${days}</td>
                <td>${ot}</td>
                <td>${money(allow)}</td>
                <td><b style="color:red;">${money(total)}</b></td>
            </tr>
        `;
    } catch (error) {
        console.error("Lỗi tính lương:", error);
    }
}

// ============================================================
// ĐƠN NGHỈ PHÉP
// ============================================================
async function loadLeaves() {
    const body = $("leaveBody");
    if (!body) return;
    body.innerHTML = `<tr><td colspan="5" style="text-align:center;">Đang tải...</td></tr>`;
    
    try {
        const snap = await getDocs(query(collection(db, "leaves"), where("uid", "==", currentUser.uid)));
        body.innerHTML = "";
        let count = 0;
        
        snap.forEach(s => {
            count++;
            const x = s.data();
            let statusText = x.status === "approved" ? "Đã duyệt" : (x.status === "rejected" ? "Từ chối" : "Chờ duyệt");
            let statusClass = x.status === "approved" ? "green" : (x.status === "rejected" ? "red" : "#ffc107");
            
            body.insertAdjacentHTML("beforeend", `
                <tr>
                    <td>${x.from || ""}</td>
                    <td>${x.to || ""}</td>
                    <td>${x.type || ""}</td>
                    <td>${x.reason || ""}</td>
                    <td><span style="color:${statusClass}; font-weight:bold;">${statusText}</span></td>
                </tr>
            `);
        });
        
        if(count === 0) body.innerHTML = `<tr><td colspan="5" style="text-align:center;">Bạn chưa gửi đơn xin nghỉ nào</td></tr>`;
    } catch (error) {
        console.error("Lỗi tải đơn từ:", error);
        body.innerHTML = `<tr><td colspan="5" style="text-align:center;color:red;">Lỗi tải dữ liệu đơn từ!</td></tr>`;
    }
}

async function submitLeave(e) {
    e.preventDefault();
    const from = $("leaveFrom").value;
    const to = $("leaveTo").value;
    const type = $("leaveType").value;
    const reason = $("leaveReason").value.trim();

    if (to < from) { alert("Ngày kết thúc phải sau hoặc bằng ngày bắt đầu."); return; }

    try {
        await addDoc(collection(db, "leaves"), {
            uid: currentUser.uid,
            email: currentUser.email,
            name: currentEmployee?.name || userData?.name || currentUser.email,
            department: currentEmployee?.department || userData?.department || "",
            from, to, type, reason,
            status: "pending",
            createdAt: serverTimestamp()
        });

        $("leaveForm").reset();
        await loadLeaves();
        alert("Đã gửi đơn nghỉ phép thành công.");
    } catch (error) {
        console.error(error);
        alert("Lỗi khi gửi đơn: " + error.message);
    }
}

// ============================================================
// XÁC THỰC VÀ KHỞI TẠO
// ============================================================
onAuthStateChanged(auth, async u => {
    if (!u) { location.href = "../../index.html"; return; }
    currentUser = u;
    userData = await getUser(u.uid);

    if (!userData) { alert("Không tìm thấy hồ sơ tài khoản."); location.href = "../../index.html"; return; }

    const role = String(userData.role || userData["vai trò"] || "employee").toLowerCase().trim();
    if (role === "admin" || role.includes("manager") || role.includes("trưởng phòng")) {
        alert("Bạn đang dùng tài khoản Quản lý. Hệ thống sẽ tự động chuyển về đúng trang...");
        location.href = role === "admin" ? "../../pages/admin/dashboard.html" : "../../pages/manager/employees.html";
        return;
    }

    // 2. ĐÃ SỬA LỖI: Lấy trực tiếp Employee theo UID, không quét toàn bộ bảng
    try {
        const empSnap = await getDoc(doc(db, "employees", u.uid));
        if (empSnap.exists()) {
            currentEmployee = { id: empSnap.id, ...empSnap.data() };
        }
    } catch (error) {
        console.error("Lỗi lấy thông tin employee:", error);
    }

    setText("welcome", "Xin chào " + (currentEmployee?.name || userData?.name || u.email));
    
    await loadProfile();
    await loadAttendance();
    await loadLeaves();
    await loadSalary();
});

// ============================================================
// GẮN SỰ KIỆN GIAO DIỆN
// ============================================================
if ($("logoutBtn")) $("logoutBtn").onclick = async () => { await signOut(auth); location.href = "../../index.html"; };
if ($("checkInBtn")) $("checkInBtn").onclick = checkIn;
if ($("checkOutBtn")) $("checkOutBtn").onclick = checkOut;
if ($("leaveForm")) $("leaveForm").onsubmit = submitLeave;
if ($("profileForm")) $("profileForm").onsubmit = saveProfile;