# Đề xuất thay đổi: add-coordinate-marker-panel

## Tóm tắt
Thêm bảng thông tin cố định cho `mode tọa độ` để khi người dùng chọn một điểm bất kỳ trên bề mặt Trái Đất, giao diện hiển thị kinh độ và vĩ độ của điểm đó theo cách trình bày tương tự các panel ở mode `nhiệt độ` và `mưa`.

## Vấn đề
Hiện tại `mode tọa độ` chỉ bật lưới kinh vĩ tuyến nhưng chưa có bảng thông tin tập trung để đọc nhanh tọa độ của điểm bất kỳ mà người dùng vừa chọn trên địa cầu.

## Giải pháp
- Thêm `coordinate-panel` trong overlay bên phải, dùng ngôn ngữ hiển thị và layout đồng bộ với `climate-panel`.
- Raycast trực tiếp lên `earth mesh` để lấy điểm giao và chuyển đổi sang `lat/lon`.
- Hiển thị một probe marker ngay trên quả địa cầu tại điểm user vừa chọn, theo cùng ngôn ngữ hình ảnh với probe của climate mode.
- Giữ nguyên `location-popup` cho mode thường; `mode tọa độ` không phụ thuộc vào marker địa danh.

## Ngoài phạm vi
- Không thay đổi dữ liệu marker nguồn.
- Không thay đổi hành vi VR panel của marker.
- Không thay đổi logic mode `nhiệt độ`, `mưa` hay `mùa vụ`.
