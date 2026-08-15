import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { doc, getDoc, setDoc, collection, getDocs, addDoc, updateDoc, deleteDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

// ============================================================
// HÀM DÙNG CHUNG
// ============================================================
const $ = (id) => document.getElementById(id);
const money = (n) => Number(n || 0).toLocaleString("vi-VN") + " VNĐ";

let me = null;
let profile = null;
let dept = "";

async function user(uid) {
    let s = await getDoc(doc(db, "users", uid));
    if (!s.exists()) s = await getDoc(doc(db, "người dùng", uid));
    return s.exists() ? s.data() : null;
}

function rate(emp) {
    return String(emp.position || "").toLowerCase().includes("manager") ? 300000 : 200000;
}

function total(e) {
    return Math.round(Number(e.salary || 0) / 22 * Number(e.workDays || 0) + Number(e.allowance || 0) + Number(e.overtimeHours || 0) * rate(e));
}

function escapeHTML(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function getTodayDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function getCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function showTodayDate() {
    const todayDate = $("todayDate");
    if (todayDate) {
        todayDate.textContent = new Date().toLocaleDateString("vi-VN", { weekday: "long", year: "numeric", month: "2-digit", day: "2-digit" });
    }
}

// ============================================================
// QUẢN LÝ NHÂN VIÊN PHÒNG BAN
// ============================================================
async function loadEmployees() {
    const body = $("managerEmpTableBody");
    if (!body) return;
    body.innerHTML = `<tr><td colspan="8" style="text-align:center;">Đang tải...</td></tr>`;
    try {
        const snap = await getDocs(query(collection(db, "employees"), where("department", "==", dept)));
        let n = 0;
        body.innerHTML = "";
        snap.forEach((s) => {
            n++;
            const e = s.data();
            body.innerHTML += `
                <tr>
                    <td>${escapeHTML(e.code || "")}</td>
                    <td><b>${escapeHTML(e.name || "")}</b></td>
                    <td>${escapeHTML(e.email || "")}</td>
                    <td>${money(e.salary)}</td>
                    <td>${e.workDays ?? 0}</td>
                    <td>${e.overtimeHours ?? 0}</td>
                    <td style="color:red; font-weight:bold;">${money(total(e))}</td>
                    <td>
                        <button class="btn btn-warning editBtn" data-id="${s.id}">Sửa</button>
                        <button class="btn btn-danger deleteBtn" data-id="${s.id}">Xóa</button>
                    </td>
                </tr>
            `;
        });
        if (!n) body.innerHTML = `<tr><td colspan="8" class="muted">Chưa có nhân viên trong phòng</td></tr>`;
    } catch (error) {
        body.innerHTML = `<tr><td colspan="8" style="color:red;text-align:center;">Lỗi tải danh sách</td></tr>`;
    }
}

async function saveEmployee(e) {
    e.preventDefault();
    try {
        const id = $("empId")?.value || null;
        const data = {
            code: $("empCode").value.trim(),
            name: $("empName").value.trim(),
            email: $("empEmail").value.trim(),
            department: dept,
            position: "Nhân viên",
            salary: Number($("empSalary").value) || 0,
            allowance: Number($("empAllowance").value) || 0,
            workDays: Number($("empWorkDays").value) || 0,
            overtimeHours: Number($("empOvertime").value) || 0,
            updatedAt: serverTimestamp()
        };
        if (id) {
            await updateDoc(doc(db, "employees", id), data);
        } else {
            await addDoc(collection(db, "employees"), { ...data, createdAt: serverTimestamp() });
        }
        if ($("managerModal")) $("managerModal").classList.remove("show");
        if ($("managerEmpForm")) $("managerEmpForm").reset();
        await loadEmployees();
        alert("Đã lưu thông tin nhân viên!");
    } catch (error) {
        alert("Lỗi lưu nhân viên: " + error.message);
    }
}

// ============================================================
// CHẤM CÔNG TRƯỞNG PHÒNG & XEM LỊCH SỬ CHẤM CÔNG NHÂN VIÊN
// ============================================================
async function loadManagerAttendance() {
    if (!me) return;
    const today = getTodayDate();
    if ($("managerAttendanceName")) $("managerAttendanceName").textContent = profile?.name || "Trưởng phòng";
    if ($("managerAttendanceDepartment")) $("managerAttendanceDepartment").textContent = dept || "-";
    if ($("managerAttendanceDate")) $("managerAttendanceDate").textContent = today;

    try {
        const snap = await getDocs(query(collection(db, "attendance"), where("uid", "==", me.uid), where("dateKey", "==", today)));
        let att = null;
        snap.forEach(s => att = { id: s.id, ...s.data() });

        if (!att) {
            if ($("managerCheckInTime")) $("managerCheckInTime").textContent = "Chưa check-in";
            if ($("managerCheckOutTime")) $("managerCheckOutTime").textContent = "Chưa check-out";
            if ($("managerCheckInBtn")) $("managerCheckInBtn").disabled = false;
            if ($("managerCheckOutBtn")) $("managerCheckOutBtn").disabled = true;
            return;
        }

        if ($("managerCheckInTime")) $("managerCheckInTime").textContent = att.checkIn || "Chưa check-in";
        if ($("managerCheckOutTime")) $("managerCheckOutTime").textContent = att.checkOut || "Chưa check-out";
        if ($("managerCheckInBtn")) $("managerCheckInBtn").disabled = !!att.checkIn;
        if ($("managerCheckOutBtn")) $("managerCheckOutBtn").disabled = !att.checkIn || !!att.checkOut;
    } catch (error) {
        console.error(error);
    }
}

async function managerCheckIn() {
    const today = getTodayDate();
    const docId = me.uid + "_" + today; // Chuẩn hóa ID Firebase chống trùng lặp
    try {
        await setDoc(doc(db, "attendance", docId), {
            uid: me.uid,
            name: profile?.name || "Trưởng phòng",
            email: me.email || "",
            department: dept,
            role: "manager",
            dateKey: today,
            date: new Date().toLocaleDateString("vi-VN"),
            checkIn: getCurrentTime(),
            checkOut: "",
            workDays: 1,
            overtimeHours: 0,
            status: "Đang làm",
            updatedAt: serverTimestamp()
        }, { merge: true });
        
        alert("Check-in thành công!");
        await loadManagerAttendance();
        await loadAttendance(today, false);
    } catch (error) {
        alert("Lỗi Check-in: " + error.message);
    }
}

async function managerCheckOut() {
    const today = getTodayDate();
    const docId = me.uid + "_" + today;
    try {
        await updateDoc(doc(db, "attendance", docId), {
            checkOut: getCurrentTime(),
            status: "Hoàn thành",
            updatedAt: serverTimestamp()
        });
        alert("Check-out thành công!");
        await loadManagerAttendance();
        await loadAttendance(today, false);
    } catch (error) {
        alert("Bạn chưa check-in hoặc có lỗi xảy ra!");
    }
}

async function loadAttendance(selectedDate = "", showAll = false) {
    const body = $("managerAttendanceBody");
    if (!body) return;
    body.innerHTML = `<tr><td colspan="7" style="text-align:center;">Đang tải dữ liệu đám mây...</td></tr>`;
    try {
        const empSnap = await getDocs(query(collection(db, "employees"), where("department", "==", dept)));
        const emps = {};
        empSnap.forEach(s => { const e = s.data(); emps[s.id] = { code: e.code, name: e.name, email: e.email }; });

        const attSnap = await getDocs(collection(db, "attendance"));
        body.innerHTML = "";
        let count = 0;

        attSnap.forEach((s) => {
            const x = s.data();
            if (x.uid === me?.uid) return; // Ẩn của bản thân trưởng phòng
            
            // Tìm nhân viên thuộc phòng ban
            let emp = Object.values(emps).find(item => item.email === (x.email || x.employeeEmail) || item.code === (x.code || x.employeeCode));
            if (!emp && x.department === dept) emp = { code: x.employeeCode || x.code || "", name: x.name || "", email: x.email || "" };
            if (!emp) return;

            let attDate = x.dateKey || x.date || "";
            if (!showAll && selectedDate && attDate !== selectedDate) return;

            count++;
            const checkIn = x.checkIn || "";
            const checkOut = x.checkOut || "";
            let status = x.status || (checkOut ? "Hoàn thành" : (checkIn ? "Đang làm" : "Chưa chấm"));

            body.innerHTML += `
                <tr>
                    <td>${escapeHTML(emp.code)}</td>
                    <td><b>${escapeHTML(emp.name)}</b></td>
                    <td>${escapeHTML(attDate)}</td>
                    <td>${escapeHTML(checkIn)}</td>
                    <td>${escapeHTML(checkOut)}</td>
                    <td>${x.overtimeHours || 0} giờ</td>
                    <td><b>${escapeHTML(status)}</b></td>
                </tr>
            `;
        });
        if (count === 0) body.innerHTML = `<tr><td colspan="7" style="text-align:center;">Không có dữ liệu chấm công</td></tr>`;
    } catch (error) {
        body.innerHTML = `<tr><td colspan="7" style="color:red;text-align:center;">Lỗi tải dữ liệu</td></tr>`;
    }
}

// ============================================================
// PHÊ DUYỆT ĐƠN NGHỈ
// ============================================================
async function loadLeaves() {
    const body = $("managerLeaveBody");
    if (!body) return;
    try {
        const snap = await getDocs(query(collection(db, "leaves"), where("department", "==", dept)));
        let n = 0;
        body.innerHTML = "";
        snap.forEach((s) => {
            n++;
            const x = s.data();
            body.innerHTML += `
                <tr>
                    <td><b>${escapeHTML(x.name || "")}</b></td>
                    <td>${escapeHTML(x.from || "")}</td>
                    <td>${escapeHTML(x.to || "")}</td>
                    <td>${escapeHTML(x.type || "")}</td>
                    <td>${escapeHTML(x.reason || "")}</td>
                    <td>
                        <select class="leaveStatus select" data-id="${s.id}">
                            <option value="pending" ${x.status === "pending" ? "selected" : ""}>Chờ duyệt</option>
                            <option value="approved" ${x.status === "approved" ? "selected" : ""}>Đã duyệt</option>
                            <option value="rejected" ${x.status === "rejected" ? "selected" : ""}>Từ chối</option>
                        </select>
                    </td>
                </tr>
            `;
        });
        if (!n) body.innerHTML = `<tr><td colspan="6" class="muted">Không có đơn xin nghỉ</td></tr>`;
    } catch (error) {
        console.error(error);
    }
}

// ============================================================
// BÁO CÁO PHÒNG BAN
// ============================================================
async function loadReports() {
    const body = $("reportBody");
    if (!body) return;
    try {
        const snap = await getDocs(query(collection(db, "employees"), where("department", "==", dept)));
        let count = 0, pay = 0, ot = 0;
        body.innerHTML = "";
        
        snap.forEach((s) => {
            const e = s.data();
            count++;
            pay += total(e);
            ot += Number(e.overtimeHours || 0);
            body.innerHTML += `
                <tr>
                    <td>${escapeHTML(e.code || "")}</td>
                    <td>${escapeHTML(e.name || "")}</td>
                    <td style="color:red; font-weight:bold;">${money(total(e))}</td>
                    <td>${e.workDays || 0}</td>
                    <td>${e.overtimeHours || 0}</td>
                </tr>
            `;
        });
        
        if ($("reportCount")) $("reportCount").textContent = count;
        if ($("reportPayroll")) $("reportPayroll").textContent = money(pay);
        if ($("reportOvertime")) $("reportOvertime").textContent = ot + " giờ";
    } catch (error) {
        console.error(error);
    }
}

// ============================================================
// XÁC THỰC QUYỀN TRƯỞNG PHÒNG
// ============================================================
onAuthStateChanged(auth, async (u) => {
    if (!u) { location.href = "../../login.html"; return; }
    try {
        me = u;
        profile = await user(u.uid);
        if (!profile) return;

        const roleText = String(profile.role || profile["vai trò"] || "").toLowerCase();
        const allowed = ["manager", "trưởng phòng", "giám đốc", "admin"];
        if (!allowed.some(x => roleText.includes(x))) {
            alert("Bạn không có quyền truy cập trang Trưởng phòng.");
            location.href = "index.html";
            return;
        }

        dept = profile.department || profile["phòng ban"] || "";
        if ($("managerWelcome")) $("managerWelcome").textContent = "Xin chào " + (profile.name || "Trưởng phòng");
        if ($("deptTitle")) $("deptTitle").textContent = "Phòng ban: " + (dept || "Chưa cập nhật");
        if ($("attendanceDate")) $("attendanceDate").value = getTodayDate();
        
        showTodayDate();
        await loadEmployees();
        await loadManagerAttendance();
        await loadAttendance(getTodayDate(), false);
        await loadLeaves();
        await loadReports();
    } catch (error) {
        console.error(error);
    }
});

// ============================================================
// GẮN SỰ KIỆN NÚT BẤM (EVENT DELEGATION)
// ============================================================
if ($("logoutBtn")) $("logoutBtn").onclick = async () => { await signOut(auth); location.href = "index.html"; };
if ($("openAddModalBtn")) $("openAddModalBtn").onclick = () => { if ($("empId")) $("empId").value = ""; if ($("managerEmpForm")) $("managerEmpForm").reset(); if ($("managerModal")) $("managerModal").classList.add("show"); };
if ($("cancelBtn")) $("cancelBtn").onclick = () => { if ($("managerModal")) $("managerModal").classList.remove("show"); };
if ($("managerEmpForm")) $("managerEmpForm").onsubmit = saveEmployee;

document.addEventListener("click", async (e) => {
    const button = e.target.closest("button");
    if (!button) return;

    if (button.id === "managerCheckInBtn") await managerCheckIn();
    if (button.id === "managerCheckOutBtn") await managerCheckOut();
    if (button.id === "filterAttendanceBtn") await loadAttendance($("attendanceDate")?.value || "", false);
    if (button.id === "showAllAttendanceBtn") await loadAttendance("", true);

    if (button.classList.contains("editBtn")) {
        try {
            const s = await getDoc(doc(db, "employees", button.dataset.id));
            if (s.exists()) {
                const x = s.data();
                if ($("empId")) $("empId").value = s.id;
                $("empCode").value = x.code ?? "";
                $("empName").value = x.name ?? "";
                $("empEmail").value = x.email ?? "";
                $("empSalary").value = x.salary ?? 0;
                $("empAllowance").value = x.allowance ?? 0;
                $("empWorkDays").value = x.workDays ?? 0;
                $("empOvertime").value = x.overtimeHours ?? 0;
                if ($("managerModal")) $("managerModal").classList.add("show");
            }
        } catch (error) { console.error(error); }
    }

    if (button.classList.contains("deleteBtn")) {
        if (!confirm("Xóa nhân viên này?")) return;
        try {
            await deleteDoc(doc(db, "employees", button.dataset.id));
            await loadEmployees();
        } catch (error) { alert("Lỗi xóa: " + error.message); }
    }
});

// Sự kiện thay đổi trạng thái đơn xin nghỉ
document.addEventListener("change", async (e) => {
    if (e.target.classList.contains("leaveStatus")) {
        try {
            await updateDoc(doc(db, "leaves", e.target.dataset.id), { status: e.target.value, approvedBy: me.uid, approvedAt: serverTimestamp() });
            alert("Cập nhật trạng thái duyệt đơn thành công!");
        } catch (error) {
            alert("Lỗi duyệt đơn: " + error.message);
        }
    }
});
