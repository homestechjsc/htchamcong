import { db } from './firebase-config.js';
import { ref, onValue, push, set, remove, get, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- 0. HÀM CÔNG CỤ: CHUYỂN GIỜ (HH:mm) THÀNH PHÚT ---
// Hàm này cực kỳ quan trọng để tính toán Tăng ca và Trễ/Sớm
window.timeToMins = (timeStr) => {
    if (!timeStr) return 0;
    let hours = 0, minutes = 0;
    
    // 1. Xử lý định dạng có CH/SA (Tiếng Việt) hoặc AM/PM (Tiếng Anh)
    const isPM = timeStr.includes('CH') || timeStr.includes('PM');
    const isAM = timeStr.includes('SA') || timeStr.includes('AM');

    if (isPM || isAM) {
        // Xóa hết chữ, chỉ giữ lại số và dấu : (Ví dụ: "05:00 CH" -> "05:00")
        const cleanTime = timeStr.replace(/[^\d:]/g, ''); 
        const parts = cleanTime.split(':');
        hours = parseInt(parts[0] || 0);
        minutes = parseInt(parts[1] || 0);

        if (isPM && hours < 12) hours += 12;
        if (isAM && hours === 12) hours = 0;
    } else {
        // 2. Xử lý định dạng 24h chuẩn (Ví dụ: "18:15")
        const parts = timeStr.split(':');
        hours = parseInt(parts[0] || 0);
        minutes = parseInt(parts[1] || 0);
    }
    
    return hours * 60 + minutes;
};

// --- BIẾN TOÀN CỤC ---
let markers = {}; 
let isEditing = false; 
let isEditingShift = false; 

const employeeIcon = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/9131/9131529.png',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30]
});

