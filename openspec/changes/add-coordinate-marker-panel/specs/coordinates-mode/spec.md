## ADDED Requirements

### Requirement: Coordinate Mode Surface Probe Panel
Khi người dùng ở `mode tọa độ` và chọn một điểm bất kỳ trên bề mặt Trái Đất, hệ thống MUST hiển thị một bảng thông tin cố định chứa toạ độ của điểm đó.

#### Scenario: Chọn một điểm bất kỳ trong mode tọa độ
- **GIVEN** người dùng đang ở `mode tọa độ`
- **WHEN** người dùng chọn một điểm trên bề mặt Trái Đất
- **THEN** hệ thống hiển thị bảng thông tin bên phải
- **AND** hệ thống hiển thị một mốc đánh dấu tại đúng điểm đã chọn trên quả địa cầu
- **AND** bảng đó hiển thị vĩ độ và kinh độ của điểm đã chọn

#### Scenario: Chưa chọn điểm nào
- **GIVEN** người dùng đang ở `mode tọa độ`
- **WHEN** chưa có điểm nào được chọn
- **THEN** bảng thông tin hiển thị hướng dẫn chọn một điểm để xem toạ độ

#### Scenario: Bấm ra ngoài quả địa cầu trong mode tọa độ
- **GIVEN** người dùng đang ở `mode tọa độ`
- **WHEN** người dùng bấm ra ngoài quả địa cầu
- **THEN** bảng thông tin không giữ dữ liệu điểm cũ
- **AND** mốc đánh dấu trước đó trên quả địa cầu được ẩn đi
- **AND** bảng thông tin hiển thị hướng dẫn chọn lại một điểm trên bề mặt

#### Scenario: Rời khỏi mode tọa độ
- **GIVEN** người dùng đã chọn một điểm trong `mode tọa độ`
- **WHEN** người dùng chuyển sang mode khác
- **THEN** bảng thông tin tọa độ được ẩn đi
- **AND** popup địa danh thông thường tiếp tục hoạt động theo hành vi cũ ở mode marker
