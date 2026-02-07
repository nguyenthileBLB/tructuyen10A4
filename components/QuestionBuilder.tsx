import React from 'react';
import { Question, QuestionType } from '../types';
import { Plus, Trash2, CheckCircle2, Clock, Target, BrainCircuit, GripVertical } from 'lucide-react';
import RichTextEditor from './RichTextEditor';

interface QuestionBuilderProps {
  questions: Question[];
  onChange: (questions: Question[]) => void;
}

const QuestionBuilder: React.FC<QuestionBuilderProps> = ({ questions, onChange }) => {

  const handleAddQuestion = () => {
    const newQ: Question = {
      id: crypto.randomUUID(),
      text: '',
      type: QuestionType.MULTIPLE_CHOICE,
      options: ['', '', '', ''],
      correctAnswer: 0,
      points: 10,
      timeLimit: 60, // Default 60s
    };
    onChange([...questions, newQ]);
  };

  const handleRemoveQuestion = (id: string) => {
    if (window.confirm("Bạn có chắc chắn muốn xoá câu hỏi này không?")) {
        onChange(questions.filter(q => q.id !== id));
    }
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    onChange(questions.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  return (
    <div className="space-y-8">
      {/* Questions List */}
      <div className="space-y-6">
        {questions.map((q, index) => (
          <div key={q.id} className="bg-white p-6 rounded-[2rem] shadow-lg shadow-indigo-100/50 border border-slate-100 relative group hover:border-indigo-200 transition-colors">
            <div className="absolute top-4 right-4 flex gap-2 z-10">
                 <button
                  onClick={() => handleRemoveQuestion(q.id)}
                  className="px-3 py-2 text-rose-500 bg-rose-50 hover:bg-rose-100 hover:text-rose-600 rounded-xl transition-all font-bold text-xs flex items-center gap-1 border border-rose-100"
                  title="Xoá câu hỏi này"
                >
                  <Trash2 className="w-4 h-4" /> Xoá
                </button>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 mb-6 pr-20">
              <span className="bg-indigo-100 text-indigo-700 text-xs font-black px-3 py-1.5 rounded-lg uppercase tracking-wide">Câu {index + 1}</span>
              <select
                value={q.type}
                onChange={(e) => updateQuestion(q.id, { type: e.target.value as QuestionType })}
                className="text-sm font-bold text-slate-600 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-300 py-1.5 pl-3 pr-8 cursor-pointer"
              >
                <option value={QuestionType.MULTIPLE_CHOICE}>Trắc nghiệm</option>
                <option value={QuestionType.SHORT_ANSWER}>Tự luận ngắn</option>
              </select>

              <div className="flex items-center gap-1 border border-indigo-100 rounded-xl px-3 py-1 bg-indigo-50/50 ml-auto sm:ml-0" title="Thời gian làm bài (giây)">
                  <Clock className="w-3 h-3 text-indigo-500" />
                  <input 
                    type="number"
                    min="5"
                    value={q.timeLimit || 60}
                    onChange={(e) => updateQuestion(q.id, { timeLimit: parseInt(e.target.value) || 60 })}
                    className="w-8 text-sm bg-transparent border-none focus:ring-0 text-center text-indigo-700 font-bold p-0"
                  />
                  <span className="text-xs text-indigo-400 font-bold">s</span>
              </div>

              <div className="flex items-center gap-1 border border-amber-100 rounded-xl px-3 py-1 bg-amber-50/50" title="Điểm số">
                  <Target className="w-3 h-3 text-amber-500" />
                  <input 
                    type="number"
                    min="1"
                    value={q.points || 10}
                    onChange={(e) => updateQuestion(q.id, { points: parseInt(e.target.value) || 10 })}
                    className="w-8 text-sm bg-transparent border-none focus:ring-0 text-center text-amber-700 font-bold p-0"
                  />
                  <span className="text-xs text-amber-400 font-bold">đ</span>
              </div>
            </div>

            <div className="mb-6">
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1">Nội dung câu hỏi</label>
                <RichTextEditor 
                    value={q.text}
                    onChange={(val) => updateQuestion(q.id, { text: val })}
                    placeholder="Nhập nội dung câu hỏi (hỗ trợ ảnh, công thức...)"
                />
            </div>

            {q.type === QuestionType.MULTIPLE_CHOICE && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {q.options?.map((opt, optIndex) => (
                  <div key={optIndex} className={`relative flex flex-col gap-2 p-3 rounded-3xl border-2 transition-all ${q.correctAnswer === optIndex ? 'border-emerald-400 bg-emerald-50/30' : 'border-slate-100 bg-slate-50/30'}`}>
                    
                    {/* Option Header: Selection Button */}
                    <div className="flex items-center justify-between px-1">
                        <button
                            onClick={() => updateQuestion(q.id, { correctAnswer: optIndex })}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                q.correctAnswer === optIndex 
                                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200' 
                                : 'bg-white text-slate-400 border border-slate-200 hover:border-emerald-300 hover:text-emerald-500'
                            }`}
                        >
                            {q.correctAnswer === optIndex ? <CheckCircle2 className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-300" />}
                            <span>Phương án {String.fromCharCode(65 + optIndex)} {q.correctAnswer === optIndex && '(Đúng)'}</span>
                        </button>
                    </div>

                    {/* Rich Text Editor for Option */}
                    <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                        <RichTextEditor
                            value={opt}
                            onChange={(val) => {
                                const newOptions = [...(q.options || [])];
                                newOptions[optIndex] = val;
                                updateQuestion(q.id, { options: newOptions });
                            }}
                            placeholder={`Nhập đáp án ${String.fromCharCode(65 + optIndex)}...`}
                        />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {q.type === QuestionType.SHORT_ANSWER && (
              <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100 relative">
                <BrainCircuit className="w-12 h-12 text-amber-200 absolute right-4 top-4 opacity-50" />
                <p className="text-xs text-amber-700 mb-2 font-bold uppercase tracking-wide">Đáp án mẫu (Dùng để chấm tự động)</p>
                <textarea
                  value={String(q.correctAnswer || '')}
                  onChange={(e) => updateQuestion(q.id, { correctAnswer: e.target.value })}
                  placeholder="Nhập đáp án đúng chính xác (VD: 25cm2)..."
                  className="w-full p-3 bg-white border border-amber-200 rounded-xl text-sm font-medium focus:border-amber-400 focus:ring-2 focus:ring-amber-200 outline-none"
                  rows={2}
                />
                <p className="text-[10px] text-amber-600 mt-2 italic">* Hệ thống sẽ so sánh câu trả lời của học sinh với đáp án này (không phân biệt hoa thường).</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={handleAddQuestion}
        className="w-full py-6 border-2 border-dashed border-slate-300 rounded-[2rem] text-slate-400 font-bold hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 group"
      >
        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
            <Plus className="w-6 h-6" />
        </div>
        Thêm câu hỏi mới
      </button>
    </div>
  );
};

export default QuestionBuilder;