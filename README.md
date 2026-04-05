# GK_VR - VR Earth Simulation

## Tổng quan

`GK_VR` là dự án mô phỏng Trái Đất 3D chạy trên trình duyệt, được xây dựng bằng `Three.js` và `Vite`, có hỗ trợ `WebXR` để chuyển sang chế độ VR. Ứng dụng tập trung vào việc hiển thị Trái Đất trong không gian 3D với chu kỳ ngày/đêm, ánh sáng Mặt Trời, Mặt Trăng, bầu khí quyển, mây, vệ tinh và các điểm địa danh có thể tương tác.

Đây là một dự án phù hợp để trình bày đồ án VR giữa kỳ, demo kỹ thuật đồ họa 3D trên web, hoặc làm nền tảng để mở rộng thành trải nghiệm quan sát Trái Đất chi tiết hơn.

## Tính năng chính

- Hiển thị Trái Đất bằng shader tùy biến với hiệu ứng chuyển tiếp ngày/đêm.
- Tăng tốc thời gian mô phỏng để quan sát sự thay đổi vị trí Mặt Trời, Mặt Trăng và góc quay Trái Đất.
- Hỗ trợ 3 preset ánh sáng Mặt Trời: `Realistic`, `Hybrid`, `Cinematic`.
- Bật/tắt lớp mây và khí quyển trong thời gian thực.
- Chế độ theo dõi ISS/vệ tinh.
- Hệ thống marker địa danh nổi bật trên bề mặt Trái Đất.
- Popup hiển thị thông tin địa danh và thư viện ảnh minh họa.
- Hỗ trợ chế độ VR qua `WebXR`, có raycast/controller interaction và bảng điều khiển nổi trong không gian VR.
- Có âm thanh nền và nút bật/tắt âm thanh trong giao diện.

## Công nghệ sử dụng

- `JavaScript ES Modules`
- `Three.js`
- `Vite`
- `WebXR`

## Cấu trúc dự án

```text
GK_VR/
|-- index.html
|-- package.json
|-- vite.config.js
|-- scripts/
|   `-- run-vite.cjs
|-- public/
|   |-- textures/
|   `-- NewTextures/
|-- sound/
|-- src/
|   |-- main.js
|   |-- SceneManager.js
|   |-- UI.js
|   |-- Interaction.js
|   |-- Controls.js
|   |-- WebXRSetup.js
|   |-- CelestialCalculator.js
|   |-- Earth.js
|   |-- EarthShader.js
|   |-- Clouds.js
|   |-- Atmosphere.js
|   |-- Starfield.js
|   |-- Sun.js
|   |-- SunShader.js
|   |-- SunPresets.js
|   |-- Moon.js
|   |-- Satellite.js
|   |-- Markers.js
|   |-- AudioManager.js
|   `-- AdaptiveTexture.js
|-- plans/
`-- dist/
```

## Kiến trúc chính

### Entry point

- `index.html`: shell HTML, overlay UI, canvas render và điểm gắn nút `Enter VR`.
- `src/main.js`: khởi tạo ứng dụng.
- `src/SceneManager.js`: trung tâm điều phối scene, renderer, camera, vòng lặp render và kết nối các module khác.

### Các module nổi bật