// --- 1. QUẢN LÝ ĐỊA ĐIỂM (LOCATIONS) ---
window.initMap = () => {
    if (window.map) {
        window.map.invalidateSize();
        return;
    }
    window.map = L.map('map').setView([11.947, 108.436], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(window.map);
    loadMarkersToMap();
};

function loadMarkersToMap() {
    onValue(ref(db, 'attendancelogs'), (snapshot) => {
        if (!window.map) return; 
        snapshot.forEach(child => {
            const data = child.val();
            if (data.location && data.location.lat && data.location.lng) {
                const { lat, lng } = data.location;
                const userId = data.userId;
                if (markers[userId]) {
                    markers[userId].setLatLng([lat, lng]);
                } else {
                    markers[userId] = L.marker([lat, lng], { icon: employeeIcon })
                        .addTo(window.map)
                        .bindPopup(`<b>${data.userName || userId}</b><br>${data.time}`);
                }
            }
        });
    });
};

window.saveLocation = () => {
    const key = document.getElementById('locKey')?.value;
    const name = document.getElementById('locName').value;
    const coords = document.getElementById('locCoords').value;
    if (name && coords) {
        const [lat, lon] = coords.split(',').map(c => c.trim());
        if (isNaN(lat) || isNaN(lon)) { alert("Tọa độ không hợp lệ!"); return; }
        const data = { name, lat: parseFloat(lat), lon: parseFloat(lon) };
        const promise = (key && key !== "") ? set(ref(db, 'locations/' + key), data) : push(ref(db, 'locations'), data);
        promise.then(() => {
            document.getElementById('locName').value = '';
            document.getElementById('locCoords').value = '';
            if(document.getElementById('locKey')) document.getElementById('locKey').value = '';
            window.toggleModal('locationModal', false);
            alert("Lưu địa điểm thành công!");
        });
    }
};

onValue(ref(db, 'locations'), (snapshot) => {
    const listUI = document.getElementById('locationListUI');
    const selectUI = document.getElementById('selectLocation');
    if (!listUI || !selectUI) return;
    listUI.innerHTML = "";
    selectUI.innerHTML = '<option value="">-- Chọn địa điểm --</option>';
    snapshot.forEach(child => {
        const loc = child.val();
        const key = child.key;
        listUI.innerHTML += `
            <div class="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group mb-3">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg bg-white text-rose-500 flex items-center justify-center shadow-sm">
                        <i class="fas fa-location-dot text-xs"></i>
                    </div>
                    <div>
                        <h4 class="font-bold text-slate-800 text-xs uppercase">${loc.name}</h4>
                        <p class="text-[9px] font-mono text-slate-400">${loc.lat}, ${loc.lon}</p>
                    </div>
                </div>
                <button onclick="deleteLocation('${key}')" class="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all p-2">
                    <i class="fas fa-trash-alt text-xs"></i>
                </button>
            </div>`;
        selectUI.innerHTML += `<option value="${key}">${loc.name}</option>`;
    });
});

// --- 2. CẤU HÌNH PHÒNG BAN ---
window.addDepartment = () => {
    const name = document.getElementById('newDeptName').value.trim();
    if (!name) return alert("Vui lòng nhập tên phòng!");
    push(ref(db, 'departments'), { name }).then(() => {
        document.getElementById('newDeptName').value = "";
    });
};

window.deleteDept = (key) => {
    if (confirm("Xóa phòng ban này? Nhân viên sẽ được chuyển sang 'Chưa phân loại'.")) {
        remove(ref(db, 'departments/' + key));
    }
};

onValue(ref(db, 'departments'), (snap) => {
    const listUI = document.getElementById('deptListUI');
    const selectUI = document.getElementById('nvDepartment');
    if (listUI) listUI.innerHTML = "";
    if (selectUI) selectUI.innerHTML = '<option value="">-- Chọn phòng ban --</option>';
    Object.entries(snap.val() || {}).forEach(([key, dept]) => {
        if (listUI) listUI.innerHTML += `<div class="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border mb-2"><span class="font-bold text-slate-700 text-sm">${dept.name}</span><button onclick="deleteDept('${key}')" class="text-rose-500 p-2"><i class="fas fa-trash-alt text-xs"></i></button></div>`;
        if (selectUI) selectUI.innerHTML += `<option value="${dept.name}">${dept.name}</option>`;
    });
});

window.saveCompanySettings = () => {
    const name = document.getElementById('cfgCompanyName').value;
    if (!name) return alert("Vui lòng nhập tên công ty");
    set(ref(db, 'settings/company'), { name }).then(() => alert("Cập nhật thành công!"));
};

get(ref(db, 'settings/company')).then(snap => {
    if (snap.exists()) document.getElementById('cfgCompanyName').value = snap.val().name;
});

// --- 3. QUẢN LÝ NHÂN VIÊN ---
const generateNextID = async () => {
    const snapshot = await get(ref(db, 'users'));
    let nextNum = 1;
    if (snapshot.exists()) {
        const ids = Object.keys(snapshot.val()).map(id => parseInt(id)).filter(id => !isNaN(id));
        if (ids.length > 0) nextNum = Math.max(...ids) + 1;
    }
    return nextNum.toString().padStart(4, '0');
};

window.toggleModal = async (id, status) => {
    const modal = document.getElementById(id);
    if (!modal) return;

    if (id === 'employeeModal' && status === true && !isEditing) {
        document.getElementById('modalTitle').innerText = "Thêm nhân viên mới";
        document.getElementById('nvID').value = await generateNextID();
        ["nvName", "nvEmail", "nvPass", "nvSalary", "nvDevice", "nvDepartment"].forEach(el => {
            const input = document.getElementById(el);
            if (input) input.value = (el === "nvLeave") ? 12 : "";
        });
        if (document.getElementById('btnResetDevice')) document.getElementById('btnResetDevice').classList.add('hidden');
    }

    // RESET FORM CA LÀM VIỆC KHI TẠO MỚI
    if (id === 'shiftModal' && status === true && !isEditingShift) {
        const codeInput = document.getElementById('shiftCode');
        if (codeInput) { codeInput.value = ""; codeInput.disabled = false; }
        
        const textFields = ['shiftName', 'startShift', 'endShift', 'selectLocation', 'detectInStart', 'detectInEnd', 'detectOutStart', 'detectOutEnd'];
        textFields.forEach(f => { if (document.getElementById(f)) document.getElementById(f).value = ""; });

        const numberFields = { 'checkCount': "2", 'workCount': "1", 'totalHours': "8", 'lateGrace': "5", 'earlyGrace': "5", 'otBeforeMins': "30", 'otAfterMins': "30", 'otNormal': "1.5", 'otWeekend': "2.0", 'otHoliday': "3.0" };
        Object.entries(numberFields).forEach(([f, val]) => { if (document.getElementById(f)) document.getElementById(f).value = val; });

        ['isOvernight', 'lateGraceActive', 'earlyGraceActive', 'otBeforeActive', 'otAfterActive'].forEach(c => { if (document.getElementById(c)) document.getElementById(c).checked = false; });
    }

    if (status === false) { isEditing = false; isEditingShift = false; }
    modal.style.display = status ? 'block' : 'none';
};

// --- 4. QUẢN LÝ CA LÀM VIỆC (ĐÃ TỐI ƯU) ---
window.editShift = async (code) => {
    isEditingShift = true;
    const snapshot = await get(ref(db, 'shifts/' + code));
    if (snapshot.exists()) {
        const s = snapshot.val();
        
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
        const setChecked = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val || false; };

        setVal('shiftCode', s.code);
        if (document.getElementById('shiftCode')) document.getElementById('shiftCode').disabled = true;
        setVal('shiftName', s.name);
        setVal('selectLocation', s.locationId || "");
        setVal('checkCount', s.checkCount ?? 2);
        setVal('startShift', s.timeIn);
        setVal('endShift', s.timeOut);
        setChecked('isOvernight', s.isOvernight);

        setChecked('lateGraceActive', s.lateGraceActive);
        setVal('lateGrace', s.lateGrace ?? 5);
        setChecked('earlyGraceActive', s.earlyGraceActive);
        setVal('earlyGrace', s.earlyGrace ?? 5);

        setChecked('otBeforeActive', s.otBeforeActive);
        setVal('otBeforeMins', s.otBeforeMins ?? 30);
        setChecked('otAfterActive', s.otAfterActive);
        setVal('otAfterMins', s.otAfterMins ?? 30);

        setVal('detectInStart', s.detectRange?.inStart || "");
        setVal('detectInEnd', s.detectRange?.inEnd || "");
        setVal('detectOutStart', s.detectRange?.outStart || "");
        setVal('detectOutEnd', s.detectRange?.outEnd || "");

        setVal('workCount', s.workCount ?? 1);
        setVal('totalHours', s.totalHours ?? 8);
        
        if (s.otRates) {
            setVal('otNormal', s.otRates.normal ?? 1.5);
            setVal('otWeekend', s.otRates.weekend ?? 2.0);
            setVal('otHoliday', s.otRates.holiday ?? 3.0);
        }

        window.toggleModal('shiftModal', true);
    }
};

