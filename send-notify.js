const admin = require("firebase-admin"); // THÊM DÒNG NÀY: Khai báo thư viện
const path = require('path');

// Sử dụng đường dẫn tuyệt đối để đảm bảo Node.js tìm thấy file JSON
const serviceAccount = require(path.join(__dirname, 'service-account.json'));

// Khởi tạo Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

/**
 * Hàm gửi thông báo đẩy qua FCM API V1
 * @param {string} token - FCM Token của nhân viên nhận
 * @param {string} title - Tiêu đề thông báo
 * @param {string} body - Nội dung thông báo
 */
async function sendNotification(token, title, body) {
  const message = {
    notification: {
      title: title,
      body: body
    },
    token: token,
    webpush: {
      notification: {
        icon: "https://cameradalat.com/wp-content/uploads/2026/04/ht-cham-cong-logo-app.png",
        badge: "https://cameradalat.com/wp-content/uploads/2026/04/ht-cham-cong-logo-app.png",
        click_action: "https://chamconght-3df64.web.app"
      }
    }
  };

  try {
    const response = await admin.messaging().send(message);
    console.log("✅ Thông báo đã gửi thành công:", response);
    return { success: true, response };
  } catch (error) {
    console.error("❌ Lỗi gửi thông báo:", error);
    return { success: false, error };
  }
}

// --- PHẦN CHẠY THỬ (TEST) ---
// Bạn hãy dán Token lấy từ Firebase Database của bạn vào đây để test
const TEST_TOKEN = "SVrn01VsilAdVo1yKZG7ZNxgFH53tOz0XpgagILmXEc";

if (TEST_TOKEN !== "SVrn01VsilAdVo1yKZG7ZNxgFH53tOz0XpgagILmXEc") {
    sendNotification(TEST_TOKEN, "HT Attendance", "Đơn nghỉ phép của bạn đã được duyệt!")
    .then(() => console.log("Thử nghiệm hoàn tất."))
    .catch(err => console.error(err));
} else {
    console.log("⚠️ Vui lòng dán Token thực tế vào biến TEST_TOKEN để chạy thử.");
}

// Xuất hàm để sử dụng ở file khác
module.exports = { sendNotification };