- `src/Earth.js`: dựng mesh Trái Đất, nạp texture thích ứng và gắn shader.
- `src/EarthShader.js`: xử lý màu ngày/đêm, tăng chi tiết bề mặt và các uniform liên quan.
- `src/CelestialCalculator.js`: tính toán thời gian thiên văn, vị trí Mặt Trời, Mặt Trăng và góc quay Trái Đất.
- `src/Clouds.js`, `src/Atmosphere.js`, `src/Starfield.js`: lớp mây, khí quyển và nền sao.
- `src/Sun.js`, `src/SunShader.js`, `src/SunPresets.js`: hiển thị Mặt Trời và các preset ánh sáng.
- `src/Moon.js`: dựng Mặt Trăng và phản ứng với hệ chiếu sáng.
- `src/Satellite.js`: mô phỏng vệ tinh quay quanh Trái Đất.
- `src/Markers.js`: quản lý marker địa danh và dữ liệu hiển thị.
- `src/UI.js`: binding các phần tử DOM, slider, toggle, popup và trạng thái UI.
- `src/Interaction.js`: xử lý raycast desktop/VR, chọn marker, tương tác controller và panel VR.
- `src/Controls.js`: điều khiển camera kiểu orbit và chế độ tracking.
- `src/WebXRSetup.js`: bật `renderer.xr`, tạo nút `Enter VR`, quản lý vòng đời phiên VR.
- `src/AudioManager.js`: phát âm thanh nền và trạng thái mute/unmute.

## Yêu cầu môi trường

- `Node.js` khuyến nghị: `20.19+` hoặc `22.12+`
- `npm`
- Trình duyệt hiện đại hỗ trợ `WebGL`
- Nếu dùng VR: thiết bị và trình duyệt hỗ trợ `WebXR`

Lưu ý:

- Repo hiện không dùng file `.env` ở cấp ứng dụng.
- Các lệnh dev/build/preview nên chạy qua `npm scripts`, không gọi trực tiếp `node scripts/run-vite.cjs` vì file này phụ thuộc vào biến môi trường lifecycle do `npm` cung cấp.

## Cài đặt

```bash
npm install
```

## Chạy ở môi trường phát triển

```bash
npm run dev
```

Sau khi chạy, Vite sẽ mở server phát triển. Cấu hình hiện tại trong `vite.config.js` cho phép:

- `host: true`
- `https: false`
- `base: /`

## Build production

```bash
npm run build
```

Kết quả build được xuất ra thư mục `dist/`.

## Preview bản build

```bash
npm run preview
```

## Điều khiển trên desktop

### Camera và quan sát

- Giữ chuột trái và kéo để xoay góc nhìn quanh Trái Đất.
- Dùng con lăn chuột để zoom.

### Bảng điều khiển

Giao diện hiện tại có các thành phần chính:

- Slider `Tốc độ quay`: thay đổi tốc độ thời gian mô phỏng.
- Slider `Độ sáng mặt trời`: thay đổi cường độ ánh sáng Mặt Trời.
- Preset `Realistic`, `Hybrid`, `Cinematic`: chuyển cấu hình hiển thị/ánh sáng của Mặt Trời.
- `ISS View`: bật/tắt chế độ theo dõi vệ tinh.
- `Âm thanh`: bật/tắt nhạc nền.
- `Hiện địa danh`: bật/tắt marker địa danh.
- `Tắt mây`: bật/tắt lớp mây.
- `Tắt khí quyển`: bật/tắt hiệu ứng khí quyển.
- `Ẩn bảng điều khiển`: thu gọn panel điều khiển.

### Tương tác địa danh

- Khi marker được bật, người dùng có thể bấm vào địa danh để mở popup thông tin.
- Popup hiển thị tên địa danh, mô tả ngắn và bộ ảnh minh họa.

## Điều khiển trong VR

Ứng dụng có hỗ trợ `WebXR` thông qua `VRButton` của `Three.js`.

### Cách vào VR

- Mở ứng dụng trên trình duyệt/thiết bị hỗ trợ `WebXR`.
- Nhấn nút `Enter VR`.

### Tương tác trong VR

- Controller phải được dùng để raycast và chọn đối tượng.
- Nút `A` thực hiện thao tác click/chọn trong không gian VR.
- Nút `B` dùng để hiện/ẩn bảng điều khiển nổi.
- Thumbstick bên phải hỗ trợ quay góc nhìn và zoom, có dead-zone để giảm thao tác nhầm.

Lưu ý:

- Không phải mọi trình duyệt desktop đều hỗ trợ `WebXR`.
- Trải nghiệm VR phụ thuộc vào thiết bị, headset và browser tương thích.

## Tài nguyên và dữ liệu

### Texture và asset hình ảnh

- Texture chính được đặt trong:
  - `public/textures/`
  - `public/NewTextures/`
- Một số asset đáng chú ý:
  - texture ngày/đêm của Trái Đất
  - texture Mặt Trăng
  - texture Mặt Trời
  - texture nền sao hoặc texture phụ trợ

### Âm thanh

- Âm thanh nền được lưu trong thư mục `sound/`.

### Dữ liệu ảnh địa danh

- Ảnh popup địa danh hiện được lấy từ nguồn remote.
- Khi có kết nối mạng, trải nghiệm popup ảnh sẽ đầy đủ hơn.
- Nếu nguồn ảnh từ xa không phản hồi, ứng dụng đã có cơ chế fallback hiển thị thay thế ở mức giao diện.

## Triển khai

Repo đã được liên kết với `Vercel` thông qua thư mục `.vercel/`, vì vậy có thể triển khai nhanh nếu môi trường đã cấu hình CLI phù hợp.

Lệnh triển khai production thường dùng:

```bash
npx vercel --prod --yes
```

Phần này là tùy chọn. Nếu chỉ cần chạy local để demo hoặc chấm bài, bạn không cần cấu hình thêm biến môi trường vì dự án hiện không sử dụng `.env` cấp ứng dụng.
link demo local: http://localhost:5173
link production: https://gk-vr-anroiy123.vercel.app

## Chất lượng mã nguồn hiện tại

- Có script cho `dev`, `build`, `preview`.
- Chưa thấy script test tự động trong `package.json`.
- Chưa thấy script lint/format trong `package.json`.
- Thư mục `plans/` chứa tài liệu nghiên cứu/kế hoạch phát triển, hữu ích cho người muốn tiếp tục mở rộng dự án.

## Giới hạn hiện tại

- Trải nghiệm VR phụ thuộc mạnh vào mức hỗ trợ `WebXR` của thiết bị và trình duyệt.
- Ảnh minh họa địa danh phụ thuộc vào nguồn tải từ xa, nên trải nghiệm có thể khác nhau theo mạng.
- Chưa có bộ test tự động hoặc lint script tích hợp sẵn.
- Dự án hiện ưu tiên mô phỏng trực quan và tương tác demo hơn là độ chính xác thiên văn ở mức học thuật sâu.

## Hướng phát triển đề xuất

- Bổ sung ảnh địa danh cục bộ để giảm phụ thuộc mạng.
- Thêm `eslint` và quy trình kiểm tra chất lượng mã nguồn.
- Viết test cho các module tính toán như `CelestialCalculator`.
- Thêm chế độ hiển thị thông tin học thuật sâu hơn cho từng địa danh hoặc từng thiên thể.
- Tối ưu asset và texture cho thiết bị VR/mobile cấu hình thấp.

## Cách dùng nhanh

```bash
npm install
npm run dev
```

Sau đó:

1. Mở ứng dụng trên trình duyệt.
2. Dùng chuột để xoay và zoom quanh Trái Đất.
3. Bật marker để xem các địa danh.
4. Thử các preset Mặt Trời và chế độ `ISS View`.
5. Nếu thiết bị hỗ trợ, nhấn `Enter VR` để chuyển sang trải nghiệm VR.

## Ghi chú cho người chấm bài hoặc người review

- Dự án thể hiện rõ việc tổ chức scene 3D theo module, thay vì dồn toàn bộ logic vào một file.
- `SceneManager.js` đóng vai trò điều phối trung tâm, thuận tiện cho việc mở rộng thêm đối tượng hoặc hệ tương tác mới.
- Việc tách `UI`, `Interaction`, `Controls`, `WebXRSetup` giúp phần tương tác desktop và VR dễ bảo trì hơn.