window.saveNewShift = () => {
    const code = document.getElementById('shiftCode')?.value;
    if (!code) return alert("Vui lòng nhập mã ca!");

    const data = {
        code: code,
        name: document.getElementById('shiftName')?.value || "",
        checkCount: Number(document.getElementById('checkCount')?.value ?? 2),
        locationId: document.getElementById('selectLocation')?.value || "",
        timeIn: document.getElementById('startShift')?.value || "",
        timeOut: document.getElementById('endShift')?.value || "",
        isOvernight: document.getElementById('isOvernight')?.checked ?? false,
        lateGraceActive: document.getElementById('lateGraceActive')?.checked ?? false,
        lateGrace: Number(document.getElementById('lateGrace')?.value ?? 0),
        earlyGraceActive: document.getElementById('earlyGraceActive')?.checked ?? false,
        earlyGrace: Number(document.getElementById('earlyGrace')?.value ?? 0),
        otBeforeActive: document.getElementById('otBeforeActive')?.checked ?? false,
        otBeforeMins: Number(document.getElementById('otBeforeMins')?.value ?? 0),
        otAfterActive: document.getElementById('otAfterActive')?.checked ?? false,
        otAfterMins: Number(document.getElementById('otAfterMins')?.value ?? 0),
        detectRange: {
            inStart: document.getElementById('detectInStart')?.value || "",
            inEnd: document.getElementById('detectInEnd')?.value || "",
            outStart: document.getElementById('detectOutStart')?.value || "",
            outEnd: document.getElementById('detectOutEnd')?.value || ""
        },
        workCount: Number(document.getElementById('workCount')?.value ?? 1),
        totalHours: Number(document.getElementById('totalHours')?.value ?? 8),
        otRates: {
            normal: Number(document.getElementById('otNormal')?.value ?? 1.5),
            weekend: Number(document.getElementById('otWeekend')?.value ?? 2.0),
            holiday: Number(document.getElementById('otHoliday')?.value ?? 3.0)
        }
    };

    set(ref(db, 'shifts/' + code), data).then(() => {
        window.toggleModal('shiftModal', false);
        alert("HT Attendance: Đã cập nhật thành công ca " + code);
    }).catch((e) => alert("Lỗi lưu dữ liệu: " + e.message));
};

// --- BỔ SUNG VÀO PHẦN QUẢN LÝ NHÂN VIÊN TRONG admin-logic.js ---

window.editUser = async (id) => {
    isEditing = true;
    const snapshot = await get(ref(db, 'users/' + id));
    if (snapshot.exists()) {
        const u = snapshot.val();
        document.getElementById('modalTitle').innerText = "Sửa hồ sơ: " + u.name;
        document.getElementById('nvID').value = u.id;
        document.getElementById('nvName').value = u.name;
        document.getElementById('nvEmail').value = u.email;
        document.getElementById('nvPass').value = u.password;
        if (document.getElementById('nvRole')) document.getElementById('nvRole').value = u.role || "Staff";
        if (document.getElementById('nvDepartment')) document.getElementById('nvDepartment').value = u.department || "";
        document.getElementById('nvSalary').value = u.salary || 0;
        document.getElementById('nvLeave').value = u.leaveQuota || 12;
        document.getElementById('nvDevice').value = u.deviceID || "";
        
        const btnReset = document.getElementById('btnResetDevice');
        if (btnReset) u.deviceID ? btnReset.classList.remove('hidden') : btnReset.classList.add('hidden');
        
        window.toggleModal('employeeModal', true);
    }
};

// Đảm bảo gán vào window để HTML gọi được onclick="saveEmployee()"
window.saveEmployee = () => {
    // 1. Lấy các giá trị từ Form
    const id = document.getElementById('nvID')?.value;
    const name = document.getElementById('nvName')?.value;
    const email = document.getElementById('nvEmail')?.value;
    const pass = document.getElementById('nvPass')?.value;
    const role = document.getElementById('nvRole')?.value || "Staff";
    const dept = document.getElementById('nvDepartment')?.value || "Chưa phân loại";
    const salary = document.getElementById('nvSalary')?.value || 0;
    const leave = document.getElementById('nvLeave')?.value || 12;
    const device = document.getElementById('nvDevice')?.value || "";

    // 2. Kiểm tra các trường bắt buộc
    if(!id || !name || !email || !pass) {
        return alert("Vui lòng nhập đầy đủ: Mã NV, Họ tên, Email và Mật khẩu!");
    }

    // 3. Cấu trúc dữ liệu để lưu
    const userData = {
        id: id,
        name: name,
        email: email,
        password: pass,
        role: role,
        department: dept,
        salary: Number(salary),
        leaveQuota: Number(leave),
        deviceID: device,
        status: 'Active',
        updatedAt: new Date().toISOString()
    };

    console.log("Dữ liệu nhân viên lưu:", userData);

    // 4. Thực hiện lưu lên Firebase
    set(ref(db, 'users/' + id), userData)
        .then(() => {
            window.toggleModal('employeeModal', false); // Đóng modal
            alert("HT Attendance: Lưu hồ sơ nhân viên " + name + " thành công!");
            // Nếu là thêm mới, reset isEditing về false cho lần sau
            isEditing = false; 
        })
        .catch((error) => {
            console.error("Lỗi khi lưu nhân viên:", error);
            alert("Lỗi lưu dữ liệu: " + error.message);
        });
};

