# Welcome to Real Estate CRM: Empowering Real Estate Agents with Modern CRM Tools

Real Estate CRM is an innovative Customer Relationship Management (CRM) solution designed exclusively for Real Estate Agents. Streamline your workflow, enhance client interactions, and boost your business with our feature-packed CRM.

## **Explore our repository to discover**

1. Intuitive Interface: A user-friendly dashboard tailored to the needs of Real Estate professionals.
2. MERN Stack Powered: Built on the robust MERN (MongoDB, Express, ReactJS, Node.js) stack for high performance.
3. Customization: Open-source architecture allows you to tailor the CRM to your unique requirements.
4. Responsive Design: Access your CRM anytime, anywhere, from any device.
5. Seamless Communication: Foster better client relationships with integrated communication tools.

Ready to revolutionize your Real Estate business? Dive into our documentation below and take the first step towards enhancing your productivity.

## **Demo**

Here are the demo link credentials.

https://real-estate-crm-jet.vercel.app/

**Admin access:**
Username: admin@gmail.com
Password: admin123

**Regular access:**
Username: user@gmail.com
Password: user123

## **Phiên bản cho sàn môi giới BĐS Việt Nam**

Giao diện tiếng Việt, dữ liệu theo thị trường Việt Nam, dùng được trên điện thoại.

**Tính năng chính**

- **Khách tiềm năng**: nhập tay hoặc từ file Excel (CSV) của quảng cáo / sự kiện, hẹn ngày liên hệ lại, chuyển thành khách hàng (giữ nguyên lịch sử chăm sóc).
- **Khách hàng**: họ tên, SĐT, Zalo, nhu cầu (mua / thuê / đầu tư...), ngân sách, khu vực, tình trạng chăm sóc (mới → đang tư vấn → đã dẫn xem → đặt cọc → đã giao dịch), đồng ý xử lý dữ liệu cá nhân, gợi ý BĐS phù hợp nhu cầu.
- **Chống trùng khách**: một số điện thoại (0901…, +84 901…, 090.1…) chỉ thuộc một nhân viên; nhân viên khác nhập trùng sẽ được báo tên người đang phụ trách.
- **Bất động sản**: mã BĐS tự sinh, bán / cho thuê, loại hình, địa chỉ theo 34 tỉnh thành và xã / phường mới (kèm địa chỉ cũ), giá VNĐ ("3,5 tỷ", đơn giá / m²), diện tích, ngang x dài, hướng, pháp lý, nội thất, ảnh / video / giấy tờ, chủ nhà. Giỏ hàng dùng chung cả công ty, thông tin chủ nhà chỉ người phụ trách và quản trị xem được. Nút "Sao chép tin đăng" để gửi Zalo / Facebook.
- **Giao dịch**: đặt cọc, hạn ký hợp đồng / công chứng, lịch thanh toán, hoa hồng và chia hoa hồng đầu chủ / đầu khách; trạng thái BĐS và khách hàng tự cập nhật theo giao dịch.
- **Lịch hẹn, công việc, lịch làm việc**: dẫn khách xem nhà, ghi kết quả; việc cần làm, việc quá hạn.
- **Tổng quan và báo cáo**: doanh số, hoa hồng, khách mới, nguồn khách, hiệu suất từng nhân viên, xuất Excel.

**Cài đặt nhanh**

1. API: sao chép `server/.env.example` thành `server/.env`, đặt `DB_URL`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` rồi chạy `cd server && npm ci && npm start`.
2. Web: sao chép `Client/.env.example` thành `Client/.env`, đặt `REACT_APP_BASE_URL` (địa chỉ API), `REACT_APP_COMPANY_NAME` và `REACT_APP_LOGO_URL` (tên và logo công ty), rồi `cd Client && npm ci && npm run build` và đưa thư mục `Client/build` lên máy chủ web (cấu hình mọi đường dẫn trả về `index.html`).
3. Đăng nhập bằng tài khoản quản trị, vào **Nhân viên** để tạo tài khoản cho sale, rồi nhập khách hàng từ file mẫu ở **Khách hàng > Nhập Excel**.

**Nâng cấp từ bản cũ**: không cần chuyển đổi dữ liệu. Khách hàng, BĐS và khách tiềm năng cũ vẫn hiển thị (tên, giá, trạng thái cũ được đọc lại); các trường mới trống cho đến khi được cập nhật. Danh sách BĐS nay dùng chung cho mọi nhân viên (`PROPERTY_VISIBILITY=own` để giữ như cũ).

## **Installation**

Getting started with RealEstateCRM is a breeze. Follow our comprehensive installation guide to set up the CRM in your local environment. Whether you're an experienced developer or new to the stack, our step-by-step instructions will have you up and running in no time.

[Installation Guide](https://github.com/prolinkinfo/RealEstateCRM/discussions/2)

### Configuration

The API reads its settings from `server/.env`, see [`server/.env.example`](server/.env.example). For a production installation:

- `JWT_SECRET`: a long random value. Without it the server falls back to the insecure default key (and logs a warning). Changing it logs every user out once.
- `ADMIN_EMAIL` / `ADMIN_PASSWORD`: the first admin account, created when the database has no admin yet. Without them the demo account (`admin@gmail.com` / `admin123`) is created.
- `CLIENT_URL`: address of the web client, Stripe sends customers back to its `/payments` page after a checkout.
- `PROPERTY_VISIBILITY`: `shared` (default, every employee sees the company's listings, the owner's details stay private) or `own`.
- `APP_TIMEZONE`: time zone of the monthly figures of the dashboard (default `Asia/Ho_Chi_Minh`).

The web client reads `Client/.env` at build time, see [`Client/.env.example`](Client/.env.example): `REACT_APP_BASE_URL`, `REACT_APP_COMPANY_NAME`, `REACT_APP_LOGO_URL`.

### Running the tests

```bash
# API: integration tests against an in-memory MongoDB (the MongoDB binary is downloaded on the first run)
cd server && npm ci && npm test

# Web client: unit tests and production build
cd Client && npm ci && CI=true npm test && npm run build
```

`npm ci` installs the exact versions from the committed `package-lock.json` files. Use it for deployments too: without the lock files a fresh install picks the latest versions, which is how the client build broke (typescript 7, apexcharts 3.50+).

The same checks run on every pull request (`.github/workflows/tests.yml`).

## **Contributing**

We believe in the power of collaboration! Join us in making RealEstateCRM even better. Whether you're a developer, designer, or Real Estate enthusiast, your contributions are invaluable. Check out our contribution guidelines and dive into our codebase.

Contribution Guidelines

## **Support**

We're here to support your journey with RealEstateCRM. If you have questions, encounter issues, or need assistance, don't hesitate to reach out. Our responsive support team is dedicated to helping you succeed.

For support inquiries, email us at: talent@prolinkinfotech.com

## **License**

RealEstateCRM is released under the MIT License. Feel free to use, modify, and distribute the software in accordance with the license terms.

## **Keeping in Touch**

We value your feedback and ideas. If you have suggestions for new features or customization options, we'd love to hear from you. Let's work together to shape the future of RealEstateCRM.

Contact us at: talent@prolinkinfotech.com

## **Social Media**

Stay connected with us on social media for the latest updates, tips, and community discussions. Join our growing network of Real Estate professionals using RealEstateCRM to elevate their business.
