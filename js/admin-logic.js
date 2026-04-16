import { db } from './firebase-config.js';
import { ref, onValue, push, set, remove, get, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- 0. LOGIC ĐA DOANH NGHIỆP (MỚI) ---
const urlParams = new URLSearchParams(window.location.search);
const CID = urlParams.get('id') ? urlParams.get('id').toLowerCase() : 'homestech'; // Mặc định là homestech nếu không có ID trên link

// Hàm tiện ích để tạo đường dẫn Firebase đúng cấu trúc
const getCompRef = (path) => `COMPANIES/${CID}/${path}`;

// --- 0. HÀM CÔNG CỤ: CHUYỂN GIỜ ---
window.timeToMins = (timeStr) => {
    if (!timeStr) return 0;
    let hours = 0, minutes = 0;
    const isPM = timeStr.includes('CH') || timeStr.includes('PM');
    const isAM = timeStr.includes('SA') || timeStr.includes('AM');

    if (isPM || isAM) {
        const cleanTime = timeStr.replace(/[^\d:]/g, ''); 
        const parts = cleanTime.split(':');
        hours = parseInt(parts[0] || 0);
        minutes = parseInt(parts[1] || 0);
        if (isPM && hours < 12) hours += 12;
        if (isAM && hours === 12) hours = 0;
    } else {
        const parts = timeStr.split(':');
        hours = parseInt(parts[0] || 0);
        minutes = parseInt(parts[1] || 0);
    }
    return hours * 60 + minutes;
};

let markers = {}; 
let isEditing = false; 
let isEditingShift = false; 

const employeeIcon = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/9131/9131529.png',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30]
});

// --- 1. QUẢN LÝ ĐỊA ĐIỂM ---
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
    onValue(ref(db, getCompRef('attendancelogs')), (snapshot) => {
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
        const promise = (key && key !== "") ? set(ref(db, getCompRef('locations/' + key)), data) : push(ref(db, getCompRef('locations')), data);
        promise.then(() => {
            document.getElementById('locName').value = '';
            document.getElementById('locCoords').value = '';
            if(document.getElementById('locKey')) document.getElementById('locKey').value = '';
            window.toggleModal('locationModal', false);
            alert("Lưu địa điểm thành công!");
        });
    }
};

onValue(ref(db, getCompRef('locations')), (snapshot) => {
    const listUI = document.getElementById('locationListUI');
    const checkboxGroup = document.getElementById('locationCheckboxGroup');
    if (!listUI || !checkboxGroup) return;

    listUI.innerHTML = "";
    checkboxGroup.innerHTML = "";

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

        checkboxGroup.innerHTML += `
            <label class="flex items-center gap-2 cursor-pointer hover:bg-white p-1 rounded transition-colors">
                <input type="checkbox" name="locIds" value="${key}" class="w-3.5 h-3.5 accent-blue-600">
                <span class="text-[11px] font-bold text-slate-600 uppercase">${loc.name}</span>
            </label>`;
    });
});

window.deleteLocation = (key) => {
    if (confirm("Xóa địa điểm này?")) remove(ref(db, getCompRef('locations/' + key)));
};

// --- 2. CẤU HÌNH PHÒNG BAN ---
window.addDepartment = () => {
    const name = document.getElementById('newDeptName').value.trim();
    if (!name) return alert("Vui lòng nhập tên phòng!");
    push(ref(db, getCompRef('departments')), { name }).then(() => {
        document.getElementById('newDeptName').value = "";
    });
};

window.deleteDept = (key) => {
    if (confirm("Xóa phòng ban này?")) {
        remove(ref(db, getCompRef('departments/' + key)));
    }
};

