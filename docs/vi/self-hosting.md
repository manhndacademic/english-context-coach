# Hướng dẫn tự triển khai (Self-Hosting Guide)

Tài liệu này hướng dẫn chi tiết cách tự triển khai (self-host) ứng dụng **English Context Coach** trên máy chủ cá nhân (VPS/Homelab) sử dụng **Docker Compose**, cấu hình **Google OAuth** để đăng nhập, tích hợp với **Nginx Proxy Manager** (hoặc các Reverse Proxy khác) và thiết lập các biện pháp bảo mật cơ bản.

---

## 1. Yêu cầu hệ thống

Trước khi bắt đầu, hãy đảm bảo máy chủ của bạn đã cài đặt sẵn:

- **Docker** và **Docker Compose** (phiên bản V2 trở lên).
- Một **Tên miền (Domain Name)** được trỏ về địa chỉ IP của máy chủ để thiết lập HTTPS và đăng nhập OAuth.

---

## 2. Cấu hình các biến môi trường (`.env`)

Tạo một file `.env` từ file ví dụ `.env.example` nằm ở thư mục gốc của dự án:

```bash
cp .env.example .env
```

Mở file `.env` và thiết lập các giá trị cấu hình:

| Biến môi trường          | Ý nghĩa                                                       | Cách cấu hình cho Production                                                                                                                                  |
| :----------------------- | :------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`           | Chuỗi kết nối PostgreSQL.                                     | `postgres://postgres:<PASSWORD_BẢO_MẬT>@postgres:5432/english_context_coach`                                                                                  |
| `REDIS_URL`              | Chuỗi kết nối Redis cho tác vụ nền BullMQ.                    | `redis://redis:6379`                                                                                                                                          |
| `AUTH_SECRET`            | Khóa bí mật dùng để mã hóa session của Auth.js.               | Tạo bằng lệnh: `openssl rand -hex 32`                                                                                                                         |
| `AUTH_URL`               | Địa chỉ URL công khai của ứng dụng.                           | `https://english.domain.com` (Phải dùng HTTPS)                                                                                                                |
| `AUTH_TRUST_HOST`        | Cho phép tin cậy reverse proxy để xử lý URL redirect.         | Thiết lập là `true` (Bắt buộc khi chạy sau proxy)                                                                                                             |
| `GOOGLE_CLIENT_ID`       | Client ID từ Google Cloud Console.                            | Xem hướng dẫn ở phần 3                                                                                                                                        |
| `GOOGLE_CLIENT_SECRET`   | Client Secret từ Google Cloud Console.                        | Xem hướng dẫn ở phần 3                                                                                                                                        |
| `GEMINI_API_KEYS`        | Các API Keys của Google Gemini.                               | Danh sách các key phân cách bằng dấu phẩy hoặc xuống dòng dùng để xoay vòng (có độ ưu tiên cao hơn `GEMINI_API_KEY`). Hỗ trợ chú thích bằng `#` hoặc `//`.    |
| `GEMINI_API_KEY`         | API Key của Google Gemini.                                    | Key dự phòng (hỗ trợ một hoặc nhiều key phân cách bằng dấu phẩy/xuống dòng và có chú thích) nếu không cấu hình trong DB và không thiết lập `GEMINI_API_KEYS`. |
| `GEMINI_ANALYSIS_MODELS` | Danh sách model dự phòng cho phân tích & chấm điểm.           | Danh sách phân cách bằng dấu phẩy. Khuyên dùng: `gemini-3.1-flash-lite,gemma-4-31b-it,gemma-4-26b-a4b-it,gemini-3-flash-preview,gemini-3.5-flash`             |
| `GEMINI_FAST_MODELS`     | Danh sách model dự phòng để sinh bài tập.                     | Danh sách phân cách bằng dấu phẩy. Khuyên dùng: `gemini-3.1-flash-lite,gemma-4-31b-it,gemma-4-26b-a4b-it,gemini-3-flash-preview,gemini-3.5-flash`             |
| `GEMINI_THINKING_LEVEL`  | Cấp độ suy nghĩ của mô hình.                                  | `MINIMAL`, `LOW`, `MEDIUM`, hoặc `HIGH`                                                                                                                       |
| `WORKER_CONCURRENCY`     | Số lượng tác vụ nền xử lý đồng thời.                          | Mặc định là `1` (Khuyên dùng cho server RAM nhỏ)                                                                                                              |
| `ENCRYPTION_SECRET`      | Khóa bảo mật mã hóa API Keys lưu trong database.              | Tạo bằng lệnh: `openssl rand -hex 16` (Cần tối thiểu 32 ký tự)                                                                                                |
| `ADMIN_EMAIL`            | Email của tài khoản Admin hệ thống để tự động nâng cấp quyền. | Ví dụ: `your.email@gmail.com`                                                                                                                                 |

