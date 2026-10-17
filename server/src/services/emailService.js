import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class EmailService {
  constructor() {
    this.transporter = null;
    this.lastSentEmail = null; // Dùng để kiểm thử nội bộ
    this.initTransporter();
  }

  initTransporter() {
    // Luôn nạp lại biến môi trường từ server/.env và .env với override: true để cập nhật ngay lập tức
    const serverEnvPath = path.resolve(__dirname, '../../.env');
    const rootEnvPath = path.resolve(__dirname, '../../../.env');
    dotenv.config({ path: serverEnvPath, override: true });
    dotenv.config({ path: rootEnvPath, override: true });
    dotenv.config({ override: true });

    const rawHost = (process.env.MAIL_HOST || '').trim();
    const port = parseInt(process.env.MAIL_PORT, 10) || 465;
    const user = (process.env.MAIL_USERNAME || process.env.MAIL_USER || '').trim();
    const pass = (process.env.MAIL_PASSWORD || process.env.MAIL_PASS || '').trim().replace(/\s+/g, '');
    const isGmail = (rawHost && rawHost.toLowerCase().includes('gmail')) || (user && user.toLowerCase().endsWith('@gmail.com'));
    const host = rawHost || (isGmail ? 'smtp.gmail.com' : '');

    if (user && pass && (host || isGmail)) {
      if (isGmail) {
        // Với Gmail trên hạ tầng Cloud (Render, AWS, GCP, v.v.):
        // Cổng 587 STARTTLS thường bị nhà mạng hoặc tường lửa Cloud làm nghẽn/timeout sau 10s.
        // Cổng 465 SSL trực tiếp (service: 'gmail' hoặc port 465) kết nối ngay tức thì và không bị nghẽn STARTTLS.
        this.primaryTransporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user, pass },
          connectionTimeout: 25000,
          greetingTimeout: 20000,
          socketTimeout: 30000,
          tls: { rejectUnauthorized: false },
        });

        this.fallbackTransporter = nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          auth: { user, pass },
          connectionTimeout: 25000,
          greetingTimeout: 20000,
          socketTimeout: 30000,
          tls: { rejectUnauthorized: false },
        });
      } else {
        // Dịch vụ SMTP thông thường
        const secure = process.env.MAIL_SECURE === 'true' || port === 465;
        this.primaryTransporter = nodemailer.createTransport({
          host,
          port,
          secure,
          auth: { user, pass },
          connectionTimeout: 25000,
          greetingTimeout: 20000,
          socketTimeout: 30000,
          tls: { rejectUnauthorized: false },
        });

        const altPort = port === 465 ? 587 : 465;
        this.fallbackTransporter = nodemailer.createTransport({
          host,
          port: altPort,
          secure: altPort === 465,
          auth: { user, pass },
          connectionTimeout: 25000,
          greetingTimeout: 20000,
          socketTimeout: 30000,
          tls: { rejectUnauthorized: false },
        });
      }

      this.transporter = this.primaryTransporter;

      // Xác minh ngầm không gây nghẽn luồng
      this.primaryTransporter.verify((err) => {
        if (err) {
          console.warn(`[EmailService] ⚠️ Kênh SMTP chính chưa sẵn sàng (${err.message}). Đã trang bị kênh dự phòng.`);
        } else {
          console.log(`[EmailService] ✓ Sẵn sàng gửi thư SMTP thực tế qua: ${user} (Kênh chính: SSL 465)`);
        }
      });
    } else {
      this.primaryTransporter = null;
      this.fallbackTransporter = null;
      this.transporter = null;
      console.warn('⚠️ [EmailService] Chưa cấu hình SMTP thực tế trong file server/.env (MAIL_HOST, MAIL_USERNAME, MAIL_PASSWORD).');
    }
  }

  /**
   * Tạo khung HTML chuẩn UI8 đồng bộ phong cách LsmVoice
   */
  renderBaseTemplate({ title, preheader, contentHtml }) {
    return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f6f8fc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
    }
    .email-container {
      max-width: 580px;
      margin: 32px auto;
      background: #ffffff;
      border-radius: 20px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      box-shadow: 0 10px 25px -5px rgba(108, 92, 231, 0.05);
    }
    .email-header {
      background: linear-gradient(135deg, #6c5ce7 0%, #4834d4 100%);
      padding: 32px 36px;
      text-align: center;
      color: #ffffff;
    }
    .brand-name {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.5px;
      margin: 0;
    }
    .brand-subtitle {
      font-size: 13px;
      opacity: 0.9;
      margin-top: 4px;
    }
    .email-body {
      padding: 36px;
      line-height: 1.6;
      font-size: 15px;
    }
    .highlight-card {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 18px 22px;
      margin: 22px 0;
    }
    .otp-box {
      background: linear-gradient(135deg, #f3f0ff 0%, #ede9fe 100%);
      border: 1.5px dashed #8b5cf6;
      border-radius: 14px;
      padding: 18px 24px;
      text-align: center;
      margin: 24px 0;
    }
    .otp-code {
      font-size: 32px;
      font-weight: 800;
      letter-spacing: 6px;
      color: #5b21b6;
      font-family: 'SF Mono', Monaco, Menlo, Consolas, monospace;
    }
    .btn-action {
      display: inline-block;
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 13px 28px;
      font-weight: 600;
      border-radius: 10px;
      margin: 16px 0;
      text-align: center;
    }
    .alert-box {
      background-color: #fffbeb;
      border-left: 4px solid #f59e0b;
      padding: 12px 16px;
      font-size: 13.5px;
      color: #92400e;
      border-radius: 4px 8px 8px 4px;
      margin: 20px 0;
    }
    .email-footer {
      background-color: #f8fafc;
      padding: 24px 36px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
      font-size: 12.5px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div style="display:none;font-size:1px;color:#333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    ${preheader || title}
  </div>
  <div class="email-container">
    <div class="email-header">
      <h1 class="brand-name">LsmVoice</h1>
      <div class="brand-subtitle">Chuyển văn bản thành giọng nói tiếng Việt chuyên nghiệp</div>
    </div>
    <div class="email-body">
      ${contentHtml}
    </div>
    <div class="email-footer">
      <p style="margin: 0 0 6px 0;">Đây là thư điện tử tự động từ nền tảng LsmVoice. Vui lòng không trả lời thư này.</p>
      <p style="margin: 0;">© ${new Date().getFullYear()} LsmVoice Platform. Bảo mật thông tin được ưu tiên hàng đầu.</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Phương thức gửi email tổng quát
   */
  async sendMail({ to, subject, html, text }) {
    const user = (process.env.MAIL_USERNAME || process.env.MAIL_USER || '').trim();
    const fromAddress = process.env.MAIL_FROM || (user ? `"LsmVoice" <${user}>` : '"LsmVoice" <Bechanhpro098@gmail.com>');
    const mailOptions = {
      from: fromAddress,
      to,
      replyTo: user || fromAddress,
      subject: subject.startsWith('[LsmVoice]') ? subject : `[LsmVoice] ${subject}`,
      text: text || subject,
      html,
      headers: {
        'X-Mailer': 'LsmVoice-TTS-Platform',
        'X-Priority': '1',
        'Importance': 'high',
      },
    };

    this.lastSentEmail = { ...mailOptions, sentAt: new Date() };

    if (!this.primaryTransporter && !this.transporter) {
      this.initTransporter();
    }

    if (!this.primaryTransporter && !this.transporter) {
      const errorMsg = 'Chưa cấu hình dịch vụ gửi email SMTP thật trong file server/.env (MAIL_HOST, MAIL_USERNAME, MAIL_PASSWORD). Vui lòng cấu hình tài khoản gửi thư thật để hệ thống gửi mật khẩu.';
      console.error(`[EmailService] ✗ ${errorMsg}`);
      throw new Error(errorMsg);
    }

    const primary = this.primaryTransporter || this.transporter;
    let lastError = null;

    // 1. Thử gửi qua kênh SMTP chính (ưu tiên SSL 465 để tránh timeout do Cloud firewall)
    try {
      const info = await primary.sendMail(mailOptions);
      console.log(`[EmailService] ✓ Email thật đã gửi thành công tới "${to}" qua kênh chính (MessageId: ${info.messageId})`);
      return {
        success: true,
        mock: false,
        messageId: info.messageId,
        to,
      };
    } catch (err) {
      console.warn(`[EmailService] ⚠️ Kênh SMTP chính gửi tới "${to}" gặp sự cố (${err.message}). Đang tự động chuyển sang kênh dự phòng...`);
      lastError = err;
    }

    // 2. Tự động kích hoạt kênh dự phòng nếu kênh chính gặp timeout hoặc từ chối kết nối
    if (this.fallbackTransporter && this.fallbackTransporter !== primary) {
      try {
        const info = await this.fallbackTransporter.sendMail(mailOptions);
        console.log(`[EmailService] ✓ Email thật đã gửi thành công tới "${to}" qua kênh dự phòng (MessageId: ${info.messageId})`);
        return {
          success: true,
          mock: false,
          messageId: info.messageId,
          to,
        };
      } catch (fallbackErr) {
        console.error(`[EmailService] ✗ Cả kênh chính và kênh dự phòng đều không thể gửi email tới "${to}":`, fallbackErr.message);
        lastError = fallbackErr;
      }
    }

    console.error(`[EmailService] ✗ Máy chủ SMTP từ chối gửi email tới "${to}":`, lastError?.message);
    throw new Error(`Máy chủ SMTP từ chối gửi email tới "${to}": ${lastError?.message || 'Không thể kết nối đến máy chủ email'}`);
  }

  /**
   * 1. Email cấp tài khoản và mật khẩu ban đầu
   */
  async sendAccountWelcomeEmail({ email, username, initialPassword, loginUrl = 'http://localhost:5173' }) {
    const title = 'Thông tin tài khoản LsmVoice';
    const contentHtml = `
      <h2 style="font-size: 20px; font-weight: 700; color: #1e293b; margin-top: 0;">Chào mừng bạn đến với LsmVoice!</h2>
      <p>Tài khoản của bạn đã được khởi tạo thành công trên nền tảng đọc audio tiếng Việt LsmVoice. Dưới đây là thông tin đăng nhập ban đầu của bạn:</p>

      <div class="highlight-card">
        <p style="margin: 4px 0;"><strong>Tên đăng nhập:</strong> <span style="font-family: monospace; font-size: 15px; color: #4338ca;">${username}</span></p>
        <p style="margin: 4px 0;"><strong>Địa chỉ Email:</strong> <span>${email}</span></p>
        <p style="margin: 4px 0;"><strong>Mật khẩu ban đầu:</strong> <span style="font-family: monospace; font-size: 16px; font-weight: 700; color: #b91c1c; background: #fee2e2; padding: 2px 8px; border-radius: 4px;">${initialPassword}</span></p>
      </div>

      <div style="text-align: center; margin: 26px 0;">
        <a href="${loginUrl}" class="btn-action">Truy cập phòng thu LsmVoice</a>
      </div>

      <div class="alert-box">
        <strong>Lưu ý bảo mật:</strong>
        <ul style="margin: 6px 0 0 0; padding-left: 20px;">
          <li>Không chia sẻ mật khẩu ban đầu này cho bất kỳ ai.</li>
          <li>Bạn có thể chủ động đổi sang mật khẩu cá nhân bất cứ lúc nào trong mục <strong>Cài đặt tài khoản &gt; Đổi mật khẩu</strong>.</li>
          <li>Khi đăng nhập thông thường, bạn có thể sử dụng phương thức đăng nhập nhanh bằng mã OTP gửi về email này.</li>
        </ul>
      </div>
    `;

    const html = this.renderBaseTemplate({
      title,
      preheader: `Thông tin tài khoản LsmVoice của ${username}`,
      contentHtml,
    });

    return this.sendMail({
      to: email,
      subject: title,
      html,
      text: `Thông tin tài khoản LsmVoice:\nTên đăng nhập: ${username}\nMật khẩu ban đầu: ${initialPassword}\nĐăng nhập tại: ${loginUrl}`,
    });
  }

  /**
   * 1.1. Email thông báo đến Quản trị viên khi có thành viên mới đăng ký
   */
  async sendNewUserAlertToAdmin({ username, email, fullName, registeredAt, ipAddress }) {
    const adminEmail = process.env.ADMIN_NOTIFY_EMAIL || process.env.ADMIN_EMAIL || process.env.MAIL_USERNAME || 'Bechanhpro098@gmail.com';
    const title = `[LsmVoice Quản trị] Thành viên mới vừa đăng ký: @${username}`;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const contentHtml = `
      <h2 style="font-size: 20px; font-weight: 700; color: #1e293b; margin-top: 0;">Thông báo Thành viên mới đăng ký</h2>
      <p>Hệ thống LsmVoice vừa ghi nhận một thành viên mới đăng ký tài khoản thành công:</p>

      <div class="highlight-card" style="background: #f8fafc; border-left: 4px solid #6366f1; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Tên đăng nhập:</strong> <span style="font-family: monospace; font-size: 15px; color: #4338ca; font-weight: 600;">@${username}</span></p>
        <p style="margin: 4px 0;"><strong>Họ và tên:</strong> <span>${fullName || 'Không cung cấp'}</span></p>
        <p style="margin: 4px 0;"><strong>Địa chỉ Email:</strong> <span>${email}</span></p>
        <p style="margin: 4px 0;"><strong>Thời gian đăng ký:</strong> <span>${registeredAt || new Date().toLocaleString('vi-VN')}</span></p>
        <p style="margin: 4px 0;"><strong>Địa chỉ IP:</strong> <span>${ipAddress || '127.0.0.1'}</span></p>
      </div>

      <div style="text-align: center; margin: 26px 0;">
        <a href="${frontendUrl}/admin/customers" class="btn-action">Xem danh sách khách hàng trong Quản trị</a>
      </div>

      <div class="alert-box">
        <strong>Nhật ký bảo mật:</strong> Thông tin đăng ký đã được tự động lưu vào Nhật ký kiểm toán Quản trị (Admin Audit Logs).
      </div>
    `;

    try {
      await this.sendMail({
        to: adminEmail,
        subject: title,
        html: this.renderBaseTemplate({
          title,
          preheader: `Thành viên mới @${username} (${email}) vừa đăng ký thành công`,
          contentHtml,
        }),
        text: `[LsmVoice Quản trị] Thành viên mới vừa đăng ký:\nTên đăng nhập: @${username}\nEmail: ${email}\nHọ tên: ${fullName || 'N/A'}\nThời gian: ${registeredAt}\nIP: ${ipAddress}`,
      });
      console.log(`[EmailService] ✓ Đã gửi email thông báo thành viên mới tới Admin (${adminEmail})`);
    } catch (err) {
      console.warn(`[EmailService] ⚠️ Không thể gửi email thông báo thành viên mới tới Admin:`, err.message);
    }
  }

  /**
   * 2. Email mã OTP đăng nhập
   */
  async sendLoginOtpEmail({ email, username, otp, expiresInMinutes = 5 }) {
    const title = 'Mã xác thực OTP đăng nhập LsmVoice';
    const contentHtml = `
      <h2 style="font-size: 19px; font-weight: 700; color: #1e293b; margin-top: 0;">Yêu cầu đăng nhập tài khoản</h2>
      <p>Xin chào <strong>${username || email}</strong>,</p>
      <p>Chúng tôi nhận được yêu cầu đăng nhập vào tài khoản LsmVoice của bạn. Sử dụng mã xác thực (OTP) dưới đây để hoàn tất đăng nhập:</p>

      <div class="otp-box">
        <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #7c3aed; margin-bottom: 6px; letter-spacing: 1px;">Mã OTP của bạn</div>
        <div class="otp-code">${otp}</div>
      </div>

      <p style="font-size: 13.5px; color: #64748b; text-align: center;">Mã xác thực có hiệu lực trong vòng <strong>${expiresInMinutes} phút</strong> và chỉ dùng được một lần duy nhất.</p>

      <div class="alert-box">
        <strong>Cảnh báo an toàn:</strong> Nếu bạn không thực hiện yêu cầu đăng nhập này, vui lòng bỏ qua thư này và kiểm tra lại bảo mật tài khoản. Không cung cấp mã này cho người khác.
      </div>
    `;

    const html = this.renderBaseTemplate({
      title,
      preheader: `Mã OTP đăng nhập LsmVoice: ${otp}`,
      contentHtml,
    });

    return this.sendMail({
      to: email,
      subject: title,
      html,
      text: `Mã OTP đăng nhập LsmVoice của bạn là: ${otp}. Mã có hiệu lực trong ${expiresInMinutes} phút.`,
    });
  }

  /**
   * 3. Email mã OTP đổi mật khẩu
   */
  async sendPasswordChangeOtpEmail({ email, username, otp, expiresInMinutes = 5 }) {
    const title = 'Mã xác thực OTP đổi mật khẩu LsmVoice';
    const contentHtml = `
      <h2 style="font-size: 19px; font-weight: 700; color: #1e293b; margin-top: 0;">Yêu cầu đổi mật khẩu</h2>
      <p>Xin chào <strong>${username || email}</strong>,</p>
      <p>Bạn đang thực hiện thao tác đổi mật khẩu trên LsmVoice. Hãy nhập mã OTP dưới đây để xác nhận danh tính trước khi thiết lập mật khẩu mới:</p>

      <div class="otp-box">
        <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #7c3aed; margin-bottom: 6px; letter-spacing: 1px;">Mã xác thực đổi mật khẩu</div>
        <div class="otp-code">${otp}</div>
      </div>

      <p style="font-size: 13.5px; color: #64748b; text-align: center;">Mã OTP có hiệu lực trong <strong>${expiresInMinutes} phút</strong>.</p>
      <div class="alert-box">
        Nếu bạn không yêu cầu đổi mật khẩu, vui lòng bỏ qua email này. Mật khẩu hiện tại của bạn vẫn được giữ nguyên an toàn.
      </div>
    `;

    const html = this.renderBaseTemplate({
      title,
      preheader: `Mã OTP đổi mật khẩu LsmVoice: ${otp}`,
      contentHtml,
    });

    return this.sendMail({
      to: email,
      subject: title,
      html,
      text: `Mã OTP đổi mật khẩu LsmVoice của bạn là: ${otp}. Mã hết hạn sau ${expiresInMinutes} phút.`,
    });
  }

  /**
   * 4. Email mã OTP khôi phục / đặt lại mật khẩu
   */
  async sendPasswordResetOtpEmail({ email, otp, expiresInMinutes = 5 }) {
    const title = 'Khôi phục mật khẩu tài khoản LsmVoice';
    const contentHtml = `
      <h2 style="font-size: 19px; font-weight: 700; color: #1e293b; margin-top: 0;">Yêu cầu khôi phục mật khẩu</h2>
      <p>Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản liên kết với địa chỉ email <strong>${email}</strong>.</p>
      <p>Hãy sử dụng mã xác thực bảo mật dưới đây để tạo mật khẩu mới:</p>

      <div class="otp-box">
        <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #7c3aed; margin-bottom: 6px; letter-spacing: 1px;">Mã khôi phục mật khẩu</div>
        <div class="otp-code">${otp}</div>
      </div>

      <p style="font-size: 13.5px; color: #64748b; text-align: center;">Mã có hiệu lực trong <strong>${expiresInMinutes} phút</strong> và chỉ sử dụng một lần.</p>
      <div class="alert-box">
        Nếu bạn không yêu cầu đặt lại mật khẩu, xin vui lòng bỏ qua thư này. Tài khoản của bạn vẫn được bảo vệ tuyệt đối.
      </div>
    `;

    const html = this.renderBaseTemplate({
      title,
      preheader: `Mã khôi phục mật khẩu: ${otp}`,
      contentHtml,
    });

    return this.sendMail({
      to: email,
      subject: title,
      html,
      text: `Mã xác thực đặt lại mật khẩu LsmVoice của bạn là: ${otp}. Hết hạn sau ${expiresInMinutes} phút.`,
    });
  }

  /**
   * 5. Email thông báo mật khẩu đã thay đổi thành công
   */
  async sendPasswordChangedAlertEmail({ email, username }) {
    const title = 'Thông báo bảo mật: Mật khẩu LsmVoice đã được thay đổi';
    const contentHtml = `
      <h2 style="font-size: 19px; font-weight: 700; color: #1e293b; margin-top: 0;">Mật khẩu tài khoản đã được thay đổi</h2>
      <p>Xin chào <strong>${username || email}</strong>,</p>
      <p>Mật khẩu cho tài khoản LsmVoice của bạn đã được thay đổi thành công vào lúc <strong>${new Date().toLocaleString('vi-VN')}</strong>.</p>

      <div class="highlight-card" style="border-left: 4px solid #10b981;">
        <p style="margin: 0; color: #065f46;"><strong>✓ Trạng thái:</strong> Toàn bộ các phiên đăng nhập cũ trên các thiết bị khác đã được tự động đăng xuất để đảm bảo an toàn tối đa cho tài khoản của bạn.</p>
      </div>

      <div class="alert-box" style="background-color: #fef2f2; border-color: #ef4444; color: #991b1b;">
        <strong>CẢNH BÁO:</strong> Nếu bạn KHÔNG thực hiện thay đổi này, tài khoản của bạn có thể đã bị xâm phạm. Vui lòng khôi phục mật khẩu ngay lập tức hoặc liên hệ quản trị viên để khóa tài khoản khẩn cấp.
      </div>
    `;

    const html = this.renderBaseTemplate({
      title,
      preheader: 'Mật khẩu tài khoản LsmVoice của bạn vừa được thay đổi thành công.',
      contentHtml,
    });

    return this.sendMail({
      to: email,
      subject: title,
      html,
      text: `Thông báo bảo mật: Mật khẩu cho tài khoản LsmVoice (${email}) đã được thay đổi thành công vào lúc ${new Date().toLocaleString('vi-VN')}.`,
    });
  }

  /**
   * 6. Email xác minh địa chỉ email
   */
  async sendEmailVerificationOtpEmail({ email, username, otp, expiresInMinutes = 10 }) {
    const title = 'Xác minh địa chỉ email tài khoản LsmVoice';
    const contentHtml = `
      <h2 style="font-size: 19px; font-weight: 700; color: #1e293b; margin-top: 0;">Xác minh địa chỉ Email</h2>
      <p>Xin chào <strong>${username || email}</strong>,</p>
      <p>Cảm ơn bạn đã sử dụng LsmVoice. Hãy sử dụng mã OTP dưới đây để hoàn tất việc xác minh địa chỉ email cho tài khoản:</p>

      <div class="otp-box">
        <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #7c3aed; margin-bottom: 6px; letter-spacing: 1px;">Mã xác minh Email</div>
        <div class="otp-code">${otp}</div>
      </div>

      <p style="font-size: 13.5px; color: #64748b; text-align: center;">Mã xác minh có hiệu lực trong vòng <strong>${expiresInMinutes} phút</strong>.</p>
    `;

    const html = this.renderBaseTemplate({
      title,
      preheader: `Mã xác minh email: ${otp}`,
      contentHtml,
    });

    return this.sendMail({
      to: email,
      subject: title,
      html,
      text: `Mã xác minh email LsmVoice của bạn là: ${otp}. Hết hạn sau ${expiresInMinutes} phút.`,
    });
  }
}

const emailService = new EmailService();
export default emailService;