window.deleteUser = (id) => {
    if(confirm(`Xác nhận xóa nhân viên #${id}? Thao tác này không thể hoàn tác.`)) {
        remove(ref(db, 'users/' + id)).then(() => alert("Đã xóa nhân viên thành công."));
    }
};
onValue(ref(db, 'users'), (snapshot) => {
    const userList = document.getElementById('userList');
    if (!userList) return;
    
    const users = [];
    snapshot.forEach(child => { users.push(child.val()); });

    // Nhóm nhân viên theo phòng ban
    const groups = users.reduce((acc, user) => {
        const d = user.department || "Chưa phân loại";
        if (!acc[d]) acc[d] = [];
        acc[d].push(user);
        return acc;
    }, {});

    let html = "";
    Object.entries(groups).forEach(([deptName, members]) => {
        html += `
            <div class="mb-10">
                <div class="flex items-center gap-3 mb-4 bg-slate-50 p-3 rounded-xl border-l-4 border-blue-500">
                    <h4 class="font-black text-slate-700 uppercase tracking-wider text-xs">${deptName} (${members.length})</h4>
                </div>
                <div class="overflow-x-auto shadow-sm rounded-xl border border-slate-100">
                    <table class="w-full text-left bg-white">
                        <thead class="bg-slate-50/50 text-[10px] text-slate-400 uppercase">
                            <tr>
                                <th class="p-4">Họ tên & ID</th>
                                <th class="p-4">Vai trò</th>
                                <th class="p-4">Lương/Ca</th>
                                <th class="p-4 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody class="text-sm">
                            ${members.map(u => `
                                <tr class="border-t border-slate-50 hover:bg-slate-50/30 transition-colors">
                                    <td class="p-4">
                                        <div class="flex flex-col">
                                            <b class="text-slate-800">${u.name}</b>
                                            <span class="text-[10px] font-mono text-slate-400">#${u.id}</span>
                                        </div>
                                    </td>
                                    <td class="p-4"><span class="px-2 py-1 rounded text-[10px] font-black uppercase ${u.role === 'Admin' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-600'}">${u.role}</span></td>
                                    <td class="p-4 font-bold text-slate-600">${u.salary?.toLocaleString()}đ</td>
                                    <td class="p-4 text-right">
                                        <button onclick="editUser('${u.id}')" class="w-8 h-8 rounded-lg text-blue-500 hover:bg-blue-50 transition"><i class="fas fa-edit"></i></button>
                                        <button onclick="deleteUser('${u.id}')" class="w-8 h-8 rounded-lg text-rose-500 hover:bg-rose-50 transition"><i class="fas fa-trash-alt"></i></button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
    });
    userList.innerHTML = html || '<p class="p-10 text-center italic text-slate-400">Hệ thống chưa có nhân viên nào.</p>';
});

// Thêm hàm xóa nhân viên
window.deleteUser = (id) => {
    if(confirm(`Xác nhận xóa nhân viên #${id}? Thao tác này không thể hoàn tác.`)) {
        remove(ref(db, 'users/' + id)).then(() => alert("Đã xóa nhân viên thành công."));
    }
};

onValue(ref(db, 'leaveRequests'), (snapshot) => {
    const pendingTable = document.getElementById('leaveRequestTable');
    const historyTable = document.getElementById('leaveHistoryTable');
    if (!pendingTable || !historyTable) return;

    pendingTable.innerHTML = ""; 
    historyTable.innerHTML = "";

    snapshot.forEach(child => {
        const leave = child.val(); 
        const key = child.key;
        const isoDate = leave.createdAtDate || "";

        const rowHtml = `
            <tr data-date="${isoDate}" class="border-b border-slate-50 text-xs hover:bg-slate-50/50 transition-colors">
                <td class="p-5 font-bold text-slate-800">
                    ${leave.userName}<br>
                    <small class="text-slate-400 font-mono">${leave.userId}</small>
                </td>
                <td class="p-5">
                    <div class="flex flex-col">
                        <span class="font-bold text-slate-700">${leave.fromDate} → ${leave.toDate}</span>
                        <span class="text-[10px] text-blue-600 font-black uppercase">${leave.totalDays} ngày</span>
                    </div>
                </td>
                <td class="p-5 italic text-slate-500 max-w-[200px] truncate">${leave.reason}</td>
                <td class="p-5 text-right">
                    ${leave.status === 'Pending' ? `
                        <div class="flex justify-end gap-2">
                            <button onclick="processLeave('${key}', 'Approved', '${leave.userId}', ${leave.totalDays})" class="bg-emerald-500 text-white text-[10px] font-bold px-3 py-2 rounded-lg hover:bg-emerald-600 shadow-sm">DUYỆT</button>
                            <button onclick="processLeave('${key}', 'Rejected', '${leave.userId}', 0)" class="bg-rose-500 text-white text-[10px] font-bold px-3 py-2 rounded-lg hover:bg-rose-600 shadow-sm">TỪ CHỐI</button>
                        </div>
                    ` : `
                        <span class="px-2 py-1 rounded text-[10px] font-black uppercase ${leave.status === 'Approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}">
                            ${leave.status}
                        </span>
                    `}
                </td>
            </tr>`;

        if (leave.status === 'Pending') {
            pendingTable.innerHTML += rowHtml;
        } else {
            // Đưa đơn cũ lên đầu lịch sử
            historyTable.innerHTML = rowHtml + historyTable.innerHTML;
        }
    });
});