---

## 3. Cấu hình Google OAuth

Hệ thống sử dụng Google OAuth để liên kết **Account** (phương thức đăng nhập) của người dùng với **User** (danh tính người học) trong cơ sở dữ liệu.

Để lấy `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET`:

1. Truy cập [Google Cloud Console](https://console.cloud.google.com/).
2. Tạo một Project mới hoặc chọn Project sẵn có.
3. Vào mục **API & Services** > **OAuth consent screen**:
   - Chọn **External**.
   - Điền các thông tin bắt buộc (App name, User support email, Developer contact email).
4. Vào mục **Credentials** > **Create Credentials** > **OAuth client ID**:
   - **Application type**: Chọn `Web application`.
   - **Name**: Nhập tên gợi nhớ (ví dụ: `English Context Coach`).
   - **Authorized JavaScript origins**: Điền địa chỉ URL công khai của bạn, ví dụ: `https://english.domain.com`.
   - **Authorized redirect URIs**: Điền chính xác đường dẫn callback:
     ```
     https://english.domain.com/api/auth/callback/google
     ```
     > [!IMPORTANT]
     > Nếu cấu hình sai đường dẫn redirect URI này, Google sẽ trả về lỗi `redirect_uri_mismatch` khi người dùng cố gắng đăng nhập.
5. Sao chép **Client ID** và **Client Secret** thu được điền vào file `.env`.

---

## 4. Triển khai bằng Docker Compose

Dưới đây là 2 cách tích hợp dịch vụ với hệ thống Reverse Proxy của bạn.

### Cách 1: Expose cổng ra ngoài Host (Dành cho mọi Reverse Proxy)

Cách này phù hợp khi reverse proxy chạy độc lập bên ngoài hoặc chạy trên Host. Ứng dụng sẽ mở cổng `3000` trên máy chủ và proxy sẽ chuyển tiếp traffic tới `http://localhost:3000`.

Sử dụng trực tiếp file `docker-compose.yml` mặc định của dự án:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${DB_NAME:-english_context_coach}
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD:-postgres}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test:
        [
          "CMD-SHELL",
          "pg_isready -U postgres -d ${DB_NAME:-english_context_coach}",
        ]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 10

  web:
    build: .
    restart: unless-stopped
    command: ["bun", "server.js"]
    env_file: .env
    environment:
      DATABASE_URL: postgres://postgres:${DB_PASSWORD:-postgres}@postgres:5432/${DB_NAME:-english_context_coach}
      REDIS_URL: redis://redis:6379
      AUTH_URL: ${AUTH_URL:-http://localhost:3000}
      HOSTNAME: "0.0.0.0"
    ports:
      - "3000:3000"
    depends_on:
      migrate:
        condition: service_completed_successfully
      redis:
        condition: service_healthy

  migrate:
    build: .
    command: ["bun", "run", "db:migrate"]
    env_file: .env
    environment:
      DATABASE_URL: postgres://postgres:${DB_PASSWORD:-postgres}@postgres:5432/${DB_NAME:-english_context_coach}
    depends_on:
      postgres:
        condition: service_healthy

  worker:
    build: .
    restart: unless-stopped
    command: ["bun", "run", "worker"]
    env_file: .env
    environment:
      DATABASE_URL: postgres://postgres:${DB_PASSWORD:-postgres}@postgres:5432/${DB_NAME:-english_context_coach}
      REDIS_URL: redis://redis:6379
    depends_on:
      migrate:
        condition: service_completed_successfully
      redis:
        condition: service_healthy

volumes:
  postgres-data:
  redis-data:
```

### Cách 2: Kết nối trực tiếp vào mạng nội bộ của Nginx Proxy Manager (NPM)

Nếu bạn đã chạy Nginx Proxy Manager dưới dạng container Docker và quản lý mạng nội bộ chung (ví dụ: `npm_network`), bạn có thể cấu hình dự án kết nối trực tiếp vào mạng này.
**Ưu điểm:** Không cần mở cổng `3000` ra ngoài host, NPM có thể truy cập trực tiếp container `web` thông qua tên service.

Cập nhật file `docker-compose.yml` như sau:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${DB_NAME:-english_context_coach}
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD:-postgres}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - default_net
    healthcheck:
      test:
        [
          "CMD-SHELL",
          "pg_isready -U postgres -d ${DB_NAME:-english_context_coach}",
        ]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis-data:/data
    networks:
      - default_net
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 10

  web:
    build: .
    restart: unless-stopped
    command: ["bun", "server.js"]
    env_file: .env
    environment:
      DATABASE_URL: postgres://postgres:${DB_PASSWORD:-postgres}@postgres:5432/${DB_NAME:-english_context_coach}
      REDIS_URL: redis://redis:6379
      AUTH_URL: ${AUTH_URL:-http://localhost:3000}
      HOSTNAME: "0.0.0.0"
    # Không cần khai báo ports ở đây để tránh expose ra ngoài host
    networks:
      - default_net
      - npm_network
    depends_on:
      migrate:
        condition: service_completed_successfully
      redis:
        condition: service_healthy

  migrate:
    build: .
    command: ["bun", "run", "db:migrate"]
    env_file: .env
    environment:
      DATABASE_URL: postgres://postgres:${DB_PASSWORD:-postgres}@postgres:5432/${DB_NAME:-english_context_coach}
    networks:
      - default_net
    depends_on:
      postgres:
        condition: service_healthy

  worker:
    build: .
    restart: unless-stopped
    command: ["bun", "run", "worker"]
    env_file: .env
    environment:
      DATABASE_URL: postgres://postgres:${DB_PASSWORD:-postgres}@postgres:5432/${DB_NAME:-english_context_coach}
      REDIS_URL: redis://redis:6379
    networks:
      - default_net
    depends_on:
      migrate:
        condition: service_completed_successfully
      redis:
        condition: service_healthy

networks:
  default_net: # Mạng nội bộ riêng cho các service của English Context Coach
  npm_network: # Mạng chung của Nginx Proxy Manager
    external: true
```

#### Cấu hình trên Nginx Proxy Manager (UI Dashboard):

1. Đăng nhập vào bảng điều khiển NPM.
2. Chọn **Hosts** > **Proxy Hosts** > **Add Proxy Host**.
3. Cấu hình tại tab **Details**:
   - **Domain Names**: Điền domain của bạn (ví dụ: `english.domain.com`).
   - **Scheme**: `http`
   - **Forward Hostname / IP**: Điền tên service của container web là `web` (hoặc tên đầy đủ của container nếu có thiết lập container_name).
   - **Forward Port**: `3000`
   - Bật **Block Common Exploits** và **Websockets Support** (cần thiết cho một số tính năng real-time nếu có).
4. Cấu hình tại tab **SSL**:
   - **SSL Certificate**: Chọn **Request a new SSL Certificate** (Let's Encrypt).
   - Bật **Force SSL** và **HTTP/2 Support**.
   - Đồng ý với điều khoản của Let's Encrypt và chọn **Save**.

---

## 5. Khởi chạy ứng dụng

Sau khi hoàn tất cấu hình file `.env` và `docker-compose.yml`, tiến hành build và khởi chạy các container:

```bash
docker compose up --build -d
```

Lệnh này sẽ tự động:

1. Tải và build image từ `Dockerfile` sử dụng Bun.
2. Khởi chạy cơ sở dữ liệu Postgres.
3. Container `migrate` tự động chạy để thiết lập cấu trúc bảng cơ sở dữ liệu bằng Drizzle ORM.
4. Khi quá trình migrate thành công, container `web` (Next.js server) và `worker` (xử lý tác vụ AI nền) sẽ được khởi chạy.

Kiểm tra trạng thái các container:

```bash
docker compose ps
```

Xem log hoạt động nếu cần gỡ lỗi:

```bash
docker compose logs -f
```

---

## 6. Bảo mật và Sao lưu dữ liệu

### Checklist Bảo mật

- [ ] **Mật khẩu cơ sở dữ liệu:** Không sử dụng mật khẩu mặc định `postgres`. Hãy tạo một chuỗi ngẫu nhiên phức tạp trong file `.env` và `docker-compose.yml`.
- [ ] **AUTH_SECRET:** Đảm bảo biến này được sinh ngẫu nhiên trên production. Bạn có thể chạy lệnh sau để sinh khóa mới:
  ```bash
  openssl rand -hex 32
  ```
- [ ] **HTTPS:** Không triển khai ứng dụng bằng HTTP thường trên internet. Auth.js sử dụng cookie bảo mật (`__Secure-` prefix) yêu cầu giao thức HTTPS bắt buộc, nếu không bạn sẽ gặp lỗi không thể đăng nhập thành công.

### Sao lưu Cơ sở dữ liệu (Database Backup)

Để tránh mất mát dữ liệu học tập của **User**, bạn nên thiết lập cronjob để sao lưu cơ sở dữ liệu PostgreSQL định kỳ.

**Lệnh sao lưu thủ công:**

```bash
docker exec -t $(docker compose ps -q postgres) pg_dump -U postgres -d english_context_coach > backup_$(date +%Y%m%d_%H%M%S).sql
```

**Lệnh phục hồi cơ sở dữ liệu từ file backup:**

```bash
# Xóa sạch DB hiện tại và khôi phục (Cẩn thận trước khi chạy!)
docker exec -i $(docker compose ps -q postgres) psql -U postgres -d english_context_coach < backup_file.sql
```

---

## 7. Cấu hình Admin và Quản lý API Key

Để truy cập bảng thống kê LLM metrics (`/admin`) và cấu hình cơ chế xoay vòng API key hệ thống, hãy thực hiện các bước sau:

### Cấu hình quyền Admin

1. Khai báo biến môi trường `ADMIN_EMAIL` trong file `.env` với địa chỉ email tài khoản Google của bạn:
   ```env
   ADMIN_EMAIL=your.email@gmail.com
   ```
2. Đăng nhập vào ứng dụng. NextAuth sẽ tự động kiểm tra, xác thực email của bạn khớp với `ADMIN_EMAIL` và thăng cấp người dùng của bạn thành vai trò `admin` trong cơ sở dữ liệu.
3. Khi đã được nâng cấp, đường dẫn **Quản trị** sẽ xuất hiện trên thanh điều hướng đầu trang để truy cập Dashboard.
4. Ngoài ra, bạn cũng có thể tự chạy script thăng cấp thủ công bên trong container web:
   ```bash
   docker compose exec web bun src/scratch/promote-admin.ts your.email@gmail.com
   ```

### Cấu hình xoay vòng API Keys hệ thống

1. Tạo một khóa bảo mật đối xứng ngẫu nhiên (tối thiểu 32 ký tự) để mã hóa API keys lưu trong database:
   ```bash
   openssl rand -hex 16
   ```
2. Khai báo khóa bí mật này trong file `.env` của bạn:
   ```env
   ENCRYPTION_SECRET=your_32_character_hex_secret
   ```
3. Truy cập vào **Quản trị** > **Vòng xoay API Keys** (`/admin/keys`).
4. Tiến hành thêm các API Key lấy từ Google AI Studio của bạn. Các API key sẽ được mã hóa an toàn bằng thuật toán `AES-256-GCM` trước khi lưu vào database.
5. Hệ thống sẽ tự động xoay vòng qua các key này trên mỗi request và tạm ngưng sử dụng key bị rate limit (lỗi 429) để hạ nhiệt tự động.