onValue(ref(db, getCompRef('departments')), (snap) => {
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
    set(ref(db, getCompRef('settings/company')), { name }).then(() => alert("Cập nhật thành công!"));
};

get(ref(db, getCompRef('settings/company'))).then(snap => {
    if (snap.exists()) document.getElementById('cfgCompanyName').value = snap.val().name;
});

// --- 3. QUẢN LÝ NHÂN VIÊN ---
const generateNextID = async () => {
    const snapshot = await get(ref(db, getCompRef('users')));
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
        ["nvName", "nvEmail", "nvPhone", "nvAddress", "nvJoinDate", "nvPass", "nvSalary", "nvDevice", "nvDepartment"].forEach(el => {
            const input = document.getElementById(el);
            if (input) input.value = (el === "nvLeave") ? 12 : "";
        });
        if (document.getElementById('btnResetDevice')) document.getElementById('btnResetDevice').classList.add('hidden');
    }
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

window.editUser = async (id) => {
    isEditing = true;
    try {
        const snapshot = await get(ref(db, getCompRef('users/' + id)));
        if (snapshot.exists()) {
            const u = snapshot.val();
            
            // Cập nhật thông tin cơ bản
            document.getElementById('nvID').value = u.id;
            document.getElementById('nvName').value = u.name || "";
            if (document.getElementById('nvPhone')) document.getElementById('nvPhone').value = u.phone || "";
            if (document.getElementById('nvAddress')) document.getElementById('nvAddress').value = u.address || "";
            if (document.getElementById('nvJoinDate')) document.getElementById('nvJoinDate').value = u.joinDate || "";
            if (document.getElementById('nvEmail')) document.getElementById('nvEmail').value = u.email || "";
            if (document.getElementById('nvPass')) document.getElementById('nvPass').value = u.password || "";
            if (document.getElementById('nvRole')) document.getElementById('nvRole').value = u.role || "Staff";
            if (document.getElementById('nvDepartment')) document.getElementById('nvDepartment').value = u.department || "";
            if (document.getElementById('nvSalary')) document.getElementById('nvSalary').value = u.salary || 0;
            if (document.getElementById('nvLeave')) document.getElementById('nvLeave').value = u.leaveQuota || 12;
            
            // --- XỬ LÝ PHẦN THIẾT BỊ (DEVICE ID) ---
            const deviceField = document.getElementById('nvDevice');
            const btnReset = document.getElementById('btnResetDevice');
            
            if (deviceField) {
                // Kiểm tra cả 2 trường hợp viết hoa/thường để tránh sót dữ liệu
                const dId = u.deviceId || u.deviceID || ""; 
                deviceField.value = dId;

                if (btnReset) {
                    if (dId && dId.trim() !== "") {
                        btnReset.classList.remove('hidden'); // Có ID thì hiện nút reset
                    } else {
                        deviceField.value = "Chưa liên kết thiết bị";
                        btnReset.classList.add('hidden'); // Không có thì ẩn nút
                    }
                }
            }

            // Mở modal (id đúng trong HTML là employeeModal)
            window.toggleModal('employeeModal', true);
        }
    } catch (error) {
        console.error("Lỗi khi tải dữ liệu nhân viên:", error);
        alert("Không thể tải thông tin nhân viên này.");
    }
};

window.saveEmployee = () => {
    const id = document.getElementById('nvID')?.value;
    const name = document.getElementById('nvName')?.value;
    const email = document.getElementById('nvEmail')?.value;
    const phone = document.getElementById('nvPhone')?.value || "";
    const address = document.getElementById('nvAddress')?.value || "";
    const joinDate = document.getElementById('nvJoinDate')?.value || "";
    const pass = document.getElementById('nvPass')?.value;
    const role = document.getElementById('nvRole')?.value || "Staff";
    const dept = document.getElementById('nvDepartment')?.value || "Chưa phân loại";
    const salary = document.getElementById('nvSalary')?.value || 0;
    const leave = document.getElementById('nvLeave')?.value || 12;
    const device = document.getElementById('nvDevice')?.value || "";

    if(!id || !name || !email || !pass) return alert("Nhập đủ thông tin bắt buộc!");

    const userData = { id, name, email, phone, address, joinDate, password: pass, role, department: dept, salary: Number(salary), leaveQuota: Number(leave), deviceID: device, status: 'Active', updatedAt: new Date().toISOString() };
    set(ref(db, getCompRef('users/' + id)), userData).then(() => {
        window.toggleModal('employeeModal', false);
        alert("Lưu thành công!");
    });
};

window.deleteUser = (id) => {
    if(confirm(`Xóa nhân viên #${id}?`)) remove(ref(db, getCompRef('users/' + id)));
};

onValue(ref(db, getCompRef('users')), (snapshot) => {
    const userList = document.getElementById('userList');
    if (!userList) return;
    const users = [];
    snapshot.forEach(child => { users.push(child.val()); });
    const groups = users.reduce((acc, user) => {
        const d = user.department || "Chưa phân loại";
        if (!acc[d]) acc[d] = [];
        acc[d].push(user);
        return acc;
    }, {});
    let html = "";
    Object.entries(groups).forEach(([deptName, members]) => {
        html += `<div class="mb-10"><div class="flex items-center gap-3 mb-4 bg-slate-50 p-3 rounded-xl border-l-4 border-blue-500"><h4 class="font-black text-slate-700 uppercase tracking-wider text-xs">${deptName} (${members.length})</h4></div><div class="overflow-x-auto shadow-sm rounded-xl border border-slate-100"><table class="w-full text-left bg-white"><thead class="bg-slate-50/50 text-[10px] text-slate-400 uppercase"><tr><th class="p-4">Họ tên & ID</th><th class="p-4">Vai trò</th><th class="p-4">Lương/Ca</th><th class="p-4 text-right">Thao tác</th></tr></thead><tbody class="text-sm">${members.map(u => `<tr class="border-t border-slate-50 hover:bg-slate-50/30 transition-colors"><td class="p-4"><div class="flex flex-col"><b class="text-slate-800">${u.name}</b><span class="text-[10px] font-mono text-slate-400">#${u.id}</span></div></td><td class="p-4"><span class="px-2 py-1 rounded text-[10px] font-black uppercase ${u.role === 'Admin' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-600'}">${u.role}</span></td><td class="p-4 font-bold text-slate-600">${u.salary?.toLocaleString()}đ</td><td class="p-4 text-right"><button onclick="editUser('${u.id}')" class="w-8 h-8 rounded-lg text-blue-500 hover:bg-blue-50 transition"><i class="fas fa-edit"></i></button><button onclick="deleteUser('${u.id}')" class="w-8 h-8 rounded-lg text-rose-500 hover:bg-rose-50 transition"><i class="fas fa-trash-alt"></i></button></td></tr>`).join('')}</tbody></table></div></div>`;
    });
    userList.innerHTML = html || '<p class="p-10 text-center italic text-slate-400">Hệ thống chưa có nhân viên nào.</p>';
});

// --- 4. QUẢN LÝ CA LÀM VIỆC ---
window.editShift = async (code) => {
    isEditingShift = true;
    const snapshot = await get(ref(db, getCompRef('shifts/' + code)));
    if (snapshot.exists()) {
        const s = snapshot.val();
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
        const setChecked = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val || false; };
        setVal('shiftCode', s.code);
        if (document.getElementById('shiftCode')) document.getElementById('shiftCode').disabled = true;
        setVal('shiftName', s.name);
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
    if (!code) return alert("Nhập mã ca!");
    const selectedLocations = [];
    const checkboxes = document.querySelectorAll('input[name="locIds"]:checked');
    checkboxes.forEach((cb) => { selectedLocations.push(cb.value); });
    if (selectedLocations.length === 0) return alert("Chọn ít nhất một địa điểm!");

    const data = {
        code, name: document.getElementById('shiftName')?.value || "",
        checkCount: Number(document.getElementById('checkCount')?.value ?? 2),
        locationId: selectedLocations, 
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
        detectRange: { inStart: document.getElementById('detectInStart')?.value || "", inEnd: document.getElementById('detectInEnd')?.value || "", outStart: document.getElementById('detectOutStart')?.value || "", outEnd: document.getElementById('detectOutEnd')?.value || "" },
        workCount: Number(document.getElementById('workCount')?.value ?? 1),
        totalHours: Number(document.getElementById('totalHours')?.value ?? 8),
        otRates: { normal: Number(document.getElementById('otNormal')?.value ?? 1.5), weekend: Number(document.getElementById('otWeekend')?.value ?? 2.0), holiday: Number(document.getElementById('otHoliday')?.value ?? 3.0) }
    };

    set(ref(db, getCompRef('shifts/' + code)), data).then(() => {
        window.toggleModal('shiftModal', false);
        alert("Lưu thành công!");
    });
};

onValue(ref(db, getCompRef('shifts')), async (snapshot) => {
    const tableBody = document.getElementById('shiftTableBody');
    if (!tableBody) return;
    const locSnap = await get(ref(db, getCompRef('locations')));
    const locationsData = locSnap.val() || {};
    tableBody.innerHTML = '';
    if (!snapshot.exists()) {
        tableBody.innerHTML = '<tr><td colspan="7" class="p-10 text-center italic text-slate-400">Trống.</td></tr>';
        return;
    }
    snapshot.forEach(child => {
        const s = child.val();
        let locationDisplay = "---";
        if (s.locationId) {
            const locIds = Array.isArray(s.locationId) ? s.locationId : [s.locationId];
            locationDisplay = locIds.map(id => locationsData[id] ? locationsData[id].name : "N/A").join(", ");
        }
        tableBody.innerHTML += `<tr class="hover:bg-slate-50/50 border-b"><td class="p-4"><span class="px-3 py-1 rounded bg-slate-900 text-white text-[10px] font-black uppercase">${s.code}</span></td><td class="p-4"><b class="text-slate-800">${s.name}</b>${s.isOvernight ? '<br><small class="text-indigo-600 font-bold italic text-[9px]">CA ĐÊM</small>' : ''}</td><td class="p-4 font-bold text-blue-600 text-xs">${s.timeIn} — ${s.timeOut}</td><td class="p-4 text-center"><span class="px-2 py-1 bg-slate-100 rounded-md text-[10px] font-bold">${s.checkCount || 2} lần</span></td><td class="p-4 text-center font-black text-blue-600">${s.workCount || 1}</td><td class="p-4 text-center"><span class="text-[10px] font-bold text-slate-500 uppercase bg-slate-50 px-2 py-1 rounded border border-slate-100">${locationDisplay}</span></td><td class="p-4 text-right"><button onclick="editShift('${s.code}')" class="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 mr-2 hover:bg-blue-600 hover:text-white transition-all"><i class="fas fa-edit text-[10px]"></i></button><button onclick="deleteShift('${s.code}')" class="w-8 h-8 rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-600 hover:text-white transition-all"><i class="fas fa-trash-alt text-[10px]"></i></button></td></tr>`;
    });
});

window.deleteShift = (code) => { if (confirm(`Xóa ca: ${code}?`)) remove(ref(db, getCompRef('shifts/' + code))); };

// --- 5. NHẬT KÝ & BÁO CÁO ---
onValue(ref(db, getCompRef('attendancelogs')), (snapshot) => {
    const table = document.getElementById('attendanceTable');
    if (!table) return;
    table.innerHTML = "";
    const logs = [];
    snapshot.forEach(child => logs.push(child.val()));
    logs.reverse().forEach(d => {
        let statusClass = d.status === "Đi trễ" || d.status === "Về sớm" ? "text-rose-600 font-black" : (d.status === "Đúng giờ" ? "text-emerald-600 font-black" : "text-slate-500");
        table.innerHTML += `<tr class="border-b border-slate-50 hover:bg-slate-50/50"><td class="p-5"><div class="flex items-center gap-3"><div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold">${d.userName?.charAt(0)}</div><div><p class="font-black text-slate-800 text-xs">${d.userName}</p><p class="text-[10px] text-slate-400 font-mono">${d.userId}</p></div></div></td><td class="p-5"><div class="flex items-center gap-2"><span class="px-2 py-1 rounded-md bg-blue-50 text-blue-600 text-[10px] font-bold">${d.type}</span><p class="text-xs font-bold">${d.time}</p></div><p class="text-[9px] text-slate-400 mt-1">${d.date}</p></td><td class="p-5"><p class="font-bold text-slate-700 text-[10px] uppercase">${d.shiftName || 'Ngoài ca'}</p></td><td class="p-5"><span class="text-[10px] uppercase ${statusClass}">${d.status}</span></td><td class="p-5 text-right"><p class="font-bold text-xs">${d.distance ? d.distance + 'm' : 'N/A'}</p></td></tr>`;
    });
});

const parseDate = (dateStr) => {
    if (!dateStr) return new Date(0);
    const parts = dateStr.split('/');
    return new Date(parts[2], parts[1] - 1, parts[0]);
};

window.getAttendanceRangeReport = async () => {
    const fromDateVal = document.getElementById('reportDateFrom').value;
    const toDateVal = document.getElementById('reportDateTo').value;
    if (!fromDateVal || !toDateVal) return alert("Chọn đủ ngày!");
    
    const dFrom = new Date(fromDateVal); dFrom.setHours(0,0,0,0);
    const dTo = new Date(toDateVal); dTo.setHours(23,59,59,999);
    const reportTable = document.getElementById('table-report-attendance');
    
    reportTable.innerHTML = '<tr><td colspan="11" class="p-10 text-center text-blue-500 font-bold animate-pulse">ĐANG XỬ LÝ DỮ LIỆU...</td></tr>';
    
    try {
        const snapshot = await get(ref(db, getCompRef('attendancelogs')));
        if (!snapshot.exists()) { 
            reportTable.innerHTML = '<tr><td colspan="11" class="p-10 text-center italic">Không có dữ liệu nhật ký.</td></tr>'; 
            return; 
        }
        
        const allLogs = Object.values(snapshot.val());
        const grouped = {};

        // 1. Lọc và Nhóm dữ liệu
        allLogs.forEach(log => {
            if (!log.date || !log.userId) return;
            const logDateObj = parseDate(log.date);
            
            if (logDateObj >= dFrom && logDateObj <= dTo) {
                const key = `${log.date}_${log.userId}`;
                if (!grouped[key]) {
                    grouped[key] = { 
                        name: log.userName, id: log.userId, date: log.date, 
                        shift: log.shiftCode || "N/A", 
                        v1: "-", r1: "-", v2: "-", r2: "-", v3: "-", r3: "-", v4: "-", r4: "-" 
                    };
                }

                // Lấy tất cả log của nhân viên này trong ngày đó, sắp xếp theo thời gian
                const userDayLogs = allLogs
                    .filter(l => l.date === log.date && l.userId === log.userId)
                    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

                // Xác định log hiện tại là lượt thứ mấy (mỗi cặp Vào-Ra là 1 lượt)
                const currentIndex = userDayLogs.findIndex(l => l.timestamp === log.timestamp);
                const turn = Math.floor(currentIndex / 2) + 1; 

                const type = log.type.toUpperCase();
                const isCheckIn = type.includes("BẮT ĐẦU") || type.includes("VÀO");
                const isCheckOut = type.includes("KẾT THÚC") || type.includes("RA");

                if (isCheckIn && turn <= 4) grouped[key][`v${turn}`] = log.time;
                if (isCheckOut && turn <= 4) grouped[key][`r${turn}`] = log.time;
            }
        });

        // 2. Render ra giao diện
        let html = "";
        const sortedData = Object.values(grouped).sort((a, b) => parseDate(b.date) - parseDate(a.date));
        
        sortedData.forEach(data => {
            html += `
                <tr class="border-b hover:bg-slate-50 transition-all">
                    <td class="p-4"><b class="text-slate-800 text-xs">${data.name}</b><br><small class="text-slate-400 font-mono">ID: ${data.id}</small></td>
                    <td class="p-4 text-xs font-bold text-slate-500">${data.date}</td>
                    <td class="p-4 text-center text-emerald-600 font-black">${data.v1}</td>
                    <td class="p-4 text-center text-blue-600 font-black">${data.r1}</td>
                    <td class="p-4 text-center font-black">${data.v2}</td>
                    <td class="p-4 text-center font-black">${data.r2}</td>
                    <td class="p-4 text-center font-black">${data.v3}</td>
                    <td class="p-4 text-center font-black">${data.r3}</td>
                    <td class="p-4 text-center font-black">${data.v4}</td>
                    <td class="p-4 text-center font-black">${data.r4}</td>
                    <td class="p-4 text-right font-bold text-slate-400">${data.shift}</td>
                </tr>`;
        });
        
        reportTable.innerHTML = html || '<tr><td colspan="11" class="p-10 text-center italic">Không tìm thấy bản ghi nào trong khoảng thời gian này.</td></tr>';
    } catch (e) { 
        console.error(e);
        alert("Lỗi truy xuất: " + e.message); 
    }
};

window.calculateSummaryReport = async () => {
    const reportMonth = document.getElementById('reportMonthSummary').value;
    if (!reportMonth) return alert("Vui lòng chọn tháng!");
    
    const [yearSelect, monthSelect] = reportMonth.split('-').map(Number);
    const reportTable = document.getElementById('table-report-summary');
    
    reportTable.innerHTML = '<tr><td colspan="5" class="p-10 text-center font-bold text-blue-500 animate-pulse">ĐANG TỔNG HỢP BẢNG LƯƠNG...</td></tr>';

    try {
        const [logsSnap, usersSnap, shiftsSnap] = await Promise.all([
            get(ref(db, getCompRef('attendancelogs'))),
            get(ref(db, getCompRef('users'))),
            get(ref(db, getCompRef('shifts')))
        ]);

        const allLogs = logsSnap.exists() ? Object.values(logsSnap.val()) : [];
        const users = usersSnap.val() || {};
        const shifts = shiftsSnap.val() || {};
        let html = "";

        Object.entries(users).forEach(([id, user]) => {
            // 1. Lọc tất cả log của nhân viên trong tháng
            const userMonthLogs = allLogs.filter(log => {
                const parts = log.date.split('/');
                return log.userId === id && 
                       parseInt(parts[1]) === monthSelect && 
                       parseInt(parts[2]) === yearSelect;
            });

            let totalWorkDays = 0;
            let totalLateMins = 0;
            let totalEarlyMins = 0;
            let totalOTMins = 0;

            // Nhóm log theo ngày để tính công chuẩn (phải đủ cặp Vào/Ra)
            const logsByDate = userMonthLogs.reduce((acc, log) => {
                if (!acc[log.date]) acc[log.date] = [];
                acc[log.date].push(log);
                return acc;
            }, {});

            Object.keys(logsByDate).forEach(date => {
                const dayLogs = logsByDate[date];
                const shiftsInDay = [...new Set(dayLogs.map(l => l.shiftCode))];

                shiftsInDay.forEach(sCode => {
                    const s = shifts[sCode];
                    if (!s) return;

                    const shiftLogs = dayLogs.filter(l => l.shiftCode === sCode);
                    const hasStart = shiftLogs.some(l => l.type.includes("BẮT ĐẦU"));
                    const endLog = shiftLogs.find(l => l.type.includes("KẾT THÚC"));

                    if (hasStart && endLog) {
                        const actualOut = timeToMins(endLog.time);
                        const reqOut = timeToMins(s.timeOut);
                        const earlyGrace = Number(s.earlyGrace || 0);

                        // Chỉ tính công nếu không về quá sớm so với quy định
                        if (actualOut >= (reqOut - earlyGrace)) {
                            totalWorkDays += parseFloat(s.workCount || 0);
                        }

                        // Tính phút tăng ca (OT)
                        if (s.otAfterActive) {
                            const otBuffer = Number(s.otAfterMins || 0);
                            if (actualOut >= (reqOut + otBuffer)) {
                                totalOTMins += (actualOut - reqOut);
                            }
                        }

                        // Tính phút về sớm (nếu có)
                        if (actualOut < reqOut) {
                            const diff = reqOut - actualOut;
                            if (diff > earlyGrace) totalEarlyMins += diff;
                        }
                    }

                    // Tính phút đi trễ
                    const startLog = shiftLogs.find(l => l.type.includes("BẮT ĐẦU"));
                    if (startLog) {
                        const actualIn = timeToMins(startLog.time);
                        const reqIn = timeToMins(s.timeIn);
                        const lateGrace = Number(s.lateGrace || 0);
                        if (actualIn > (reqIn + lateGrace)) {
                            totalLateMins += (actualIn - reqIn);
                        }
                    }
                });
            });

            // 2. Tính toán lương tạm tính
            // Lương = (Tổng công * Lương ca) + (Lương OT nếu có) - (Trừ trễ/sớm nếu có)
            const baseSalary = totalWorkDays * (Number(user.salary) || 0);
            
            html += `
                <tr class="hover:bg-slate-50 border-b transition-all">
                    <td class="p-5">
                        <div class="flex flex-col">
                            <b class="text-slate-800 uppercase text-xs">${user.name}</b>
                            <span class="text-[10px] font-mono text-slate-400">ID: #${id}</span>
                        </div>
                    </td>
                    <td class="p-5 text-center">
                        <div class="flex flex-col gap-1">
                            <span class="text-xs font-black text-blue-600">${totalWorkDays.toFixed(1)} CÔNG</span>
                            <span class="text-[9px] font-bold text-orange-500 uppercase">+ ${totalOTMins} PHÚT OT</span>
                        </div>
                    </td>
                    <td class="p-5 text-center">
                        <div class="flex flex-col gap-1">
                            <span class="text-[10px] font-bold text-rose-500 uppercase">${totalLateMins} P.TRỄ</span>
                            <span class="text-[10px] font-bold text-rose-500 uppercase">${totalEarlyMins} P.SỚM</span>
                        </div>
                    </td>
                    <td class="p-5 text-center">
                        <span class="bg-slate-900 text-white px-3 py-1.5 rounded-xl text-[10px] font-black shadow-lg">
                            ${(totalWorkDays).toFixed(1)}
                        </span>
                    </td>
                    <td class="p-5 text-right">
                        <p class="text-emerald-600 font-black text-sm">${baseSalary.toLocaleString()}đ</p>
                        <p class="text-[8px] text-slate-300 font-bold uppercase italic">Chưa tính OT & Phạt</p>
                    </td>
                </tr>`;
        });
        reportTable.innerHTML = html || '<tr><td colspan="5" class="p-10 text-center italic">Không có dữ liệu nhân sự.</td></tr>';
    } catch (e) { 
        console.error(e);
        alert("Lỗi tổng hợp: " + e.message); 
    }
};

window.calculateOTReport = async () => {
    const reportMonth = document.getElementById('reportMonthOT').value;
    if (!reportMonth) return alert("Chọn tháng!");
    
    const [year, month] = reportMonth.split('-');
    const monthSelect = parseInt(month);
    const table = document.getElementById('table-report-ot');
    
    table.innerHTML = '<tr><td colspan="6" class="p-10 text-center font-bold text-blue-500 animate-pulse">ĐANG TÍNH TOÁN TĂNG CA...</td></tr>';

    try {
        const [logsSnap, shiftsSnap] = await Promise.all([
            get(ref(db, getCompRef('attendancelogs'))),
            get(ref(db, getCompRef('shifts')))
        ]);

        const allLogs = logsSnap.exists() ? Object.values(logsSnap.val()) : [];
        const shifts = shiftsSnap.val() || {};
        let html = "";

        allLogs.forEach(log => {
            if (!log.date || !log.time) return;
            const p = log.date.split('/');
            
            if (parseInt(p[1]) === monthSelect && p[2] === year) {
                const type = log.type.toUpperCase();
                if (type.includes("KẾT THÚC") || type.includes("RA")) {
                    
                    const s = shifts[log.shiftCode];
                    if (s && s.otAfterActive) {
                        const actualMins = timeToMins(log.time);
                        const requiredOutMins = timeToMins(s.timeOut);
                        const otBuffer = Number(s.otAfterMins || 0);

                        if (actualMins >= (requiredOutMins + otBuffer)) {
                            // Tính tổng số phút tăng ca
                            const totalOTMins = actualMins - requiredOutMins;

                            html += `
                                <tr class="border-b hover:bg-slate-50 transition-all">
                                    <td class="p-4">
                                        <b class="text-xs text-slate-800 uppercase">${log.userName}</b><br>
                                        <small class="text-slate-400 font-mono">#${log.userId}</small>
                                    </td>
                                    <td class="p-4 text-xs font-bold text-slate-500">${log.date}</td>
                                    <td class="p-4 text-center text-rose-600 font-black">${log.time}</td>
                                    <td class="p-4 text-center text-slate-400 text-[10px] font-bold uppercase">Sau ${s.timeOut}</td>
                                    <td class="p-4 text-center">
                                        <span class="bg-orange-500 text-white px-3 py-1 rounded-lg text-[10px] font-black shadow-sm">
                                            + ${totalOTMins} PHÚT
                                        </span>
                                    </td>
                                    <td class="p-4 text-right">
                                        <span class="text-[10px] font-black text-blue-600 uppercase italic">${s.name}</span>
                                    </td>
                                </tr>`;
                        }
                    }
                }
            }
        });

        table.innerHTML = html || '<tr><td colspan="6" class="p-10 text-center italic text-slate-400">Không có dữ liệu tăng ca.</td></tr>';
    } catch (e) { 
        console.error(e);
        alert("Lỗi: " + e.message); 
    }
};

window.calculateLateEarlyReport = async () => {
    const reportMonth = document.getElementById('reportMonthLate').value;
    if (!reportMonth) return alert("Vui lòng chọn tháng!");
    
    const [year, month] = reportMonth.split('-');
    const monthSelect = parseInt(month);
    const table = document.getElementById('table-report-late');
    
    // Hiển thị trạng thái chờ
    table.innerHTML = '<tr><td colspan="5" class="p-10 text-center font-bold text-rose-500 animate-pulse">ĐANG TRUY XUẤT DỮ LIỆU VI PHẠM...</td></tr>';

    try {
        const [logsSnap, shiftsSnap] = await Promise.all([
            get(ref(db, getCompRef('attendancelogs'))),
            get(ref(db, getCompRef('shifts')))
        ]);

        const allLogs = logsSnap.exists() ? Object.values(logsSnap.val()) : [];
        const shifts = shiftsSnap.val() || {};
        let html = "";

        allLogs.forEach(log => {
            if (!log.date || !log.time) return;
            const p = log.date.split('/');
            
            // Lọc theo tháng và năm đã chọn
            if (parseInt(p[1]) === monthSelect && p[2] === year) {
                const s = shifts[log.shiftCode];
                if (!s) return; // Bỏ qua nếu không tìm thấy cấu hình ca

                const type = log.type.toUpperCase();
                let diffMins = 0;
                let statusLabel = "";

                // 1. KIỂM TRA ĐI TRỄ (Chỉ xét các lượt Vào)
                if (type.includes("BẮT ĐẦU") || type.includes("VÀO")) {
                    const actualIn = timeToMins(log.time);
                    const requiredIn = timeToMins(s.timeIn);
                    const lateGrace = Number(s.lateGrace || 0);

                    if (actualIn > (requiredIn + lateGrace)) {
                        diffMins = actualIn - requiredIn;
                        statusLabel = "ĐI TRỄ";
                    }
                } 
                // 2. KIỂM TRA VỀ SỚM (Chỉ xét các lượt Ra)
                else if (type.includes("KẾT THÚC") || type.includes("RA")) {
                    const actualOut = timeToMins(log.time);
                    const requiredOut = timeToMins(s.timeOut);
                    const earlyGrace = Number(s.earlyGrace || 0);

                    if (actualOut < (requiredOut - earlyGrace)) {
                        diffMins = requiredOut - actualOut;
                        statusLabel = "VỀ SỚM";
                    }
                }

                // Nếu có vi phạm thì thêm vào bảng
                if (statusLabel) {
                    html += `
                        <tr class="border-b hover:bg-rose-50/30 transition-all">
                            <td class="p-4">
                                <b class="text-xs text-slate-800 uppercase">${log.userName}</b><br>
                                <small class="text-slate-400 font-mono">#${log.userId}</small>
                            </td>
                            <td class="p-4 text-xs font-bold text-slate-500">${log.date}</td>
                            <td class="p-4 text-center">
                                <span class="px-2 py-1 rounded-lg text-[10px] font-black uppercase ${statusLabel === 'ĐI TRỄ' ? 'bg-orange-100 text-orange-600' : 'bg-rose-100 text-rose-600'}">
                                    ${statusLabel}
                                </span>
                            </td>
                            <td class="p-4 text-center">
                                <b class="text-slate-700 text-sm">${diffMins}</b> 
                                <span class="text-[9px] text-slate-400 font-bold uppercase">Phút</span>
                            </td>
                            <td class="p-4 text-right">
                                <span class="text-[10px] font-black text-slate-500 uppercase italic">${s.name}</span><br>
                                <small class="text-[9px] text-slate-300 font-bold italic">Quy định: ${statusLabel === 'ĐI TRỄ' ? s.timeIn : s.timeOut}</small>
                            </td>
                        </tr>`;
                }
            }
        });

        table.innerHTML = html || '<tr><td colspan="5" class="p-10 text-center italic text-slate-400">Chúc mừng! Không có vi phạm trễ/sớm trong tháng này.</td></tr>';
    } catch (e) { 
        console.error(e);
        alert("Lỗi: " + e.message); 
    }
};

window.processLeave = async (key, status, userId, totalDays) => {
    if (confirm(`Xác nhận ${status === 'Approved' ? 'Duyệt' : 'Từ chối'} đơn này?`)) {
        await update(ref(db, getCompRef('leaveRequests/' + key)), { status });
        if (status === 'Approved') {
            const userSnap = await get(ref(db, getCompRef('users/' + userId)));
            if (userSnap.exists()) {
                const currentQuota = Number(userSnap.val().leaveQuota) || 0;
                await update(ref(db, getCompRef('users/' + userId)), { leaveQuota: currentQuota - totalDays });
            }
        }
        alert("Thao tác thành công!");
    }
};

window.resetDevice = async () => {
    const userId = document.getElementById('nvID').value;
    if (!userId) return;

    if (confirm(`Xác nhận mở khóa thiết bị cho nhân viên #${userId}?\nNhân viên có thể đăng nhập trên máy mới sau khi reset.`)) {
        try {
            // Sửa tại đây: Xóa cả 2 loại trường ID thiết bị để đồng bộ
            await update(ref(db, getCompRef('users/' + userId)), {
                deviceId: "",
                deviceID: "" 
            });

            // Cập nhật UI admin
            document.getElementById('nvDevice').value = "Đã giải phóng thiết bị";
            if (document.getElementById('btnResetDevice')) {
                document.getElementById('btnResetDevice').classList.add('hidden');
            }
            
            alert("Mở khóa thành công! Nhân viên có thể đăng nhập ngay.");
        } catch (e) {
            console.error(e);
            alert("Lỗi khi mở khóa: " + e.message);
        }
    }
};

// --- KHỞI TẠO DỮ LIỆU ---
const initAllReportMonths = () => {
    const now = new Date();
    const monthISO = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    ['reportMonthSummary', 'reportMonthOT', 'reportMonthLate'].forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = monthISO;
    });
};