onValue(ref(db, 'shifts'), async (snapshot) => {
    const tableBody = document.getElementById('shiftTableBody');
    if (!tableBody) return;
    const locSnap = await get(ref(db, 'locations'));
    const locationsData = locSnap.val() || {};
    tableBody.innerHTML = '';
    if (!snapshot.exists()) {
        tableBody.innerHTML = '<tr><td colspan="7" class="p-10 text-center italic text-slate-400">Chưa có ca làm việc nào.</td></tr>';
        return;
    }
    snapshot.forEach(child => {
        const s = child.val();
        const locationName = locationsData[s.locationId]?.name || "---";
        tableBody.innerHTML += `
            <tr class="hover:bg-slate-50/50 border-b">
                <td class="p-4"><span class="px-3 py-1 rounded bg-slate-900 text-white text-[10px] font-black uppercase">${s.code}</span></td>
                <td class="p-4"><b class="text-slate-800">${s.name}</b>${s.isOvernight ? '<br><small class="text-indigo-600 font-bold italic text-[9px]">CA ĐÊM</small>' : ''}</td>
                <td class="p-4 font-bold text-blue-600 text-xs">${s.timeIn} — ${s.timeOut}</td>
                <td class="p-4 text-center"><span class="px-2 py-1 bg-slate-100 rounded-md text-[10px] font-bold">${s.checkCount || 2} lần</span></td>
                <td class="p-4 text-center font-black text-blue-600">${s.workCount || 1}</td>
                <td class="p-4 text-center"><span class="text-[10px] font-bold text-slate-500 uppercase">${locationName}</span></td>
                <td class="p-4 text-right">
                    <button onclick="editShift('${s.code}')" class="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 mr-2"><i class="fas fa-edit text-[10px]"></i></button>
                    <button onclick="deleteShift('${s.code}')" class="w-8 h-8 rounded-xl bg-rose-50 text-rose-500"><i class="fas fa-trash-alt text-[10px]"></i></button>
                </td>
            </tr>`;
    });
});

window.deleteShift = (code) => { if (confirm(`Xác nhận xóa ca làm việc: ${code}?`)) remove(ref(db, 'shifts/' + code)); };

// --- 5. NHẬT KÝ & BÁO CÁO ---
onValue(ref(db, 'attendancelogs'), (snapshot) => {
    const table = document.getElementById('attendanceTable');
    if (!table) return;
    table.innerHTML = "";
    const logs = [];
    snapshot.forEach(child => logs.push(child.val()));
    logs.reverse().forEach(d => {
        let statusClass = d.status === "Đi trễ" || d.status === "Về sớm" ? "text-rose-600 font-black" : (d.status === "Đúng giờ" ? "text-emerald-600 font-black" : "text-slate-500");
        table.innerHTML += `
            <tr class="border-b border-slate-50 hover:bg-slate-50/50">
                <td class="p-5"><div class="flex items-center gap-3"><div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold">${d.userName ? d.userName.charAt(0) : '?'}</div><div><p class="font-black text-slate-800 text-xs">${d.userName || 'N/A'}</p><p class="text-[10px] text-slate-400 font-mono">${d.userId}</p></div></div></td>
                <td class="p-5"><div class="flex items-center gap-2"><span class="px-2 py-1 rounded-md bg-blue-50 text-blue-600 text-[10px] font-bold">${d.type}</span><p class="text-xs font-bold">${d.time}</p></div><p class="text-[9px] text-slate-400 mt-1">${d.date}</p></td>
                <td class="p-5"><p class="font-bold text-slate-700 text-[10px] uppercase">${d.shiftName || 'Ngoài ca'}</p></td>
                <td class="p-5"><span class="text-[10px] uppercase ${statusClass}">${d.status || 'N/A'}</span></td>
                <td class="p-5 text-right"><p class="font-bold text-xs">${d.distance ? d.distance + 'm' : 'N/A'}</p></td>
            </tr>`;
    });
});

// --- Sửa hàm parseDate trong admin-logic.js ---
const parseDate = (dateStr) => {
    if (!dateStr) return new Date(0);
    // Xử lý cả dạng 6/4/2026 và 06/04/2026
    const parts = dateStr.split('/');
    if (parts.length !== 3) return new Date(0);
    return new Date(parts[2], parts[1] - 1, parts[0]);
};

