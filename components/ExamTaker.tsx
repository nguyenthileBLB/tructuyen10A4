import React, { useState, useEffect, useRef } from 'react';
import { Exam, QuestionType, Submission } from '../types';
import { saveSubmission, getExamById, getSubmissionsForExam, markDeviceAsSubmitted, exportSubmissionData } from '../services/storageService';
import { p2pService } from '../services/p2pService';
import { Check, ArrowRight, Loader2, Award, Clock, RefreshCw, Lock, XCircle, CheckCircle2, ChevronLeft, AlertTriangle, Radio, Sparkles, Smile, Zap, Plus, PartyPopper, Share2, Copy, Wifi, Hourglass } from 'lucide-react';

interface ExamTakerProps {
  exam: Exam;
  studentName: string;
  team: string;
  onExit: () => void;
  isP2P?: boolean; // New Prop
}

const ExamTaker: React.FC<ExamTakerProps> = ({ exam, studentName, team, onExit, isP2P = false }) => {
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<Submission | null>(null);
  const [isExamEnded, setIsExamEnded] = useState(false);
  
  // State for Waiting Room (Before Start)
  // For P2P: default is FALSE (Wait for teacher signal). For Offline: Check isPublished.
  const [hasStarted, setHasStarted] = useState(isP2P ? false : exam.isPublished); 

  // Share Result State
  const [shareData, setShareData] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // Audio Refs
  const correctAudioRef = useRef<HTMLAudioElement | null>(null);
  const incorrectAudioRef = useRef<HTMLAudioElement | null>(null);

  const currentQuestion = exam.questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === exam.questions.length - 1;

  // Initialize Audio
  useEffect(() => {
      correctAudioRef.current = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-arcade-game-jump-coin-216.mp3');
      incorrectAudioRef.current = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-wrong-answer-fail-notification-946.mp3');
  }, []);

  // Poll Exam Status (Waiting Room -> Start -> End)
  useEffect(() => {
    if (result || isP2P) return; // Disable polling in P2P mode for now
    
    // Tăng tốc độ kiểm tra lên 1000ms (1 giây) để học sinh vào thi ngay lập tức
    const interval = setInterval(() => {
        const currentExamState = getExamById(exam.id);
        if (currentExamState) {
            if (!hasStarted && currentExamState.isPublished) setHasStarted(true);
            if (hasStarted && !currentExamState.isPublished) setIsExamEnded(true);
        }
    }, 1000); 
    return () => clearInterval(interval);
  }, [exam.id, hasStarted, result, isP2P]);

  // Handle P2P Events (HOST_ENDED, START_EXAM)
  useEffect(() => {
      if (!isP2P) return;
      
      const handleData = (msg: any) => {
          if (msg.type === 'HOST_ENDED') {
              // ALWAYS set ended to true when teacher stops
              setIsExamEnded(true);

              if (!result && !isSubmitting) {
                  alert("Giáo viên đã kết thúc bài thi! Hệ thống đang nộp bài của bạn...");
                  // Use a timeout to break out of current render cycle and avoid conflicts
                  setTimeout(() => submitExam(true), 100); // Pass flag to indicate forced submission
              }
          }
          if (msg.type === 'START_EXAM') {
              setHasStarted(true);
          }
      };

      p2pService.onData(handleData);
      
      // Cleanup happens in parent or p2p service logic
  }, [isP2P, result, isSubmitting, answers]);


  // Check initial Submission (Re-login)
  useEffect(() => {
      // In P2P mode, we don't load from local storage to avoid confusion
      if (isP2P) return;

      const existingSubmissions = getSubmissionsForExam(exam.id);
      const mySubmission = existingSubmissions.find(s => s.studentName.toLowerCase() === studentName.toLowerCase());
      if (mySubmission) {
          setResult(mySubmission);
          setAnswers(mySubmission.answers as Record<string, string | number>);
      }
  }, [exam.id, studentName, isP2P]);

  // Polling Effect for Results
  useEffect(() => {
    if (result && !isExamEnded && !isP2P) {
        const interval = setInterval(() => {
            const currentExamState = getExamById(exam.id);
            if (currentExamState && !currentExamState.isPublished) setIsExamEnded(true); 
        }, 2000); 
        return () => clearInterval(interval);
    }
  }, [result, isExamEnded, exam.id, isP2P]);

  // Init timer
  useEffect(() => {
    if (currentQuestion && hasStarted) setTimeLeft(currentQuestion.timeLimit || 60);
  }, [currentQuestionIndex, currentQuestion, hasStarted]);

  // Countdown logic
  useEffect(() => {
    if (result || isSubmitting || !hasStarted) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleNextOrSubmit(true); 
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [currentQuestionIndex, result, isSubmitting, hasStarted]);

  // REAL-TIME SCORING LOGIC
  useEffect(() => {
      if (!isP2P || !hasStarted || result) return;

      // Calculate score locally based on current answers
      let currentScore = 0;
      for (const q of exam.questions) {
          const answer = answers[q.id];
          if (answer === undefined) continue;

          if (q.type === QuestionType.MULTIPLE_CHOICE) {
              if (answer === q.correctAnswer) currentScore += q.points;
          } else if (q.type === QuestionType.SHORT_ANSWER) {
              if (String(answer).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase()) {
                  currentScore += q.points;
              }
          }
      }

      // Send update to Host
      p2pService.send({
          type: 'LIVE_SCORE_UPDATE',
          payload: {
              studentName,
              team,
              currentScore // Send the TOTAL current score, host will update the map
          }
      });

  }, [answers, exam.questions, isP2P, hasStarted, result, studentName, team]);


  const handleAnswer = (value: string | number) => {
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: value }));
    
    // Play Sound Effect for Multiple Choice immediately
    if (currentQuestion.type === QuestionType.MULTIPLE_CHOICE) {
        if (value === currentQuestion.correctAnswer) {
             correctAudioRef.current?.play().catch(() => {});
        } else {
             incorrectAudioRef.current?.play().catch(() => {});
        }
    }
  };

  const handleNextOrSubmit = async (auto = false) => {
    if (!isLastQuestion) {
        setCurrentQuestionIndex(prev => prev + 1);
        return;
    }
    await submitExam();
  };

  const submitExam = async (forcedByHost = false) => {
    setIsSubmitting(true);
    let totalScore = 0;
    let maxScore = 0;
    const feedback: Record<string, string> = {};

    try {
      for (const q of exam.questions) {
        maxScore += q.points;
        const answer = answers[q.id];

        if (q.type === QuestionType.MULTIPLE_CHOICE) {
          if (answer === q.correctAnswer) totalScore += q.points; 
        } else if (q.type === QuestionType.SHORT_ANSWER) {
          if (String(answer).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase()) {
              totalScore += q.points;
              feedback[q.id] = "Chính xác (Tự động)";
          } else {
              feedback[q.id] = "Chưa chính xác / Cần chấm tay";
          }
        }
      }

      const submission: Submission = {
        id: crypto.randomUUID(),
        examId: exam.id,
        studentName,
        team,
        answers,
        score: totalScore,
        maxScore,
        feedback,
        submittedAt: Date.now()
      };

      if (isP2P) {
          // Send to Teacher
          p2pService.send({ type: 'SUBMIT_EXAM', payload: submission });
          // If forced by host ending, make sure we show results immediately
          if (forcedByHost) setIsExamEnded(true);
      } else {
          saveSubmission(submission);
          markDeviceAsSubmitted(exam.id); // LOCK DEVICE
      }
      
      setResult(submission);
    } catch (e) {
      alert("Nộp bài thất bại. Vui lòng kiểm tra kết nối mạng.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExitRequest = () => {
      if (result) {
          onExit();
      } else {
          if (window.confirm("Bạn có chắc muốn thoát? Kết quả bài làm của bạn sẽ KHÔNG được lưu.")) {
              onExit();
          }
      }
  }

  const handleShareResult = () => {
      if (!result) return;
      const data = exportSubmissionData(result);
      setShareData(data);
      setShowShareModal(true);
  }

  const copyToClipboard = () => {
      navigator.clipboard.writeText(shareData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  }

  // --- VIEW: WAITING ROOM ---
  if (!hasStarted && !result) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-indigo-50 to-pink-50 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-10 left-10 text-6xl opacity-20 animate-bounce">⏳</div>
            <div className="absolute bottom-20 right-10 text-6xl opacity-20 animate-pulse">🎓</div>

            <div className="bg-white/90 backdrop-blur-md p-10 rounded-[3rem] shadow-2xl border border-white max-w-md w-full text-center relative z-10 animate-fade-in">
                <div className="w-24 h-24 bg-gradient-to-tr from-indigo-400 to-purple-400 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse shadow-lg shadow-indigo-200">
                    <Radio className="w-12 h-12 text-white" />
                </div>
                <h2 className="text-3xl font-extrabold text-indigo-900 mb-2">Phòng Chờ</h2>
                <div className="flex items-center justify-center gap-2 mb-8">
                     <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    <p className="text-indigo-500 font-bold">Đang đợi giáo viên phát đề...</p>
                </div>
                
                <div className="bg-indigo-50/50 rounded-3xl p-6 mb-8 border border-indigo-100">
                    <div className="flex items-center justify-between mb-3 border-b border-indigo-100 pb-2">
                        <span className="text-sm text-indigo-400 font-bold uppercase">Thí sinh</span>
                        <span className="font-extrabold text-indigo-900 text-lg">{studentName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-indigo-400 font-bold uppercase">Đội thi</span>
                        <span className={`font-extrabold text-lg px-3 py-1 rounded-full bg-white shadow-sm ${team.includes('Đỏ') ? 'text-rose-500' : team.includes('Xanh') ? 'text-sky-500' : 'text-slate-700'}`}>{team}</span>
                    </div>
                </div>
                
                <div className="flex items-center justify-center gap-2 text-xs text-slate-400 font-medium">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                    <span>Hệ thống sẽ tự động vào thi khi giáo viên bấm nút.</span>
                </div>
                <button onClick={onExit} className="mt-8 text-sm text-slate-400 hover:text-rose-500 font-bold transition-colors">Thôi không thi nữa (Thoát)</button>
            </div>
        </div>
      );
  }

  // --- VIEW: WAITING FOR RESULT (Result exists but exam NOT ended) ---
  if (result && !isExamEnded) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-sky-50 to-blue-50">
            
            <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-sky-100 max-w-md w-full text-center animate-slide-up">
                <div className="w-20 h-20 bg-sky-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Hourglass className="w-10 h-10 text-sky-600 animate-spin-slow" />
                </div>
                <h2 className="text-2xl font-extrabold text-sky-900 mb-2">Đã Nộp Bài! 🚀</h2>
                <p className="text-slate-500 mb-8 font-medium">Bạn đã hoàn thành bài thi. Kết quả chi tiết sẽ hiển thị ngay khi Giáo viên kết thúc phòng thi.</p>
                
                {isP2P ? (
                     <div className="flex items-center justify-center gap-3 text-sm text-sky-600 bg-sky-50 py-4 px-6 rounded-2xl font-bold border border-sky-100 mb-6">
                        <div className="flex gap-1">
                            <span className="w-2 h-2 bg-sky-500 rounded-full animate-bounce"></span>
                            <span className="w-2 h-2 bg-sky-500 rounded-full animate-bounce delay-100"></span>
                            <span className="w-2 h-2 bg-sky-500 rounded-full animate-bounce delay-200"></span>
                        </div>
                        Đang đợi giáo viên...
                    </div>
                ) : (
                    <div className="flex items-center justify-center gap-3 text-sm text-sky-600 bg-sky-50 py-3 px-6 rounded-2xl animate-pulse font-bold border border-sky-100 mb-6">
                        <RefreshCw className="w-5 h-5 animate-spin" /> Đang cập nhật trạng thái...
                    </div>
                )}
                
                <button onClick={onExit} className="text-sm text-slate-400 hover:text-rose-500 font-bold">Thoát ra trang chủ</button>
            </div>
        </div>
    );
  }

  // --- VIEW: FINAL RESULT (Only shown when result exists AND exam is ended) ---
  if (result && isExamEnded) {
    return (
      <div className="max-w-md mx-auto p-6 text-center space-y-6 pb-20 pt-10">
        <div className="relative">
            <div className="absolute inset-0 bg-yellow-200 blur-2xl opacity-50 rounded-full animate-pulse"></div>
            <div className="w-24 h-24 bg-gradient-to-br from-yellow-300 to-amber-500 rounded-full flex items-center justify-center mx-auto relative shadow-lg shadow-amber-200 border-4 border-white animate-scale-up">
            <Award className="w-12 h-12 text-white" />
            </div>
        </div>
        
        <h2 className="text-3xl font-black text-slate-800 tracking-tight">Tổng Kết Điểm Số</h2>
        
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-indigo-100 border-2 border-indigo-50 relative overflow-hidden group hover:scale-[1.02] transition-transform">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-50 rounded-full opacity-50 group-hover:bg-indigo-100 transition-colors"></div>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Điểm Của Bạn</p>
          <p className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 my-2">{result.score}</p>
          <p className="text-slate-400 font-bold">trên tổng {result.maxScore} điểm</p>
          
          <div className="mt-6 flex flex-col items-center gap-3">
             <div className={`px-4 py-2 rounded-xl text-sm font-bold shadow-sm flex items-center gap-2 ${result.team.includes('Đỏ') ? 'bg-rose-100 text-rose-600' : 'bg-sky-100 text-sky-600'}`}>
                 <Smile className="w-4 h-4" /> Team: {result.team}
             </div>
             {/* Contribution Highlight */}
             <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100 animate-pulse">
                <PartyPopper className="w-4 h-4" />
                <span className="font-bold text-sm">Bạn đã đóng góp +{result.score} điểm!</span>
             </div>
          </div>
        </div>
        
        <div className="text-left space-y-4 max-h-[40vh] overflow-y-auto pr-2 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm custom-scrollbar">
            <h3 className="font-bold text-slate-700 border-b border-slate-100 pb-3 mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-yellow-500" /> Chi tiết bài làm
            </h3>
            {exam.questions.map((q, idx) => (
                <div key={q.id} className="text-sm border-b border-slate-50 last:border-0 pb-4 last:pb-0">
                    <p className="font-bold text-slate-800 mb-2 flex items-start gap-1">
                        <span className="flex-shrink-0">Câu {idx + 1}: </span>
                        {/* Render Rich Text Result */}
                        <span dangerouslySetInnerHTML={{ __html: q.text }} />
                    </p>
                    <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                            <p className="text-slate-500 text-xs mb-1">Trả lời:</p>
                            <p className="font-medium text-slate-800 bg-slate-50 p-2 rounded-lg">{String(result.answers[q.id] ?? 'Không trả lời')}</p>
                        </div>
                        <div className="flex-shrink-0 pt-4">
                            {result.feedback && result.feedback[q.id] ? (
                                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100 block max-w-[100px] text-right">
                                    {result.feedback[q.id]}
                                </span>
                            ) : (
                            <div className={`flex items-center gap-1 font-bold text-xs px-2 py-1 rounded-lg ${result.answers[q.id] === q.correctAnswer ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>
                                {result.answers[q.id] === q.correctAnswer ? <Check className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                {result.answers[q.id] === q.correctAnswer ? `+${q.points}đ` : '0đ'}
                            </div>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>

        {!isP2P && (
            <button onClick={handleShareResult} className="w-full mb-4 py-3 bg-indigo-50 text-indigo-600 rounded-2xl font-bold flex items-center justify-center gap-2 border border-indigo-100 hover:bg-indigo-100 transition-colors">
                <Share2 className="w-4 h-4" /> Chia sẻ kết quả (Backup)
            </button>
        )}

        <button onClick={onExit} className="w-full py-4 bg-slate-800 text-white rounded-2xl font-bold shadow-lg hover:bg-slate-700 transition-all flex items-center justify-center gap-2 transform hover:scale-[1.02]">
          <ChevronLeft className="w-5 h-5" /> Về Trang Chủ
        </button>

         {/* Share Modal */}
         {showShareModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-6">
                    <div className="bg-white rounded-[2rem] max-w-sm w-full p-6 shadow-2xl animate-fade-in">
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Sao chép mã bài làm</h3>
                        <p className="text-xs text-slate-500 mb-4">Copy mã này và gửi cho thầy cô để chấm điểm nhé!</p>
                        <div className="bg-slate-50 p-2 rounded-xl mb-4 relative">
                            <textarea readOnly value={shareData} className="w-full h-24 text-[10px] bg-transparent border-none outline-none resize-none" />
                        </div>
                        <div className="flex gap-2">
                             <button onClick={() => setShowShareModal(false)} className="flex-1 py-2 bg-gray-100 rounded-xl font-bold text-gray-500">Đóng</button>
                             <button onClick={copyToClipboard} className="flex-1 py-2 bg-indigo-500 text-white rounded-xl font-bold flex items-center justify-center gap-1">
                                 {copied ? <Check className="w-4 h-4"/> : <Copy className="w-4 h-4"/>} {copied ? 'Đã Copy' : 'Copy'}
                             </button>
                        </div>
                    </div>
                </div>
            )}
      </div>
    );
  }

  const progressPercentage = ((currentQuestionIndex) / exam.questions.length) * 100;
  const isTimeCritical = timeLeft <= 10;

  // --- VIEW: TAKING EXAM ---
  return (
    <div className="min-h-screen flex flex-col max-w-2xl mx-auto pb-20 bg-slate-50/50">
      <header className="sticky top-4 z-10 mx-4 bg-white/90 backdrop-blur-xl border border-white/50 px-5 py-4 shadow-xl shadow-indigo-100/50 rounded-[2rem]">
        <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3 overflow-hidden">
                <button onClick={handleExitRequest} className="p-2 rounded-full bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-500 transition-colors flex items-center gap-1 pr-3" title="Thoát bài thi">
                    <ChevronLeft className="w-5 h-5" />
                    <span className="text-xs font-bold">Thoát</span>
                </button>
                <div className="overflow-hidden">
                    <h1 className="font-extrabold text-slate-800 truncate text-base">{exam.title}</h1>
                    <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5 font-medium">
                        <span>{studentName}</span>
                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                        <span className={`${team.includes('Đỏ') ? 'text-rose-500' : 'text-sky-500'}`}>{team}</span>
                        {/* P2P Indicator */}
                        {isP2P && <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600 font-bold text-[10px]"><Wifi className="w-3 h-3" /> Live</span>}
                    </div>
                </div>
            </div>
            
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border shadow-sm transition-all ${isTimeCritical ? 'bg-rose-50 border-rose-200 text-rose-600 animate-pulse scale-105' : 'bg-indigo-50 border-indigo-100 text-indigo-600'}`}>
                <Clock className="w-4 h-4" />
                <span className="font-mono font-bold w-6 text-center">{timeLeft}</span>
            </div>
        </div>
        
        {/* Cute Progress Bar */}
        <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden w-full">
             <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full transition-all duration-500 ease-out flex items-center justify-end pr-1" style={{ width: `${progressPercentage}%` }}>
                 {progressPercentage > 5 && <div className="w-1.5 h-1.5 bg-white/50 rounded-full animate-pulse"></div>}
             </div>
        </div>
      </header>

      <div className="flex-1 px-6 py-6 flex flex-col justify-center">
        <div className="flex justify-center mb-6">
             <span className="text-xs font-bold text-indigo-500 bg-white border border-indigo-100 px-4 py-2 rounded-2xl shadow-sm uppercase tracking-wide">
                Câu Hỏi {currentQuestionIndex + 1} / {exam.questions.length}
            </span>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-xl shadow-indigo-100/50 border border-white p-8 mb-8 relative">
            <div className="absolute -top-3 -right-3 bg-amber-400 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-lg transform rotate-3 border-2 border-white">
                {currentQuestion.points} Điểm
            </div>
            
            {/* RICH TEXT RENDERER */}
            <div 
                className="text-xl text-slate-800 font-bold leading-relaxed mb-8 prose max-w-none"
                dangerouslySetInnerHTML={{ __html: currentQuestion.text }}
            />
            
            {currentQuestion.type === QuestionType.MULTIPLE_CHOICE ? (
            <div className="space-y-4">
                {currentQuestion.options?.map((opt, i) => (
                <button key={i} onClick={() => handleAnswer(i)} className={`w-full text-left p-5 rounded-3xl border-2 transition-all duration-200 active:scale-95 group ${answers[currentQuestion.id] === i ? 'border-indigo-500 bg-indigo-50 shadow-lg shadow-indigo-200/50' : 'border-slate-100 bg-white hover:border-indigo-200 hover:shadow-md'}`}>
                    <div className="flex items-center gap-5">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors flex-shrink-0 font-bold text-lg shadow-sm ${answers[currentQuestion.id] === i ? 'bg-indigo-500 text-white shadow-indigo-300' : 'bg-slate-100 text-slate-400 group-hover:bg-white group-hover:text-indigo-400'}`}>
                        {answers[currentQuestion.id] === i ? <Check className="w-6 h-6" /> : String.fromCharCode(65 + i)}
                    </div>
                    <span className="text-lg font-medium text-slate-600" dangerouslySetInnerHTML={{ __html: opt }}></span>
                    </div>
                </button>
                ))}
            </div>
            ) : (
            <textarea
                value={String(answers[currentQuestion.id] || '')}
                onChange={(e) => handleAnswer(e.target.value)}
                className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-3xl focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none text-lg transition-all text-slate-700 placeholder-slate-400"
                rows={6}
                placeholder="Nhập câu trả lời tuyệt vời của bạn vào đây..."
            />
            )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-lg border-t border-slate-100 flex justify-center z-20">
        <div className="max-w-2xl w-full flex justify-end">
             {isSubmitting ? (
                 <button disabled className="px-10 py-4 bg-slate-300 text-white rounded-3xl font-bold flex items-center gap-3 w-full justify-center cursor-not-allowed">
                     <Loader2 className="animate-spin w-5 h-5" /> Đang gửi bài...
                 </button>
             ) : (
                <button onClick={() => handleNextOrSubmit(false)} className={`px-10 py-4 rounded-[1.5rem] font-bold shadow-lg shadow-indigo-200 flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95 w-full md:w-auto text-lg ${isLastQuestion ? 'bg-gradient-to-r from-emerald-400 to-teal-500 text-white' : 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white'}`}>
                    {isLastQuestion ? 'Nộp Bài Luôn' : 'Câu Tiếp Theo'}
                    {isLastQuestion ? <CheckCircle2 className="w-6 h-6" /> : <ArrowRight className="w-6 h-6" />}
                </button>
             )}
        </div>
      </div>
    </div>
  );
};

export default ExamTaker;