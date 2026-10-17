import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { initDatabase, dbGet } from '../src/db/database.js';
import ttsService from '../src/services/ttsService.js';
import jobService from '../src/services/jobService.js';

describe('TtsService & JobService - Quản lý tác vụ tạo audio và giọng đọc', () => {
  before(async () => {
    await initDatabase();
  });

  it('1. Lấy danh sách giọng đọc tiếng Việt và lọc theo vùng miền / giới tính', () => {
    const allVoices = ttsService.getVoices();
    assert.ok(allVoices.length > 5, 'Phải có đầy đủ giọng đọc từ các nhà cung cấp');

    const northFemale = ttsService.getVoices({ gender: 'female', region: 'north' });
    assert.ok(northFemale.length > 0, 'Phải có giọng nữ miền Bắc');

    const southMale = ttsService.getVoices({ gender: 'male', region: 'south' });
    assert.ok(southMale.length > 0, 'Phải có giọng nam miền Nam');

    const centralVoices = ttsService.getVoices({ region: 'central' });
    assert.ok(centralVoices.length > 0, 'Phải có giọng miền Trung');
  });

  it('2. Tạo audio nghe thử mẫu (Preview) ở chế độ Demo', async () => {
    const preview = await ttsService.createPreview({
      voiceId: 'demo-vietnam',
      text: 'Xin chào, đây là bản ghi âm nghe thử.',
      speed: 1.0,
      pitch: 0.0,
    });

    assert.ok(preview.audioUrl.startsWith('/audio/'));
    assert.ok(preview.duration > 0);
    assert.equal(preview.voice.id, 'demo-vietnam');
  });

  it('3. Tạo tác vụ chuyển văn bản dài (Job Queue) và theo dõi tiến trình', async () => {
    const text = 'Đoạn văn thứ nhất của truyện dài. Đoạn văn thứ hai tiếp nối câu chuyện. Đoạn văn thứ ba kết thúc chương một.';
    const job = await jobService.createJob({
      title: 'Tác phẩm kiểm thử',
      text,
      voiceId: 'demo-vietnam',
      speed: 1.0,
      pitch: 0.0,
    });

    assert.ok(job.id);
    assert.equal(job.totalChars, text.length);
    assert.ok(job.totalChunks >= 1);

    // Chờ 1 giây để worker trong nền bắt đầu xử lý
    await new Promise((r) => setTimeout(r, 1200));

    const details = await jobService.getJobDetails(job.id);
    assert.equal(details.id, job.id);
    assert.ok(details.chunks.length > 0);
    assert.ok(['pending', 'processing', 'completed'].includes(details.status));
  });

  it('4. Hủy tác vụ khi đang chạy (Cancel Job)', async () => {
    const text = 'Đoạn một. '.repeat(20);
    const job = await jobService.createJob({
      title: 'Tác vụ cần hủy',
      text,
      voiceId: 'demo-vietnam',
    });

    const cancelRes = await jobService.cancelJob(job.id);
    assert.equal(cancelRes.success, true);

    const details = await jobService.getJobDetails(job.id);
    assert.equal(details.status, 'cancelled');
  });

  it('5. Ghép nối nhiều đoạn âm thanh thành một file duy nhất và tải về', async () => {
    const audioService = (await import('../src/services/audioService.js')).default;
    const fs = (await import('fs')).default;
    const path = (await import('path')).default;

    const preview1 = await ttsService.createPreview({
      voiceId: 'demo-vietnam',
      text: 'Đoạn thứ nhất trong truyện audio.',
    });
    const preview2 = await ttsService.createPreview({
      voiceId: 'demo-vietnam',
      text: 'Đoạn thứ hai nối tiếp câu chuyện.',
    });

    const file1 = path.join(process.cwd(), 'storage', preview1.audioUrl.replace(/^\//, ''));
    const file2 = path.join(process.cwd(), 'storage', preview2.audioUrl.replace(/^\//, ''));

    const mergedOutputPath = path.join(process.cwd(), 'storage', 'audio', `test_merged_${Date.now()}.mp3`);
    const mergeResult = await audioService.mergeAudioFiles([file1, file2], mergedOutputPath);

    assert.equal(mergeResult.success, true);
    assert.ok(fs.existsSync(mergedOutputPath));
    assert.ok(mergeResult.sizeBytes > 0);

    // Dọn dẹp file test
    if (fs.existsSync(mergedOutputPath)) {
      await fs.promises.unlink(mergedOutputPath);
    }
  });
});

