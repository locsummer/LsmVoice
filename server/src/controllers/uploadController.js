import fileParserService from '../services/fileParserService.js';

export const handleFileUpload = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn tệp tin văn bản (.txt, .docx, .pdf) để tải lên.',
      });
    }

    const result = await fileParserService.extractTextFromFile(req.file);

    res.json({
      success: true,
      message: 'Trích xuất văn bản từ tệp thành công.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export default { handleFileUpload };