document.addEventListener('DOMContentLoaded', () => {
    initAllReportMonths();
    const fromInput = document.getElementById('reportDateFrom');
    const toInput = document.getElementById('reportDateTo');
    if (fromInput && toInput) {
        fromInput.value = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        toInput.value = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];
    }
});
// --- LOGIC PHÂN CA NÂNG CAO (HÀNG LOẠT THEO PHÒNG BAN) ---

// 1. Render danh sách Nhân viên NHÓM THEO PHÒNG BAN (Có Accordion)
onValue(ref(db, getCompRef('users')), (snap) => {
    const listUI = document.getElementById('listUserAssign');
    if (!listUI) return;
    listUI.innerHTML = "";
    if (!snap.exists()) return;

    const users = Object.values(snap.val());
    
    // Nhóm nhân viên theo phòng ban
    const grouped = users.reduce((acc, u) => {
        const dept = u.department || "Chưa phân loại";
        if (!acc[dept]) acc[dept] = [];
        acc[dept].push(u);
        return acc;
    }, {});

    Object.entries(grouped).forEach(([deptName, members]) => {
        const deptId = `dept_${deptName.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        let deptHtml = `
            <div class="dept-group bg-white rounded-2xl border border-slate-100 overflow-hidden mb-3 shadow-sm transition-all" id="group_${deptId}">
                <div class="flex items-center p-3 cursor-pointer hover:bg-slate-50 transition-colors">
                    <input type="checkbox" id="check_${deptId}" class="dept-checkbox w-4 h-4 accent-blue-600 rounded mr-3" 
                        onclick="event.stopPropagation(); toggleDeptSelection('${deptId}', this.checked)">
                    
                    <div class="flex flex-1 items-center justify-between" onclick="toggleAccordion('${deptId}')">
                        <div class="flex flex-col">
                            <span class="text-[10px] font-black text-slate-600 uppercase tracking-tighter">${deptName}</span>
                            <span class="text-[8px] text-slate-400 font-bold">${members.length} nhân sự</span>
                        </div>
                        <i class="fas fa-chevron-down text-[10px] text-slate-300 chevron-icon" id="icon_${deptId}"></i>
                    </div>
                </div>

                <div id="${deptId}" class="dept-content bg-slate-50/30 overflow-hidden transition-all duration-300" style="max-height: 0px;">
                    <div class="p-2 space-y-1 border-t border-slate-50">
                        ${members.map(u => `
                            <label class="flex items-center gap-3 p-2 hover:bg-blue-50 rounded-xl cursor-pointer transition-all group relative">
                                <input type="checkbox" name="assignUserIds" value="${u.id}" 
                                    class="user-in-dept w-3.5 h-3.5 accent-blue-500"
                                    onchange="checkDeptStatus('${deptId}')">
                                <div class="flex flex-col">
                                    <span class="text-[11px] font-bold text-slate-700 uppercase group-hover:text-blue-700 transition-colors">${u.name}</span>
                                    <span class="text-[8px] text-slate-400 font-mono tracking-tighter">ID: #${u.id}</span>
                                </div>
                            </label>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        listUI.innerHTML += deptHtml;
    });
});

// --- CÁC HÀM TIỆN ÍCH LỰA CHỌN & HIỂN THỊ ---

// Hàm đóng/mở danh sách nhân viên
window.toggleAccordion = (deptId) => {
    const content = document.getElementById(deptId);
    const icon = document.getElementById(`icon_${deptId}`);
    if (content.style.maxHeight === "0px" || content.style.maxHeight === "") {
        content.style.maxHeight = "1000px"; // Mở rộng
        if(icon) icon.style.transform = "rotate(180deg)";
    } else {
        content.style.maxHeight = "0px"; // Thu gọn
        if(icon) icon.style.transform = "rotate(0deg)";
    }
};

// Khi tích vào phòng ban -> Tích tất cả và Tự động mở danh sách
window.toggleDeptSelection = (deptId, isChecked) => {
    const container = document.getElementById(deptId);
    if (!container) return;
    
    // Thực hiện chọn/bỏ chọn
    const checkboxes = container.querySelectorAll('input[name="assignUserIds"]');
    checkboxes.forEach(cb => cb.checked = isChecked);

    // Mở rộng nếu được chọn
    if (isChecked && container.style.maxHeight === "0px") {
        window.toggleAccordion(deptId);
    }
};

// Kiểm tra trạng thái phòng ban khi chọn lẻ nhân viên
window.checkDeptStatus = (deptId) => {
    const container = document.getElementById(deptId);
    const headCheckbox = document.getElementById(`check_${deptId}`);
    if (!container || !headCheckbox) return;

    const childCheckboxes = Array.from(container.querySelectorAll('input[name="assignUserIds"]'));
    const allChecked = childCheckboxes.every(cb => cb.checked);
    const anyChecked = childCheckboxes.some(cb => cb.checked);

    headCheckbox.checked = allChecked;
    headCheckbox.indeterminate = anyChecked && !allChecked;
};

// 2. Render danh sách Ca làm việc (Giữ nguyên)
onValue(ref(db, getCompRef('shifts')), (snap) => {
    const listUI = document.getElementById('listShiftAssign');
    if (!listUI) return;
    listUI.innerHTML = "";
    if (!snap.exists()) return;
    Object.values(snap.val()).forEach(s => {
        listUI.innerHTML += `
            <label class="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-xl cursor-pointer transition-all border border-transparent hover:border-slate-100">
                <input type="checkbox" name="assignShiftCodes" value="${s.code}" class="w-4 h-4 accent-emerald-600">
                <div class="flex flex-col">
                    <span class="text-[11px] font-black text-slate-700 uppercase">${s.name}</span>
                    <span class="text-[9px] text-emerald-500 font-bold">${s.timeIn} - ${s.timeOut}</span>
                </div>
            </label>`;
    });
});

// Nút chọn/bỏ chọn tất cả
window.selectAllUsers = (status) => {
    const checkboxes = document.querySelectorAll('input[name="assignUserIds"]');
    const deptCheckboxes = document.querySelectorAll('.dept-checkbox');
    checkboxes.forEach(cb => cb.checked = status);
    deptCheckboxes.forEach(cb => {
        cb.checked = status;
        cb.indeterminate = false;
    });
};

// Tìm kiếm nhanh
window.filterUserList = () => {
    const queryStr = document.getElementById('searchUserAssign').value.toLowerCase();
    const groups = document.querySelectorAll('.dept-group');
    groups.forEach(group => {
        const text = group.innerText.toLowerCase();
        group.style.display = text.includes(queryStr) ? "block" : "none";
        // Tự mở rộng nếu đang tìm kiếm
        if (queryStr.length > 0 && text.includes(queryStr)) {
            const content = group.querySelector('.dept-content');
            if (content) content.style.maxHeight = "1000px";
        }
    });
};

// --- HÀM THỰC THI LƯU LỊCH TRÌNH ---
window.saveBulkSchedule = async () => {
    const userIds = Array.from(document.querySelectorAll('input[name="assignUserIds"]:checked')).map(cb => cb.value);
    const shiftCodes = Array.from(document.querySelectorAll('input[name="assignShiftCodes"]:checked')).map(cb => cb.value);
    const fromDate = document.getElementById('schedFromDate').value;
    const toDate = document.getElementById('schedToDate').value;

    if (userIds.length === 0) return alert("Chưa chọn nhân viên!");
    if (shiftCodes.length === 0) return alert("Chưa chọn ca làm việc!");
    if (!fromDate || !toDate) return alert("Chưa chọn khoảng thời gian!");

    const start = new Date(fromDate);
    const end = new Date(toDate);
    if (start > end) return alert("Ngày bắt đầu không thể lớn hơn ngày kết thúc!");

    const btn = event.currentTarget;
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "ĐANG XỬ LÝ...";

    try {
        let currentDate = new Date(start);
        while (currentDate <= end) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const promises = userIds.map(uid => {
    return set(ref(db, getCompRef(`schedules/${dateStr}/${uid}`)), {
        shiftCodes: shiftCodes,
        endDateApplied: toDate, // Lưu thêm ngày kết thúc của đợt áp lịch này
        updatedAt: new Date().toISOString()
    });
            });
            await Promise.all(promises);
            currentDate.setDate(currentDate.getDate() + 1);
        }
        alert(`Đã áp lịch thành công cho ${userIds.length} NV.`);
        window.loadScheduleTable();
    } catch (e) {
        alert("Lỗi: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
};

// --- HIỂN THỊ DANH SÁCH (Giữ nguyên logic cũ của bạn) ---
window.loadScheduleTable = async () => {
    const vDate = document.getElementById('viewSchedDate').value;
    if (!vDate) return;
    const table = document.getElementById('scheduleListTable');
    table.innerHTML = "<tr><td colspan='4' class='p-10 text-center italic'>Đang tải...</td></tr>";

    try {
        const [schedSnap, uSnap, sSnap] = await Promise.all([
            get(ref(db, getCompRef(`schedules/${vDate}`))),
            get(ref(db, getCompRef('users'))),
            get(ref(db, getCompRef('shifts')))
        ]);

        if (!schedSnap.exists()) {
            table.innerHTML = `<tr><td colspan='4' class='p-10 text-center text-slate-400 italic'>Trống lịch ngày ${vDate}</td></tr>`;
            return;
        }

        const users = uSnap.val() || {};
        const shifts = sSnap.val() || {};
        let html = "";

        Object.entries(schedSnap.val()).forEach(([uid, data]) => {
            const u = users[uid];
            if (!u) return;

            // --- LOGIC HIỂN THỊ KHOẢNG NGÀY ---
            // Nếu có endDateApplied thì hiện khoảng, nếu không (dữ liệu cũ) thì hiện vDate
            const dateDisplay = data.endDateApplied && data.endDateApplied !== vDate 
                ? `${vDate} <i class="fas fa-long-arrow-alt-right mx-1 text-slate-300"></i> ${data.endDateApplied}`
                : vDate;

            const badges = (data.shiftCodes || []).map(code => 
                `<span class="bg-blue-50 text-blue-600 px-2 py-1 rounded text-[9px] font-black mr-1 border border-blue-100 uppercase">${shifts[code] ? shifts[code].name : code}</span>`
            ).join("");

            html += `
                <tr class="hover:bg-slate-50 border-b transition-all">
                    <td class="p-4">
                        <b class="text-slate-800 text-xs uppercase">${u.name}</b><br>
                        <small class="text-slate-400 font-mono">#${uid}</small>
                    </td>
                    <td class="p-4 text-[10px] font-bold text-slate-500 italic">
                        ${dateDisplay}
                    </td>
                    <td class="p-4">${badges}</td>
                    <td class="p-4 text-right">
                        <button onclick="deleteSingleSchedule('${vDate}', '${uid}')" class="text-rose-500 p-2 hover:bg-rose-50 rounded-lg transition-all">
                            <i class="fas fa-trash-alt text-xs"></i>
                        </button>
                    </td>
                </tr>`;
        });
        table.innerHTML = html;
    } catch (e) { 
        console.error(e); 
        table.innerHTML = "<tr><td colspan='4' class='p-10 text-center text-rose-500'>Lỗi tải dữ liệu</td></tr>";
    }
};
window.deleteSingleSchedule = (date, uid) => {
    if (confirm("Xóa lịch trình này?")) {
        remove(ref(db, getCompRef(`schedules/${date}/${uid}`))).then(() => window.loadScheduleTable());
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    ['viewSchedDate', 'schedFromDate', 'schedToDate'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = today;
    });
});

// --- LOGIC PHÊ DUYỆT NGHỈ PHÉP (BỔ SUNG) ---

window.loadLeaveApprovals = () => {
    const table = document.getElementById('leaveApprovalTable');
    if (!table) return;

    // Hiển thị trạng thái đang tải
    table.innerHTML = `<tr><td colspan="6" class="p-10 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest animate-pulse">Đang kết nối dữ liệu...</td></tr>`;

    const leaveRef = ref(db, getCompRef('leaveRequests'));
    
    onValue(leaveRef, (snap) => {
        if (!snap.exists()) {
            table.innerHTML = `<tr><td colspan="6" class="p-10 text-center text-slate-300 font-bold uppercase text-[10px] tracking-widest">Không có đơn nghỉ nào cần xử lý</td></tr>`;
            return;
        }

        let html = '';
        const data = snap.val();
        
        // Sắp xếp đơn mới nhất lên đầu
        Object.keys(data).reverse().forEach(key => {
            const l = data[key];
            const status = l.status || 'Pending';
            
            // Định dạng màu sắc trạng thái
            let statusColor = "bg-orange-100 text-orange-600"; // Chờ duyệt
            if (status === 'Approved') statusColor = "bg-emerald-100 text-emerald-600";
            if (status === 'Rejected') statusColor = "bg-rose-100 text-rose-600";

            html += `
                <tr class="border-b border-slate-50 hover:bg-slate-50 transition-all">
                    <td class="p-4">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-black text-[10px]">
                                ${l.userName ? l.userName.charAt(0).toUpperCase() : '?'}
                            </div>
                            <div>
                                <b class="text-xs text-slate-800 uppercase font-black">${l.userName}</b><br>
                                <small class="text-[9px] text-slate-400 font-mono italic">#${l.userId}</small>
                            </div>
                        </div>
                    </td>
                    <td class="p-4">
                        <div class="text-[10px] font-bold text-slate-600 leading-tight">
                            <span class="text-blue-500">Từ:</span> ${l.fromDate} (${l.startSession})<br>
                            <span class="text-rose-500">Đến:</span> ${l.toDate} (${l.endSession})
                        </div>
                    </td>
                    <td class="p-4 text-center font-black text-blue-600 text-sm">${l.totalDays}</td>
                    <td class="p-4 text-[10px] text-slate-500 font-medium max-w-[150px] italic">${l.reason || 'Không có lý do'}</td>
                    <td class="p-4 text-center">
                        <span class="px-2 py-1 rounded-md text-[8px] font-black uppercase ${statusColor}">${status === 'Pending' ? 'Chờ duyệt' : (status === 'Approved' ? 'Đã duyệt' : 'Từ chối')}</span>
                    </td>
                    <td class="p-4 text-right">
                        <div class="flex justify-end gap-1">
                            ${status === 'Pending' ? `
                                <button onclick="approveLeave('${key}', 'Approved')" class="w-7 h-7 bg-emerald-50 text-emerald-500 rounded-lg hover:bg-emerald-500 hover:text-white transition-all">
                                    <i class="fas fa-check text-[10px]"></i>
                                </button>
                                <button onclick="approveLeave('${key}', 'Rejected')" class="w-7 h-7 bg-rose-50 text-rose-500 rounded-lg hover:bg-rose-500 hover:text-white transition-all">
                                    <i class="fas fa-times text-[10px]"></i>
                                </button>
                            ` : `
                                <button onclick="deleteLeaveRequest('${key}')" class="w-7 h-7 bg-slate-50 text-slate-400 rounded-lg hover:bg-rose-500 hover:text-white transition-all">
                                    <i class="fas fa-trash-alt text-[10px]"></i>
                                </button>
                            `}
                        </div>
                    </td>
                </tr>`;
        });
        table.innerHTML = html;
    });
};

window.approveLeave = async (key, newStatus) => {
    if (!confirm(`Xác nhận ${newStatus === 'Approved' ? 'DUYỆT' : 'TỪ CHỐI'} đơn này?`)) return;

    try {
        const leaveRef = ref(db, getCompRef(`leaveRequests/${key}`));
        const leaveSnap = await get(leaveRef);
        if (!leaveSnap.exists()) return alert("Đơn nghỉ không tồn tại!");
        
        const leaveData = leaveSnap.val();
        const userId = leaveData.userId;
        const totalDays = parseFloat(leaveData.totalDays || 0);

        // 1. Lấy thông tin User để lấy fcmToken thông báo
        const userRef = ref(db, getCompRef(`users/${userId}`));
        const userSnap = await get(userRef);

        if (newStatus === 'Approved' && userSnap.exists()) {
            const currentQuota = parseFloat(userSnap.val().leaveQuota || 0);
            await update(userRef, { leaveQuota: currentQuota - totalDays });
        }

        // 2. Cập nhật trạng thái đơn
        await update(leaveRef, { status: newStatus });
        
        // 3. GỬI THÔNG BÁO ĐẾN ĐIỆN THOẠI NHÂN VIÊN
        if (userSnap.exists() && userSnap.val().fcmToken) {
            const statusVN = newStatus === 'Approved' ? "ĐÃ ĐƯỢC DUYỆT" : "BỊ TỪ CHỐI";
            sendPushNotification(
                userSnap.val().fcmToken, 
                "Cập nhật đơn nghỉ phép", 
                `Đơn nghỉ ngày ${leaveData.fromDate} của bạn ${statusVN}.`
            );
        }
        
        alert("Thành công: Đã cập nhật trạng thái đơn!");
    } catch (e) {
        console.error("Lỗi:", e);
        alert("Lỗi hệ thống: " + e.message);
    }
};

// Hàm gửi Push thông qua Firebase Cloud Messaging API
async function sendPushNotification(token, title, body) {
    const SERVER_KEY = "SVrn01VsilAdVo1yKZG7ZNxgFH53tOz0XpgagILmXEc"; // Lấy trong Project Settings > Cloud Messaging
    
    const message = {
        notification: { title, body },
        to: token
    };

    try {
        await fetch("https://fcm.googleapis.com/fcm/send", {
            method: "POST",
            headers: {
                "Authorization": "key=" + SERVER_KEY,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(message)
        });
        console.log("✅ Đã gửi thông báo đến nhân viên");
    } catch (err) {
        console.error("❌ Lỗi gửi thông báo:", err);
    }
}

window.deleteLeaveRequest = async (key) => {
    if (confirm("Xóa vĩnh viễn đơn nghỉ này?")) {
        await remove(ref(db, getCompRef(`leaveRequests/${key}`)));
    }
};

// A. LƯU CẤU HÌNH LƯƠNG
window.saveSalarySettings = async () => {
    const config = {
        otRate: parseFloat(document.getElementById('cfg_ot_rate').value) || 1.5,
        insuranceRate: parseFloat(document.getElementById('cfg_insurance_rate').value) || 10.5,
        taxFree: parseInt(document.getElementById('cfg_tax_free').value) || 11000000,
        standardHours: parseInt(document.getElementById('cfg_standard_hours').value) || 8
    };
    await set(ref(db, getCompRef('salary_configs')), config);
    alert("Đã cập nhật tham số lương hệ thống!");
};

// B. LẤY CẤU HÌNH LƯƠNG
async function getSalaryConfigs() {
    const snap = await get(ref(db, getCompRef('salary_configs')));
    return snap.exists() ? snap.val() : { otRate: 1.5, insuranceRate: 10.5, taxFree: 11000000, standardHours: 8 };
}

// C. TÍNH LƯƠNG CHI TIẾT
window.calculateDetailedSalary = async () => {
    const monthVal = document.getElementById('salaryMonth').value;
    if (!monthVal) return alert("Chọn tháng!");
    const [year, month] = monthVal.split('-').map(Number);
    const tableBody = document.getElementById('table-salary-body');
    const cfg = await getSalaryConfigs();

    tableBody.innerHTML = '<tr><td colspan="6" class="p-10 text-center font-bold text-blue-500 animate-pulse">ĐANG KẾT XUẤT...</td></tr>';

    const [logsSnap, usersSnap, shiftsSnap] = await Promise.all([
        get(ref(db, getCompRef('attendancelogs'))),
        get(ref(db, getCompRef('users'))),
        get(ref(db, getCompRef('shifts')))
    ]);

    const allLogs = logsSnap.exists() ? Object.values(logsSnap.val()) : [];
    const users = usersSnap.val() || {};
    const shifts = shiftsSnap.val() || {};
    let html = "";

    Object.entries(users).forEach(([id, user]) => {
        // Tận dụng lại logic tính toán từ "Báo cáo tổng hợp" của bạn
        // (Tính totalWorkDays, totalOTMins, totalLateMins, totalEarlyMins tại đây)
        
        const ratePerDay = Number(user.salary || 0);
        const ratePerMin = ratePerDay / cfg.standardHours / 60;
        
        const moneyBase = totalWorkDays * ratePerDay;
        const moneyOT = totalOTMins * ratePerMin * cfg.otRate;
        const moneyFine = (totalLateMins + totalEarlyMins) * ratePerMin;
        const insurance = moneyBase * (cfg.insuranceRate / 100);
        
        const netSalary = moneyBase + moneyOT - moneyFine - insurance;

        html += `
            <tr class="border-b hover:bg-slate-50 transition-all">
                <td class="p-4">
                    <b class="text-xs text-slate-800 uppercase">${user.name}</b><br>
                    <small class="text-slate-400 font-mono">Lương/Ca: ${ratePerDay.toLocaleString()}đ</small>
                </td>
                <td class="p-4 text-center">
                    <span class="text-blue-600 font-black">${totalWorkDays.toFixed(1)} Công</span><br>
                    <span class="text-[9px] font-bold text-orange-500">+${moneyOT.toLocaleString()}đ OT</span>
                </td>
                <td class="p-4 text-center font-bold text-rose-500">-${moneyFine.toLocaleString()}đ</td>
                <td class="p-4 text-center"><input type="number" value="0" class="w-20 p-1 border rounded text-center font-bold text-emerald-600 shadow-sm"></td>
                <td class="p-4 text-center text-rose-600 font-bold text-[10px]">BH: ${insurance.toLocaleString()}đ</td>
                <td class="p-4 text-right"><b class="text-emerald-600 text-sm font-black">${Math.round(netSalary).toLocaleString()}đ</b></td>
            </tr>`;
    });
    tableBody.innerHTML = html;
};

// HÀM TỔNG HỢP DASHBOARD THÔNG MINH
window.updateRealtimeDashboard = async () => {
    const today = new Date().toLocaleDateString('vi-VN'); // Lấy ngày hôm nay định dạng d/m/yyyy
    
    try {
        const [uSnap, lSnap, sSnap] = await Promise.all([
            get(ref(db, getCompRef('users'))),
            get(ref(db, getCompRef('attendancelogs'))),
            get(ref(db, getCompRef('shifts')))
        ]);

        const users = uSnap.val() || {};
        const logs = lSnap.exists() ? Object.values(lSnap.val()) : [];
        const shifts = sSnap.val() || {};
        
        // Lọc log hôm nay
        const todayLogs = logs.filter(l => l.date === today);
        
        let stats = { total: Object.keys(users).length, present: 0, late: 0, early: 0 };
        let hourlyData = new Array(24).fill(0);
        let realtimeHTML = "";

        Object.entries(users).forEach(([id, user]) => {
            const userLogs = todayLogs.filter(l => l.userId === id).sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
            const hasIn = userLogs.some(l => l.type.includes("BẮT ĐẦU"));
            const hasOut = userLogs.some(l => l.type.includes("KẾT THÚC"));

            if (hasIn) {
                stats.present++;
                const firstIn = userLogs.find(l => l.type.includes("BẮT ĐẦU"));
                const s = shifts[firstIn.shiftCode];
                if (s && timeToMins(firstIn.time) > (timeToMins(s.timeIn) + (s.lateGrace || 0))) stats.late++;
                
                // Lưu dữ liệu biểu đồ
                const h = parseInt(firstIn.time.split(':')[0]);
                if (h < 24) hourlyData[h]++;
            }

            if (hasOut) {
                const lastOut = [...userLogs].reverse().find(l => l.type.includes("KẾT THÚC"));
                const s = shifts[lastOut.shiftCode];
                if (s && timeToMins(lastOut.time) < (timeToMins(s.timeOut) - (s.earlyGrace || 0))) stats.early++;
            }

            // Giao diện Realtime List
            let statusBadge = hasOut ? 
                '<span class="px-2 py-1 bg-slate-100 text-slate-400 text-[8px] font-black rounded-lg">ĐÃ VỀ</span>' : 
                (hasIn ? '<span class="px-2 py-1 bg-emerald-100 text-emerald-600 text-[8px] font-black rounded-lg animate-pulse">ĐANG LÀM</span>' : 
                '<span class="px-2 py-1 bg-rose-50 text-rose-400 text-[8px] font-black rounded-lg">CHƯA VÀO</span>');

            realtimeHTML += `
                <div class="flex items-center justify-between p-3 bg-white border border-slate-50 rounded-2xl shadow-sm">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center font-black text-xs text-slate-400 border border-slate-100">${user.name.charAt(0)}</div>
                        <div>
                            <p class="text-[11px] font-black text-slate-700 uppercase">${user.name}</p>
                            <p class="text-[9px] text-slate-400 font-bold">${hasIn ? 'Vào: ' + userLogs.find(l => l.type.includes("BẮT ĐẦU")).time : 'Chưa có log'}</p>
                        </div>
                    </div>
                    ${statusBadge}
                </div>`;
        });

        // Đổ dữ liệu lên UI
        document.getElementById('db-total-staff').innerText = stats.total;
        document.getElementById('db-present').innerText = stats.present;
        document.getElementById('db-absent').innerText = stats.total - stats.present;
        document.getElementById('db-late').innerText = stats.late;
        document.getElementById('db-early').innerText = stats.early;
        document.getElementById('db-ontime-rate').innerText = stats.present > 0 ? Math.round(((stats.present - stats.late)/stats.present)*100) + "%" : "0%";
        document.getElementById('db-realtime-list').innerHTML = realtimeHTML;
        document.getElementById('db-last-update').innerText = "Cập nhật: " + new Date().toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});

        // Vẽ biểu đồ
        const maxLogs = Math.max(...hourlyData) || 1;
        document.getElementById('checkin-chart-container').innerHTML = hourlyData.slice(6, 21).map((count, i) => `
            <div class="flex-1 flex flex-col items-center group relative h-full justify-end">
                ${count > 0 ? `<span class="absolute -top-6 text-[9px] font-black text-blue-500 opacity-0 group-hover:opacity-100 transition-all">${count}</span>` : ''}
                <div class="w-full max-w-[12px] bg-slate-100 group-hover:bg-blue-500 rounded-t-full transition-all" style="height: ${(count/maxLogs)*100}%"></div>
            </div>
        `).join('');

    } catch (e) { console.error("Dashboard Error:", e); }
};

// Gọi Dashboard ngay khi mở tab Nhật ký Realtime
onValue(ref(db, getCompRef('attendancelogs')), () => {
    if (document.getElementById('dashboard').classList.contains('active-content')) {
        window.updateRealtimeDashboard();
    }
});