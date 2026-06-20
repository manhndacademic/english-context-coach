const getSourceTextMaxLength = () => {
  const envVal =
    process.env.NEXT_PUBLIC_SOURCE_TEXT_MAX_LENGTH ||
    process.env.SOURCE_TEXT_MAX_LENGTH;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed)) return parsed;
  }
  return 100_000;
};

export const SOURCE_TEXT_MAX_LENGTH = getSourceTextMaxLength();
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_LESSON_ITEMS = 7;
export const PROMPT_VERSIONS = {
  analysis: "analysis-v3",
  exercises: "exercises-v1",
  grading: "grading-v2",
  review_prompt: "review_prompt-v1",
} as const;

export const SCHEMA_VERSIONS = {
  analysis: "analysis-schema-v1",
  exercises: "exercises-schema-v1",
  grading: "grading-schema-v1",
  review_prompt: "review_prompt-schema-v1",
} as const;

export interface TriviaQuestion {
  questionVi: string;
  choices: string[];
  correctAnswer: string;
  explanationVi: string;
}

export const TRANSLATION_TRIVIA: TriviaQuestion[] = [
  {
    questionVi: "Làm thế nào để dịch tự nhiên ý 'chạy dự án' trong công việc?",
    choices: ["run the project", "execute/lead the project", "project runs"],
    correctAnswer: "execute/lead the project",
    explanationVi:
      "Trong văn phong làm việc chuyên nghiệp, 'execute a project' (thực thi dự án) hoặc 'lead/manage a project' (dẫn dắt/quản lý dự án) tự nhiên hơn nhiều so với dịch word-by-word 'run the project'.",
  },
  {
    questionVi:
      "Từ 'take a look' nên được hiểu là gì trong câu: 'Could you take a look?'",
    choices: [
      "Hãy lấy một cái nhìn",
      "Hãy xem qua/kiểm tra giúp mình",
      "Đưa mắt nhìn đi",
    ],
    correctAnswer: "Hãy xem qua/kiểm tra giúp mình",
    explanationVi:
      "'take a look' là cụm từ lịch sự thường dùng để nhờ đồng nghiệp kiểm tra hoặc xem giúp tài liệu/code, không dịch thô thiển từng từ.",
  },
  {
    questionVi: "Ý 'dời lịch họp sang thứ Sáu' dịch thế nào cho tự nhiên?",
    choices: [
      "move the meeting to Friday / push the meeting to Friday",
      "move meeting go to Friday",
      "postpone meeting to Friday",
    ],
    correctAnswer: "move the meeting to Friday / push the meeting to Friday",
    explanationVi:
      "Trong công việc, 'move/push the meeting to [day]' là cách diễn đạt phổ biến nhất. 'Postpone' mang nghĩa trì hoãn (thường do sự cố) nhiều hơn là chỉ dời lịch.",
  },
  {
    questionVi: "Cụm 'keep me posted' nghĩa là gì?",
    choices: [
      "hãy giữ tôi ở bốt điện thoại",
      "hãy dán thông báo cho tôi",
      "hãy liên tục cập nhật tình hình cho tôi",
    ],
    correctAnswer: "hãy liên tục cập nhật tình hình cho tôi",
    explanationVi:
      "'keep someone posted' là thành ngữ thông dụng có nghĩa là liên tục cập nhật thông tin mới nhất cho ai đó về một sự việc.",
  },
  {
    questionVi:
      "Dịch câu 'Tôi rất thích cuốn sách này' sang tiếng Anh thế nào là tự nhiên?",
    choices: [
      "I very like this book",
      "I really like this book / I love this book",
      "I like very much this book",
    ],
    correctAnswer: "I really like this book / I love this book",
    explanationVi:
      "Tiếng Anh không dùng trạng từ 'very' bổ nghĩa trực tiếp cho động từ 'like' đứng trước (lỗi Vietlish kinh điển). Chúng ta dùng 'really like' hoặc 'like this book very much'.",
  },
];