window.getAttendanceRangeReport = async () => {
    const fromDateVal = document.getElementById('reportDateFrom').value;
    const toDateVal = document.getElementById('reportDateTo').value;
    
    if (!fromDateVal || !toDateVal) return alert("Vui lòng chọn đầy đủ Từ ngày và Đến ngày");

    // 1. CHUẨN HÓA THỜI GIÁN: Đưa về đầu ngày và cuối ngày để so sánh chính xác 100%
    const dFrom = new Date(fromDateVal);
    dFrom.setHours(0, 0, 0, 0);

    const dTo = new Date(toDateVal);
    dTo.setHours(23, 59, 59, 999); 

    const reportTable = document.getElementById('table-report-attendance');
    reportTable.innerHTML = '<tr><td colspan="11" class="p-10 text-center text-slate-400 italic">Đang tổng hợp dữ liệu...</td></tr>';

    try {
        const snapshot = await get(ref(db, 'attendancelogs'));
        if (!snapshot.exists()) return reportTable.innerHTML = '<tr><td colspan="11">Không có dữ liệu</td></tr>';

        // 2. NHÓM DỮ LIỆU THEO [NGÀY + ID NHÂN VIÊN]
        const grouped = Object.values(snapshot.val()).reduce((acc, log) => {
            const logDate = parseDate(log.date); 
            logDate.setHours(0, 0, 0, 0);

            // Kiểm tra mốc thời gian đã chuẩn hóa
            if (logDate >= dFrom && logDate <= dTo) {
                const key = `${log.date}_${log.userId}`;
                if (!acc[key]) {
                    acc[key] = { 
                        name: log.userName, id: log.userId, date: log.date, shift: log.shiftName,
                        v1: "-", r1: "-", v2: "-", r2: "-", v3: "-", r3: "-", v4: "-", r4: "-" 
                    };
                }
                
                const type = log.type.toUpperCase();
                const time = log.time;

                // Phân loại dữ liệu vào đúng 8 cột (4 cặp Vào/Ra)
                if (type.includes("VÀO 1")) acc[key].v1 = time;
                else if (type.includes("RA 1")) acc[key].r1 = time;
                else if (type.includes("VÀO 2")) acc[key].v2 = time;
                else if (type.includes("RA 2")) acc[key].r2 = time;
                else if (type.includes("VÀO 3")) acc[key].v3 = time;
                else if (type.includes("RA 3")) acc[key].r3 = time;
                else if (type.includes("VÀO 4")) acc[key].v4 = time;
                else if (type.includes("RA 4")) acc[key].r4 = time;
            }
            return acc;
        }, {});

        // 3. HIỂN THỊ DỮ LIỆU RA BẢNG
        let html = "";
        const sortedData = Object.values(grouped).sort((a, b) => parseDate(b.date) - parseDate(a.date));

        sortedData.forEach(data => {
            html += `
                <tr class="border-b hover:bg-slate-50 transition-all">
                    <td class="p-4">
                        <b class="text-slate-800 text-xs">${data.name}</b><br>
                        <small class="text-slate-400 font-mono">ID: ${data.id}</small>
                    </td>
                    <td class="p-4 text-xs font-bold text-slate-500">${data.date}</td>
                    
                    <td class="p-4 text-center font-black text-emerald-600 text-xs bg-emerald-50/10">${data.v1}</td>
                    <td class="p-4 text-center font-black text-blue-600 text-xs bg-blue-50/10">${data.r1}</td>
                    
                    <td class="p-4 text-center font-black text-emerald-600 text-xs">${data.v2}</td>
                    <td class="p-4 text-center font-black text-blue-600 text-xs">${data.r2}</td>
                    
                    <td class="p-4 text-center font-black text-emerald-600 text-xs">${data.v3}</td>
                    <td class="p-4 text-center font-black text-blue-600 text-xs">${data.r3}</td>

                    <td class="p-4 text-center font-black text-emerald-600 text-xs">${data.v4}</td>
                    <td class="p-4 text-center font-black text-blue-600 text-xs">${data.r4}</td>
                    
                    <td class="p-4 text-right">
                        <span class="text-[10px] font-bold text-slate-500 uppercase bg-slate-100 px-2 py-1 rounded border border-slate-200">${data.shift}</span>
                    </td>
                </tr>`;
        });

        reportTable.innerHTML = html || '<tr><td colspan="11" class="p-10 text-center italic text-rose-500 font-medium">Không tìm thấy dữ liệu phù hợp trong khoảng thời gian này</td></tr>';
    } catch (e) { 
        console.error("Lỗi Report:", e);
        alert("Lỗi hệ thống: " + e.message); 
    }
};

window.exportAttendanceToExcel = () => {
    const table = document.getElementById("attendanceReportTable");
    if (!table || table.rows.length <= 1) return alert("Không có dữ liệu");
    const wb = XLSX.utils.table_to_book(table, { sheet: "Báo cáo" });
    XLSX.writeFile(wb, `Bao_cao_cham_cong_${new Date().getTime()}.xlsx`);
};

window.calculateSummaryReport = async () => {
    const reportMonth = document.getElementById('reportMonthSummary').value;
    if (!reportMonth) return alert("Vui lòng chọn tháng kết xuất");

    // reportMonth có dạng "2026-04"
    const [year, month] = reportMonth.split('-');
    
    // QUAN TRỌNG: Chuyển "04" thành "4" để khớp với format vi-VN trên Mobile (ví dụ: 6/4/2026)
    const monthClean = parseInt(month).toString(); 
    const yearClean = year.toString();

    const reportTable = document.getElementById('table-report-summary');
    reportTable.innerHTML = '<tr><td colspan="5" class="p-10 text-center italic text-slate-400">Đang tổng hợp bảng lương...</td></tr>';

    try {
        const [logsSnap, usersSnap] = await Promise.all([
            get(ref(db, 'attendancelogs')),
            get(ref(db, 'users'))
        ]);

        if (!usersSnap.exists()) return alert("Chưa có nhân viên nào trong hệ thống");
        
        const allLogs = logsSnap.exists() ? Object.values(logsSnap.val()) : [];
        const users = usersSnap.val();
        let html = "";

        Object.entries(users).forEach(([id, user]) => {
            // 1. Lọc tất cả các bản ghi VÀO của user trong tháng/năm đã chọn
            const userMonthLogs = allLogs.filter(log => {
                if (!log.date) return false;
                
                const parts = log.date.split('/'); // Tách chuỗi "6/4/2026"
                const logMonth = parts[1];
                const logYear = parts[2];

                // So sánh ID, Tháng (đã bỏ số 0), Năm và từ khóa "VÀO"
                return log.userId === id && 
                       logMonth === monthClean && 
                       logYear === yearClean && 
                       log.type.toUpperCase().includes("VÀO");
            });

            // 2. TÍNH TỔNG CÔNG: Cộng dồn trường workCount
            // Dùng Number() để đảm bảo tính toán số học, mặc định 1 nếu dữ liệu cũ trống
            const totalWorkDays = userMonthLogs.reduce((sum, log) => {
                const count = log.workCount !== undefined ? Number(log.workCount) : 1;
                return sum + count;
            }, 0);

            // 3. Tính lương
            const salaryPerShift = Number(user.salary) || 0;
            const totalSalary = totalWorkDays * salaryPerShift;

            // Đếm số lần vi phạm (Công = 0)
            const violationCount = userMonthLogs.filter(l => Number(l.workCount) === 0).length;

            html += `
                <tr class="hover:bg-slate-50 border-b border-slate-50">
                    <td class="p-5">
                        <p class="font-black text-slate-800">${user.name}</p>
                        <p class="text-[10px] text-slate-400 font-mono">ID: ${id}</p>
                    </td>
                    <td class="p-5 text-center font-bold text-blue-600">
                        ${userMonthLogs.length} <small class="text-slate-400 font-normal">lượt</small>
                    </td>
                    <td class="p-5 text-center font-bold text-rose-500">
                        ${violationCount > 0 ? violationCount : '<span class="opacity-20">0</span>'}
                    </td>
                    <td class="p-5 text-center">
                        <span class="px-3 py-1 rounded-lg bg-slate-900 text-white font-black text-xs">
                            ${totalWorkDays % 1 === 0 ? totalWorkDays : totalWorkDays.toFixed(1)}
                        </span>
                    </td>
                    <td class="p-5 text-right font-black text-emerald-600">
                        ${totalSalary.toLocaleString('vi-VN')}đ
                    </td>
                </tr>`;
        });

        reportTable.innerHTML = html || '<tr><td colspan="5" class="p-10 text-center italic text-slate-400">Không có dữ liệu cho tháng này.</td></tr>';
    } catch (e) {
        console.error("Salary Report Error:", e);
        alert("Lỗi kết xuất: " + e.message);
    }
};

