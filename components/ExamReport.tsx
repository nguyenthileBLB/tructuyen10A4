import React, { useMemo, useState } from 'react';
import { Exam, Submission, QuestionType } from '../types';
import { getSubmissionsForExam, deleteSubmission } from '../services/storageService';
import { BarChart, Users, ChevronLeft, Award, AlertTriangle, CheckCircle2, XCircle, FileSpreadsheet, Search, Filter, Crown, Star, Sparkles, Trash2, Eye, X } from 'lucide-react';

interface ExamReportProps {
  exam: Exam;
  onBack: () => void;
}

const ExamReport: React.FC<ExamReportProps> = ({ exam, onBack }) => {
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>(() => getSubmissionsForExam(exam.id));
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTeam, setFilterTeam] = useState<string>('ALL');
  
  // State for Detail View Modal
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);

  // Helper to delete submission
  const handleDeleteSubmission = (id: string, name: string) => {
      if(confirm(`Bạn có chắc muốn xoá bài làm của "${name}" không?`)) {
          deleteSubmission(id);
          setAllSubmissions(getSubmissionsForExam(exam.id));
      }
  }

  // Tính toán thống kê tổng quan
  const stats = useMemo(() => {
    if (allSubmissions.length === 0) return null;

    const totalScore = allSubmissions.reduce((sum, s) => sum + s.score, 0);
    const avgScore = totalScore / allSubmissions.length;
    const maxScore = Math.max(...allSubmissions.map(s => s.score));
    const minScore = Math.min(...allSubmissions.map(s => s.score));

    // Tính điểm theo đội và số lượng thành viên
    const teamScores: Record<string, number> = {};
    const teamCounts: Record<string, number> = {};
    
    allSubmissions.forEach(s => {
      const team = s.team || 'Khác';
      teamScores[team] = (teamScores[team] || 0) + s.score;
      teamCounts[team] = (teamCounts[team] || 0) + 1;
    });

    // Phân tích câu hỏi (Pedagogical Insight)
    const questionAnalysis = exam.questions.map(q => {
      let correctCount = 0;
      let totalPointsEarned = 0;

      allSubmissions.forEach(sub => {
        const answer = sub.answers[q.id];
        if (q.type === QuestionType.MULTIPLE_CHOICE) {
          if (answer === q.correctAnswer) correctCount++;
        }
         if (q.type === QuestionType.MULTIPLE_CHOICE && answer === q.correctAnswer) {
             totalPointsEarned += q.points;
         }
      });

      const accuracy = allSubmissions.length > 0 
        ? (q.type === QuestionType.MULTIPLE_CHOICE ? (correctCount / allSubmissions.length) * 100 : 0) // Chỉ tính chính xác cho trắc nghiệm đơn giản
        : 0;

      return {
        ...q,
        accuracy,
        correctCount
      };
    });

    // Sắp xếp câu hỏi theo độ khó (tỉ lệ đúng thấp nhất lên đầu)
    const difficultQuestions = [...questionAnalysis]
        .filter(q => q.type === QuestionType.MULTIPLE_CHOICE)
        .sort((a, b) => a.accuracy - b.accuracy)
        .slice(0, 3); // Top 3 câu khó nhất

    return {
      avgScore,
      maxScore,
      minScore,
      teamScores,
      teamCounts,
      difficultQuestions,
      questionAnalysis
    };
  }, [allSubmissions, exam]);

  const filteredSubmissions = useMemo(() => {
      return allSubmissions
        .filter(s => s.studentName.toLowerCase().includes(searchTerm.toLowerCase()))
        .filter(s => filterTeam === 'ALL' || s.team === filterTeam)
        .sort((a, b) => b.score - a.score);
  }, [allSubmissions, searchTerm, filterTeam]);

  const getTeamColor = (name: string) => {
    if (name.includes('Đỏ')) return 'bg-red-100 text-red-700 border-red-200';
    if (name.includes('Xanh') && !name.includes('Lá')) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (name.includes('Xanh Dương')) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (name.includes('Xanh Lá')) return 'bg-green-100 text-green-700 border-green-200';
    if (name.includes('Vàng')) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    if (name.includes('Tím')) return 'bg-purple-100 text-purple-700 border-purple-200';
    if (name.includes('Cam')) return 'bg-orange-100 text-orange-700 border-orange-200';
    return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const getTeamStyleCute = (name: string) => {
      if (name.includes('Đỏ')) return { gradient: 'from-rose-400 to-red-500', shadow: 'shadow-red-200', text: 'text-red-600', emoji: '🍎' };
      if (name.includes('Xanh Dương') || name.includes('Xanh')) return { gradient: 'from-cyan-400 to-blue-500', shadow: 'shadow-blue-200', text: 'text-blue-600', emoji: '🐳' };
      if (name.includes('Xanh Lá')) return { gradient: 'from-emerald-400 to-green-500', shadow: 'shadow-green-200', text: 'text-green-600', emoji: '🐸' };
      if (name.includes('Vàng')) return { gradient: 'from-yellow-300 to-amber-500', shadow: 'shadow-yellow-200', text: 'text-yellow-600', emoji: '⭐' };
      if (name.includes('Tím')) return { gradient: 'from-purple-400 to-violet-600', shadow: 'shadow-purple-200', text: 'text-purple-600', emoji: '🍇' };
      if (name.includes('Cam')) return { gradient: 'from-orange-300 to-orange-500', shadow: 'shadow-orange-200', text: 'text-orange-600', emoji: '🍊' };
      return { gradient: 'from-gray-400 to-gray-600', shadow: 'shadow-gray-200', text: 'text-gray-600', emoji: '🛡️' };
  };

  // Helper render Podium
  const renderPodium = () => {
      const sortedTeams = (Object.entries(stats?.teamScores || {}) as [string, number][]).sort(([,a], [,b]) => b - a);
      if (sortedTeams.length === 0) return null;

      const top3 = sortedTeams.slice(0, 3);
      // Reorder for podium: 2nd, 1st, 3rd (Left, Center, Right)
      const podiumOrder = [];
      if (top3[1]) podiumOrder.push({ ...getTeamStyleCute(top3[1][0]), name: top3[1][0], score: top3[1][1], rank: 2, height: 'h-24 md:h-32' });
      if (top3[0]) podiumOrder.push({ ...getTeamStyleCute(top3[0][0]), name: top3[0][0], score: top3[0][1], rank: 1, height: 'h-32 md:h-48' });
      if (top3[2]) podiumOrder.push({ ...getTeamStyleCute(top3[2][0]), name: top3[2][0], score: top3[2][1], rank: 3, height: 'h-20 md:h-24' });

      return (
          <div className="flex items-end justify-center gap-2 md:gap-4 mb-6 pt-6">
              {podiumOrder.map((team) => (
                  <div key={team.name} className="flex flex-col items-center group relative">
                      {team.rank === 1 && <Crown className="w-8 h-8 text-yellow-500 absolute -top-12 animate-bounce" fill="currentColor" />}
                      {team.rank === 1 && <Sparkles className="w-6 h-6 text-yellow-400 absolute -top-8 -right-6 animate-pulse" />}
                      
                      <div className="mb-2 text-center">
                          <span className="text-2xl filter drop-shadow-md">{team.emoji}</span>
                          <p className={`font-bold text-xs md:text-sm mt-1 truncate max-w-[80px] md:max-w-[100px] ${team.text}`}>{team.name}</p>
                          <p className="font-extrabold text-gray-800 text-sm">{team.score}</p>
                      </div>
                      
                      <div className={`w-20 md:w-24 ${team.height} rounded-t-xl bg-gradient-to-b ${team.gradient} shadow-lg ${team.shadow} flex items-end justify-center pb-4 text-white font-bold text-2xl border-t border-white/30 transition-all group-hover:scale-105`}>
                          <span className="opacity-80">{team.rank}</span>
                      </div>
                  </div>
              ))}
          </div>
      );
  };

  // --- RENDER DETAIL MODAL ---
  const renderDetailModal = () => {
      if (!selectedSubmission) return null;

      return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white rounded-[2rem] w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl animate-slide-up border border-white/20">
                  {/* Header */}
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/80 rounded-t-[2rem]">
                      <div>
                          <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                              {selectedSubmission.studentName}
                              <span className={`text-xs px-2 py-1 rounded-lg border ${getTeamColor(selectedSubmission.team)}`}>
                                  {selectedSubmission.team}
                              </span>
                          </h3>
                          <div className="flex items-center gap-3 mt-2 text-sm">
                               <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">
                                   Tổng điểm: {selectedSubmission.score}/{selectedSubmission.maxScore}
                               </span>
                               <span className="text-slate-400">
                                   Nộp lúc: {new Date(selectedSubmission.submittedAt).toLocaleTimeString()}
                               </span>
                          </div>
                      </div>
                      <button 
                        onClick={() => setSelectedSubmission(null)}
                        className="p-2 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-full transition-colors border border-slate-200"
                      >
                          <X className="w-6 h-6" />
                      </button>
                  </div>

                  {/* Content */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-white">
                      {exam.questions.map((q, idx) => {
                          const answer = selectedSubmission.answers[q.id];
                          const isCorrect = q.type === QuestionType.MULTIPLE_CHOICE 
                            ? answer === q.correctAnswer
                            : String(answer || '').trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase();
                          
                          // Display Logic
                          let studentAnswerDisplay: React.ReactNode = String(answer ?? "Chưa làm");
                          let correctAnswerDisplay: React.ReactNode = String(q.correctAnswer);

                          if (q.type === QuestionType.MULTIPLE_CHOICE) {
                              if (typeof answer === 'number' && q.options) {
                                  studentAnswerDisplay = q.options[answer];
                              }
                              if (typeof q.correctAnswer === 'number' && q.options) {
                                  correctAnswerDisplay = q.options[q.correctAnswer];
                              }
                          }

                          return (
                              <div key={q.id} className={`p-5 rounded-2xl border-2 transition-all ${isCorrect ? 'border-emerald-100 bg-emerald-50/30' : 'border-rose-100 bg-rose-50/30'}`}>
                                  <div className="flex justify-between items-start mb-3">
                                      <span className={`text-xs font-black px-3 py-1 rounded-lg uppercase tracking-wider ${isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                          Câu {idx + 1}
                                      </span>
                                      <span className={`font-bold text-sm flex items-center gap-1 ${isCorrect ? 'text-emerald-600' : 'text-rose-500'}`}>
                                          {isCorrect ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                          {isCorrect ? `+${q.points} điểm` : '0 điểm'}
                                      </span>
                                  </div>
                                  
                                  {/* Rich Text Question */}
                                  <div 
                                      className="font-bold text-slate-800 mb-4 text-lg prose max-w-none" 
                                      dangerouslySetInnerHTML={{ __html: q.text }} 
                                  />

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                          <p className="text-xs text-slate-400 font-bold uppercase mb-1">Bài làm của trò</p>
                                          <p className={`font-medium ${isCorrect ? 'text-emerald-700' : 'text-rose-600'}`}>
                                              {studentAnswerDisplay}
                                          </p>
                                      </div>
                                      <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                          <p className="text-xs text-slate-400 font-bold uppercase mb-1">Đáp án đúng</p>
                                          <p className="font-medium text-emerald-700">
                                              {correctAnswerDisplay}
                                          </p>
                                      </div>
                                  </div>
                                  
                                  {/* AI Feedback if any */}
                                  {selectedSubmission.feedback && selectedSubmission.feedback[q.id] && (
                                      <div className="mt-3 text-sm text-indigo-600 bg-white/50 p-3 rounded-xl border border-indigo-100 flex gap-2">
                                          <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                          <span>{selectedSubmission.feedback[q.id]}</span>
                                      </div>
                                  )}
                              </div>
                          );
                      })}
                  </div>
              </div>
          </div>
      )
  }

  if (allSubmissions.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="mb-4 text-gray-400"><Users className="w-12 h-12 mx-auto" /></div>
        <h3 className="text-xl font-bold text-gray-700">Chưa có dữ liệu báo cáo</h3>
        <p className="text-gray-500 mb-6">Chưa có học sinh nào nộp bài cho đề thi này.</p>
        <button onClick={onBack} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium">Quay lại</button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 pb-20">
      {/* Detail Modal */}
      {renderDetailModal()}

      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ChevronLeft className="w-6 h-6 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Báo Cáo Kết Quả: {exam.title}</h1>
          <p className="text-gray-500 text-sm">Mã đề: {exam.code} • {allSubmissions.length} bài nộp</p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-indigo-100">
          <p className="text-sm text-gray-500 mb-1">Điểm Trung Bình</p>
          <p className="text-3xl font-bold text-indigo-600">{stats?.avgScore.toFixed(1)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-green-100">
          <p className="text-sm text-gray-500 mb-1">Điểm Cao Nhất</p>
          <p className="text-3xl font-bold text-green-600">{stats?.maxScore}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-red-100">
          <p className="text-sm text-gray-500 mb-1">Điểm Thấp Nhất</p>
          <p className="text-3xl font-bold text-red-500">{stats?.minScore}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-blue-100">
          <p className="text-sm text-gray-500 mb-1">Tham Gia</p>
          <p className="text-3xl font-bold text-blue-600">{allSubmissions.length} <span className="text-sm font-normal text-gray-400">HS</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Analysis */}
        <div className="lg:col-span-2 space-y-8">
            
          {/* Pedagogical Insights: Difficult Questions */}
          <div className="bg-white rounded-xl shadow-sm border border-orange-200 overflow-hidden">
            <div className="bg-orange-50 px-6 py-4 border-b border-orange-100 flex items-center gap-2">
               <AlertTriangle className="w-5 h-5 text-orange-600" />
               <h3 className="font-bold text-orange-900">Phân Tích Sư Phạm: Vấn Đề Cần Lưu Ý</h3>
            </div>
            <div className="p-6">
                <p className="text-gray-600 mb-4 text-sm">
                    Dưới đây là những câu hỏi có tỉ lệ làm đúng thấp nhất. Giáo viên nên cân nhắc giảng lại các kiến thức liên quan đến những câu hỏi này.
                </p>
                <div className="space-y-4">
                    {stats?.difficultQuestions.map((q, idx) => (
                        <div key={q.id} className="flex gap-4 p-3 rounded-lg bg-gray-50 border border-gray-100">
                            <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-orange-100 text-orange-600 font-bold rounded-full text-sm">
                                {idx + 1}
                            </div>
                            <div className="flex-1">
                                <div 
                                    className="font-medium text-gray-800 text-sm mb-1 prose max-w-none" 
                                    dangerouslySetInnerHTML={{ __html: q.text }}
                                />
                                <div className="flex items-center gap-4 text-xs">
                                    <span className="text-red-500 font-semibold">Chỉ {q.accuracy.toFixed(0)}% làm đúng</span>
                                    <span className="text-gray-400">Dạng: {q.type === QuestionType.MULTIPLE_CHOICE ? 'Trắc nghiệm' : 'Tự luận'}</span>
                                </div>
                                {q.type === QuestionType.MULTIPLE_CHOICE && (
                                    <p className="text-xs text-green-600 mt-1">Đáp án đúng: {q.options?.[Number(q.correctAnswer)]}</p>
                                )}
                            </div>
                        </div>
                    ))}
                    {stats?.difficultQuestions.length === 0 && (
                        <p className="text-green-600 font-medium text-center">Tuyệt vời! Hầu hết học sinh đều làm tốt các câu hỏi.</p>
                    )}
                </div>
            </div>
          </div>

          {/* Student List Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[600px]">
            <div className="px-6 py-4 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                <h3 className="font-bold text-gray-800 flex items-center gap-2 whitespace-nowrap">
                    <FileSpreadsheet className="w-5 h-5 text-indigo-600" /> Bảng Điểm Chi Tiết
                </h3>
                
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Tìm tên học sinh..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <select 
                        value={filterTeam}
                        onChange={(e) => setFilterTeam(e.target.value)}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="ALL">Tất cả đội</option>
                        {Object.keys(stats?.teamScores || {}).map(team => (
                            <option key={team} value={team}>{team}</option>
                        ))}
                    </select>
                </div>
            </div>
            
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm text-left relative">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-6 py-3 bg-gray-50">Học Sinh</th>
                    <th className="px-6 py-3 bg-gray-50">Đội</th>
                    <th className="px-6 py-3 bg-gray-50 text-center">Điểm Số</th>
                    <th className="px-6 py-3 bg-gray-50 text-right">Thời gian</th>
                    <th className="px-6 py-3 bg-gray-50 text-center">Chi tiết</th>
                    <th className="px-6 py-3 bg-gray-50 text-center">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredSubmissions.length > 0 ? (
                      filteredSubmissions.map((sub) => (
                        <tr key={sub.id} className="hover:bg-gray-50 transition-colors group">
                        <td className="px-6 py-4 font-medium text-gray-900">{sub.studentName}</td>
                        <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded text-xs font-semibold border ${getTeamColor(sub.team)}`}>
                                {sub.team}
                            </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                            <span className={`font-bold ${sub.score >= (stats?.avgScore || 0) ? 'text-green-600' : 'text-orange-500'}`}>
                                {sub.score}
                            </span>
                            <span className="text-gray-400 text-xs">/{sub.maxScore}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                            <span className="text-xs text-gray-400">{new Date(sub.submittedAt).toLocaleTimeString()}</span>
                        </td>
                         <td className="px-6 py-4 text-center">
                             <button 
                                onClick={() => setSelectedSubmission(sub)}
                                className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Xem chi tiết bài làm"
                             >
                                 <Eye className="w-5 h-5" />
                             </button>
                        </td>
                        <td className="px-6 py-4 text-center">
                             <button 
                                onClick={() => handleDeleteSubmission(sub.id, sub.studentName)}
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                title="Xóa bài làm này"
                             >
                                 <Trash2 className="w-4 h-4" />
                             </button>
                        </td>
                        </tr>
                    ))
                  ) : (
                      <tr>
                          <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                              Không tìm thấy kết quả phù hợp
                          </td>
                      </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-500 text-right">
                Hiển thị {filteredSubmissions.length} / {allSubmissions.length} học sinh
            </div>
          </div>
        </div>

        {/* Right Column: Team & Stats */}
        <div className="space-y-8">
            {/* CUTE PODIUM & LEADERBOARD */}
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-indigo-100 bg-gradient-to-b from-white to-indigo-50/50">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center gap-2 text-lg">
                        <Award className="w-6 h-6 text-indigo-500" /> Bảng Vinh Danh
                    </h3>
                    <Star className="w-5 h-5 text-yellow-400 fill-current animate-spin-slow" />
                </div>
                
                {/* PODIUM */}
                {renderPodium()}

                {/* List of remaining teams */}
                <div className="space-y-3 mt-4 border-t border-indigo-100 pt-4">
                    {(Object.entries(stats?.teamScores || {}) as [string, number][])
                        .sort(([,a], [,b]) => b - a)
                        .slice(3) // Skip top 3
                        .map(([team, score], idx) => {
                            const style = getTeamStyleCute(team);
                            return (
                                <div key={team} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500 text-sm">
                                        {idx + 4}
                                    </div>
                                    <div className="flex-1">
                                        <p className={`font-bold text-sm ${style.text} flex items-center gap-1`}>
                                            {style.emoji} {team}
                                        </p>
                                    </div>
                                    <span className="font-extrabold text-gray-800">{score}đ</span>
                                </div>
                            );
                        })
                    }
                     {(Object.entries(stats?.teamScores || {})).length === 0 && (
                         <div className="text-center text-gray-400 text-sm italic py-4">Chưa có đội nào ghi điểm</div>
                     )}
                </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-2xl text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-2xl"></div>
                <h3 className="font-bold text-white mb-3 text-lg flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-yellow-300" /> Đề Xuất Sư Phạm
                </h3>
                <ul className="text-sm text-indigo-100 space-y-3">
                    <li className="flex gap-2">
                        <span className="bg-white/20 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                        <span>Khen ngợi đội <strong>{(Object.entries(stats?.teamScores || {}) as [string, number][]).sort((a,b) => b[1] - a[1])[0]?.[0]}</strong> vì thành tích xuất sắc! 🎉</span>
                    </li>
                    <li className="flex gap-2">
                         <span className="bg-white/20 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                        <span>Tổ chức ôn tập lại Top 3 câu hỏi có tỉ lệ sai nhiều nhất.</span>
                    </li>
                    <li className="flex gap-2">
                         <span className="bg-white/20 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                        <span>Động viên các bạn có điểm dưới {stats?.avgScore.toFixed(0)} điểm cố gắng hơn.</span>
                    </li>
                </ul>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ExamReport;