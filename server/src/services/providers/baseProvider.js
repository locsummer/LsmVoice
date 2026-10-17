/**
 * Lớp cơ sở (BaseProvider) cho các dịch vụ chuyển văn bản thành giọng nói (TTS)
 */
export class BaseProvider {
  constructor(name) {
    this.name = name;
  }

  getName() {
    return this.name;
  }

  /**
   * Lấy danh sách giọng đọc tiếng Việt được hỗ trợ
   * @returns {Array<object>}
   */
  getVoices() {
    throw new Error(`getVoices() chưa được triển khai cho provider: ${this.name}`);
  }

  /**
   * Kiểm tra cấu hình và kết nối tới dịch vụ
   * @returns {Promise<{ available: boolean, message?: string }>}
   */
  async checkAvailability() {
    return { available: true };
  }

  /**
   * Tổng hợp giọng nói thành file audio
   * @param {object} options
   * @param {string} options.text
   * @param {string} options.voiceId
   * @param {number} options.speed (0.5 - 2.0, mặc định 1.0)
   * @param {number} options.pitch (-50 đến +50 hoặc tương đương)
   * @param {string} options.outputFile Đường dẫn lưu file kết quả
   * @returns {Promise<{ audioPath: string, duration: number, format: string, sizeBytes: number }>}
   */
  async synthesize(options) {
    throw new Error(`synthesize() chưa được triển khai cho provider: ${this.name}`);
  }

  /**
   * Tạo audio nghe thử mẫu
   */
  async preview(options) {
    return this.synthesize(options);
  }
}

export default BaseProvider;