// --- HÀM TỰ ĐỘNG ĐIỀN NGÀY ĐẦU THÁNG & CUỐI THÁNG ---
const initReportDates = () => {
    const now = new Date();
    
    // 1. Lấy ngày đầu tháng (Năm-Tháng-01)
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const fromISO = firstDay.toISOString().split('T')[0];

    // 2. Lấy ngày cuối tháng (Ngày 0 của tháng kế tiếp chính là ngày cuối tháng này)
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const toISO = lastDay.toISOString().split('T')[0];

    // 3. Gán giá trị vào ô Input
    const fromInput = document.getElementById('reportDateFrom');
    const toInput = document.getElementById('reportDateTo');

    if (fromInput && toInput) {
        fromInput.value = fromISO;
        toInput.value = toISO;
        
        // Tùy chọn: Tự động chạy báo cáo ngay khi vừa mở trang
        // getAttendanceRangeReport(); 
    }
};

// Gọi hàm khởi tạo khi trang đã sẵn sàng
// --- SỬA LẠI ĐOẠN NÀY ---
document.addEventListener('DOMContentLoaded', () => {
    // initSummaryMonth(); // Dòng này gây lỗi vì hàm này không còn tồn tại
    if (typeof initAllReportMonths === 'function') {
        initAllReportMonths(); // Gọi hàm mới đã gom nhóm
    }
    
    // Nếu bạn có hàm khởi tạo ngày đầu tháng/cuối tháng
    if (typeof initReportDates === 'function') {
        initReportDates();
    }
});

// Nếu bạn sử dụng hệ thống chuyển Tab, hãy gọi hàm này khi nhấn vào tab Báo cáo
window.onShowReportTab = () => {
    initReportDates();
};

// --- HÀM TỰ ĐỘNG ĐIỀN THÁNG HIỆN TẠI CHO TẤT CẢ BÁO CÁO ---
const initAllReportMonths = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const monthISO = `${year}-${month}`; // Ví dụ: "2026-04"

    // Danh sách các ID của ô nhập tháng trong file HTML của bạn
    const monthInputs = [
        'reportMonthSummary', // Tab Bảng lương
        'reportMonthOT',      // Tab Tăng ca
        'reportMonthLate'     // Tab Trễ/Sớm
    ];

    monthInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.value = monthISO;
        }
    });
};

// Gọi khi trang tải xong
document.addEventListener('DOMContentLoaded', initAllReportMonths);

// Gọi khi trang tải xong
document.addEventListener('DOMContentLoaded', () => {
    initSummaryMonth();
});

// --- HÀM BỔ TRỢ: TÍNH PHÚT CHÊNH LỆCH ---
const getDiffMins = (time1, time2) => {
    return timeToMins(time1) - timeToMins(time2);
};

