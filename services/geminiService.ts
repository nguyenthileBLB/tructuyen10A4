import { GoogleGenAI, Type } from "@google/genai";
import { Question, QuestionType, ExamGenerationConfig } from "../types";

// Initialize the client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const MODEL_NAME = "gemini-3-flash-preview";

export const generateQuestions = async (config: ExamGenerationConfig): Promise<Question[]> => {
  try {
    // Updated prompt to request Vietnamese content
    const prompt = `Tạo ${config.count} câu hỏi về chủ đề "${config.topic}" với độ khó ${config.difficulty}. 
    Kết hợp giữa trắc nghiệm (MULTIPLE_CHOICE) và tự luận ngắn (SHORT_ANSWER). 
    Ngôn ngữ: Tiếng Việt.
    Đối với câu hỏi trắc nghiệm, cung cấp 4 lựa chọn.`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              type: { type: Type.STRING, enum: [QuestionType.MULTIPLE_CHOICE, QuestionType.SHORT_ANSWER] },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctAnswer: { type: Type.STRING },
              points: { type: Type.INTEGER }
            },
            required: ["text", "type", "points"]
          }
        }
      }
    });

    const rawQuestions = JSON.parse(response.text || "[]");

    // Post-process to ensure IDs and correct types
    return rawQuestions.map((q: any) => ({
      id: crypto.randomUUID(),
      text: q.text,
      type: q.type,
      options: q.options || [],
      // For MC, try to find the index if the AI returned the text string
      correctAnswer: q.type === QuestionType.MULTIPLE_CHOICE && typeof q.correctAnswer === 'string'
        ? q.options?.indexOf(q.correctAnswer) !== -1 
            ? q.options.indexOf(q.correctAnswer) 
            : 0 // Fallback
        : q.correctAnswer, 
      points: 10,
      timeLimit: 60 // Default 60 seconds
    }));

  } catch (error) {
    console.error("Error generating questions:", error);
    throw error;
  }
};

export const parseQuestionsFromDocument = async (htmlContent: string): Promise<Question[]> => {
  try {
    const prompt = `
      Bạn là một trợ lý nhập liệu đề thi thông minh.
      Nhiệm vụ: Phân tích đoạn HTML được trích xuất từ file Word dưới đây và chuyển đổi thành danh sách câu hỏi JSON.
      
      QUY TẮC QUAN TRỌNG NHẤT VỀ ĐÁP ÁN:
      1. ƯU TIÊN SỐ 1: Nếu thấy văn bản nằm trong thẻ <u>...</u> (gạch chân), đó CHẮC CHẮN là đáp án đúng.
      2. Nếu không có gạch chân, hãy tìm các từ khóa "Đáp án:", "Key:", hoặc chữ in đậm <b>/<strong>.
      
      Văn bản nguồn (HTML):
      """
      ${htmlContent.substring(0, 50000)} 
      """
      
      Yêu cầu đầu ra JSON:
      - Loại bỏ các thẻ HTML thừa trong nội dung câu hỏi và đáp án (chỉ lấy text thuần).
      - Với câu trắc nghiệm (MULTIPLE_CHOICE): trích xuất đủ 4 lựa chọn vào mảng "options". Đáp án đúng ("correctAnswer") trả về LÀ NỘI DUNG VĂN BẢN của lựa chọn đó (Ví dụ: "25cm2").
      - Với câu tự luận (SHORT_ANSWER): "correctAnswer" là nội dung đáp án gợi ý.
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              type: { type: Type.STRING, enum: [QuestionType.MULTIPLE_CHOICE, QuestionType.SHORT_ANSWER] },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctAnswer: { type: Type.STRING },
              points: { type: Type.INTEGER }
            },
            required: ["text", "type", "points"]
          }
        }
      }
    });

    const rawQuestions = JSON.parse(response.text || "[]");

    return rawQuestions.map((q: any) => ({
      id: crypto.randomUUID(),
      text: q.text,
      type: q.type,
      options: q.options || [],
      // AI returns the string of the answer, we map it to index for MC
      correctAnswer: q.type === QuestionType.MULTIPLE_CHOICE && typeof q.correctAnswer === 'string'
        ? q.options?.findIndex((opt: string) => opt.trim() === q.correctAnswer.trim()) !== -1 
            ? q.options.findIndex((opt: string) => opt.trim() === q.correctAnswer.trim()) 
            : 0
        : q.correctAnswer, 
      points: 10,
      timeLimit: 60 // Default 60 seconds
    }));

  } catch (error) {
    console.error("Error parsing document:", error);
    throw error;
  }
};

export const gradeShortAnswer = async (questionText: string, studentAnswer: string, rubricOrCorrect: string): Promise<{ score: number; feedback: string }> => {
  try {
    const prompt = `
      Câu hỏi: ${questionText}
      Đáp án đúng/Hướng dẫn chấm: ${rubricOrCorrect}
      Câu trả lời của học sinh: ${studentAnswer}
      
      Hãy chấm điểm câu trả lời trên thang điểm 0 đến 10.
      Cung cấp một câu nhận xét ngắn gọn bằng Tiếng Việt.
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.INTEGER },
            feedback: { type: Type.STRING }
          },
          required: ["score", "feedback"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    return {
        score: result.score || 0,
        feedback: result.feedback || "Không thể chấm điểm."
    };

  } catch (error) {
    console.error("Error grading:", error);
    return { score: 0, feedback: "Lỗi chấm điểm tự động. Cần xem xét thủ công." };
  }
};