// --- 1. BÁO CÁO TĂNG CA (OT) ---
window.calculateOTReport = async () => {
    const reportMonth = document.getElementById('reportMonthOT').value;
    if (!reportMonth) return alert("Vui lòng chọn tháng");
    
    const [year, month] = reportMonth.split('-');
    const monthClean = parseInt(month).toString();
    const table = document.getElementById('table-report-ot');
    table.innerHTML = "<tr><td colspan='6' class='p-10 text-center'>Đang tính toán OT...</td></tr>";

    try {
        const [logsSnap, shiftsSnap] = await Promise.all([
            get(ref(db, 'attendancelogs')),
            get(ref(db, 'shifts'))
        ]);

        const allLogs = logsSnap.exists() ? Object.values(logsSnap.val()) : [];
        const shifts = shiftsSnap.val() || {};
        let html = "";

        allLogs.forEach(log => {
            const parts = log.date.split('/');
            // Kiểm tra đúng tháng, năm và lượt quẹt phải chứa chữ "RA"
            if (parts[1] === monthClean && parts[2] === year && log.type.toUpperCase().includes("RA")) {
                const s = shifts[log.shiftCode];
                
                // Kiểm tra nếu ca này có bật chế độ tăng ca
                if (s && s.otAfterActive) {
                    const timeOutMins = timeToMins(s.timeOut); // 17:00 = 1020p
                    const actualOutMins = timeToMins(log.time); // 18:15 = 1095p
                    const otThreshold = timeOutMins + (Number(s.otAfterMins) || 0); // 1020 + 30 = 1050p

                    // Nếu giờ ra thực tế vượt quá mốc bắt đầu tính OT (1095 > 1050)
                    if (actualOutMins >= otThreshold) {
                        const otTotalMins = actualOutMins - timeOutMins; // 1095 - 1020 = 75 phút
                        const hours = Math.floor(otTotalMins / 60);
                        const mins = otTotalMins % 60;

                        html += `
                            <tr class="border-b hover:bg-orange-50/30 transition-all">
                                <td class="p-4">
                                    <b class="text-slate-800">${log.userName}</b><br>
                                    <small class="text-slate-400 font-mono">${log.userId}</small>
                                </td>
                                <td class="p-4 text-xs font-bold text-slate-600">${log.date}</td>
                                <td class="p-4 text-center font-black text-blue-600">${log.time}</td>
                                <td class="p-4 text-center text-slate-400 text-[10px]">
                                    Sau ${s.timeOut}<br>(+${s.otAfterMins}m)
                                </td>
                                <td class="p-4 text-center">
                                    <span class="bg-orange-500 text-white px-3 py-1.5 rounded-xl font-black text-xs shadow-sm shadow-orange-200">
                                        ${hours > 0 ? hours + 'h ' : ''}${mins} phút
                                    </span>
                                </td>
                                <td class="p-4 text-right">
                                    <span class="text-[10px] font-bold text-slate-500 uppercase bg-slate-100 px-2 py-1 rounded">${log.shiftName}</span>
                                </td>
                            </tr>`;
                    }
                }
            }
        });

        table.innerHTML = html || "<tr><td colspan='6' class='p-10 text-center italic text-slate-400 font-medium'>Không có dữ liệu tăng ca đạt mốc quy định</td></tr>";
    } catch (e) {
        console.error(e);
        alert("Lỗi: " + e.message);
    }
};

// --- 2. BÁO CÁO ĐI TRỄ / VỀ SỚM ---
window.calculateLateEarlyReport = async () => {
    const reportMonth = document.getElementById('reportMonthLate').value;
    if (!reportMonth) return alert("Vui lòng chọn tháng");
    
    const [year, month] = reportMonth.split('-');
    const monthClean = parseInt(month).toString();
    const table = document.getElementById('table-report-late');
    table.innerHTML = "<tr><td colspan='5' class='p-10 text-center italic text-slate-400'>Đang phân tích dữ liệu vi phạm...</td></tr>";

    try {
        const [logsSnap, shiftsSnap] = await Promise.all([
            get(ref(db, 'attendancelogs')),
            get(ref(db, 'shifts'))
        ]);

        const allLogs = logsSnap.exists() ? Object.values(logsSnap.val()) : [];
        const shifts = shiftsSnap.val() || {};
        let html = "";

        allLogs.forEach(log => {
            const parts = log.date.split('/');
            if (parts[1] === monthClean && parts[2] === year) {
                const s = shifts[log.shiftCode];
                if (!s) return;

                const type = log.type.toUpperCase();
                let diff = 0;
                let label = "";
                let colorClass = "text-rose-600";

                // 1. KIỂM TRA ĐI TRỄ (Lượt VÀO 1)
                if (type.includes("VÀO 1")) {
                    diff = window.timeToMins(log.time) - window.timeToMins(s.timeIn);
                    // Nếu muộn hơn giờ vào + phút trừ hao
                    if (diff > (Number(s.lateGrace) || 0)) {
                        label = "ĐI TRỄ";
                    }
                } 
                
                // 2. KIỂM TRA VỀ SỚM (Dựa trên lượt RA cuối cùng của ca)
                // Ví dụ: Ca 2 lần quẹt thì lượt cuối là RA 1. Ca 4 lần quẹt là RA 2.
                const lastExitLabel = `RA ${s.checkCount / 2}`; 
                if (type.includes(lastExitLabel) || (s.checkCount == 2 && type.includes("RA 1"))) {
                    diff = window.timeToMins(s.timeOut) - window.timeToMins(log.time);
                    // Nếu về trước giờ ra ca + phút trừ hao
                    if (diff > (Number(s.earlyGrace) || 0)) {
                        label = "VỀ SỚM";
                    }
                }

                if (label) {
                    html += `
                        <tr class="border-b hover:bg-rose-50/30 transition-all">
                            <td class="p-4">
                                <b class="text-slate-800 text-xs">${log.userName}</b><br>
                                <small class="text-slate-400 font-mono">ID: ${log.userId}</small>
                            </td>
                            <td class="p-4 text-xs font-bold text-slate-500">${log.date}</td>
                            <td class="p-4 text-center">
                                <span class="px-3 py-1 rounded-lg bg-rose-50 ${colorClass} font-black text-[10px] border border-rose-100">
                                    ${label}
                                </span>
                            </td>
                            <td class="p-4 text-center font-black ${colorClass} text-xs">
                                ${diff} phút
                            </td>
                            <td class="p-4 text-right">
                                <span class="text-[9px] font-bold text-slate-400 uppercase bg-slate-50 px-2 py-1 rounded border">${log.shiftName}</span>
                            </td>
                        </tr>`;
                }
            }
        });

        table.innerHTML = html || "<tr><td colspan='5' class='p-10 text-center italic text-slate-400 font-medium'>Chúc mừng! Không có vi phạm trễ/sớm trong tháng này.</td></tr>";
    } catch (e) {
        console.error(e);
        alert("Lỗi: " + e.message);
    }
};

window.resetDevice = () => { if (confirm("Xác nhận mở khóa thiết bị?")) { document.getElementById('nvDevice').value = ""; document.getElementById('btnResetDevice').classList.add('hidden'); } };