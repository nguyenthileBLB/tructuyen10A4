

import React, { useState, useEffect, useRef, useMemo } from 'react';
import mammoth from 'mammoth';
import { Exam, Question, Team, ExamGenerationConfig, Submission, QuestionType } from '../types';
import { saveExam, getExams, generateExamCode, deleteExam, getSubmissionsForExam, getTeamScores, getTeams, saveTeams, saveAudioToDB, deleteAudioFromDB, exportExamData, saveSubmission, getAudioFromDB } from '../services/storageService';
import { p2pService, generateRoomId } from '../services/p2pService';
import QRCode from 'qrcode';
import QuestionBuilder from './QuestionBuilder';
import ExamReport from './ExamReport';
import { Plus, BookOpen, ChevronLeft, Save, Trash2, Users, Play, BarChart2, Settings, Music, Upload, Link as LinkIcon, Share2, Copy, Sparkles, LayoutDashboard, X, Wifi, Loader2, Trophy, Zap, Crown, FileJson, FileText, Volume2, VolumeX, Power, MousePointerClick, LogOut, MonitorPlay } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';

interface TeacherDashboardProps {
  onBack: () => void;
}

const COLOR_OPTIONS = [
    { label: 'Đỏ', value: 'bg-red-500 text-white', ring: 'ring-red-200', bar: 'bg-red-500', icon: '🍎' },
    { label: 'Xanh Dương', value: 'bg-blue-500 text-white', ring: 'ring-blue-200', bar: 'bg-blue-500', icon: '🐳' },
    { label: 'Xanh Lá', value: 'bg-green-500 text-white', ring: 'ring-green-200', bar: 'bg-green-500', icon: '🐸' },
    { label: 'Vàng', value: 'bg-yellow-400 text-yellow-900', ring: 'ring-yellow-200', bar: 'bg-yellow-400', icon: '⭐' },
    { label: 'Tím', value: 'bg-purple-500 text-white', ring: 'ring-purple-200', bar: 'bg-purple-500', icon: '🍇' },
    { label: 'Cam', value: 'bg-orange-500 text-white', ring: 'ring-orange-200', bar: 'bg-orange-500', icon: '🍊' },
    { label: 'Hồng', value: 'bg-pink-500 text-white', ring: 'ring-pink-200', bar: 'bg-pink-500', icon: '🌸' },
    { label: 'Xám', value: 'bg-gray-500 text-white', ring: 'ring-gray-200', bar: 'bg-gray-500', icon: '🛡️' },
];

// Helper: Parse HTML from Word into Multiple Choice Questions
const parseWordHtmlToQuestions = (html: string): Question[] => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Mammoth converts paragraphs to <p>, lists to <ul><li>, tables to <table><tr><td>
    // We select all blocks that might contain text
    const nodes = Array.from(doc.body.querySelectorAll('p, li, td, h1, h2, h3, div'));
    
    const questions: Question[] = [];
    let currentQ: Partial<Question> | null = null;
    let currentOptions: string[] = [];
    let currentAnswerChar = '';

    const saveCurrentQuestion = () => {
        if (currentQ && currentQ.text) {
             const q: Question = {
                 id: crypto.randomUUID(),
                 text: currentQ.text,
                 type: QuestionType.MULTIPLE_CHOICE,
                 options: [...currentOptions],
                 correctAnswer: 0,
                 points: 10,
                 timeLimit: 60
             };

             // Pad options if fewer than 4
             while (q.options!.length < 4) {
                 q.options!.push('');
             }
             q.options = q.options!.slice(0, 4);

             if (currentAnswerChar) {
                 const map: Record<string, number> = {'A': 0, 'B': 1, 'C': 2, 'D': 3};
                 const idx = map[currentAnswerChar.toUpperCase()];
                 if (idx !== undefined) q.correctAnswer = idx;
             }

             questions.push(q);
        }
        currentQ = null;
        currentOptions = [];
        currentAnswerChar = '';
    }

    nodes.forEach(node => {
        let text = node.textContent?.trim() || '';
        text = text.replace(/[\u200B-\u200D\uFEFF]/g, ''); // Remove zero-width spaces
        text = text.replace(/\s+/g, ' '); // Normalize whitespace

        if (!text) return;

        // 1. Detect Question Start
        // Matches "Câu 1:", "1.", "Câu 1."
        const questionMatch = text.match(/^(Câu|Bài|Question)\s*\d+[:\.]|^\d+[\.\)]\s/i);
        if (questionMatch) {
            saveCurrentQuestion();
            // Update text to be just the content, stripping "Câu 1..."
            text = text.substring(questionMatch[0].length).trim();
            currentQ = { text: '' }; // Will fill below or next loop
        }

        // 2. Detect Answer Key
        const keyMatch = text.match(/^(Đáp án|Key|Lời giải|Answer)\s*[:\.]?\s*([A-D])/i);
        if (keyMatch) {
            currentAnswerChar = keyMatch[2];
            return; // Key line usually has nothing else
        }

        // 3. Detect Options (Complex Logic for Inline and Multiline)
        // Check for options pattern: Start of line OR after space, followed by A/B/C/D then dot/paren then space.
        const delimRegex = /(?:^|\s)([A-D])[\.\)]\s/g;
        const matches = [...text.matchAll(delimRegex)];

        if (matches.length > 0) {
            // Found options on this line!
            
            // Check text BEFORE the first option.
            const firstMatchIndex = matches[0].index!;
            const preOptionText = text.substring(0, firstMatchIndex).trim();
            
            if (currentQ) {
                if (preOptionText) {
                    // Append to question text
                    currentQ.text = currentQ.text ? currentQ.text + ' ' + preOptionText : preOptionText;
                }
            }
            
            // Process Options
            matches.forEach((m, i) => {
                 // m[1] is the letter A/B/C/D
                 const matchLen = m[0].length;
                 const startIndex = m.index!;
                 
                 const nextMatch = matches[i+1];
                 const endIndex = nextMatch ? nextMatch.index! : text.length;
                 
                 // Content is between this marker and next marker
                 const content = text.substring(startIndex + matchLen, endIndex).trim();
                 currentOptions.push(content);
            });
            
            return;
        }
        
        // 4. No options found on this line, just text.
        if (currentQ) {
            // Append to what?
            if (currentOptions.length > 0) {
                // We are inside options list (multiline option content)
                currentOptions[currentOptions.length - 1] += ' ' + text;
            } else {
                // We are inside question text
                currentQ.text = currentQ.text ? currentQ.text + ' <br/> ' + text : text;
            }
        }
    });
    
    saveCurrentQuestion();
    return questions;
}

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ onBack }) => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [view, setView] = useState<'LIST' | 'CREATE' | 'EDIT' | 'REPORT' | 'TEAMS'>('LIST');
  const [currentExam, setCurrentExam] = useState<Exam | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [teams, setTeamsList] = useState<Team[]>([]);
  
  // Music State for Modal
  const [musicModalExamId, setMusicModalExamId] = useState<string | null>(null);
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [musicPreviewUrl, setMusicPreviewUrl] = useState<string | null>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);

  // Import State
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const wordInputRef = useRef<HTMLInputElement>(null);

  // --- LIVE HOSTING STATE ---
  const [isHosting, setIsHosting] = useState(false);
  const [isSettingUpHosting, setIsSettingUpHosting] = useState(false); // New state for setup modal
  const [hasStartedGame, setHasStartedGame] = useState(false); // Controls when students see Q1
  const [showStopConfirm, setShowStopConfirm] = useState(false); 
  const [hostingExam, setHostingExam] = useState<Exam | null>(null);
  const [roomId, setRoomId] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  // Use a dictionary to store student info including team
  const [connectedStudents, setConnectedStudents] = useState<Record<string, { name: string, team: string }>>({});
  
  // Updated: We use a Map for real-time scores to handle updates properly
  const [liveStudentScores, setLiveStudentScores] = useState<Record<string, { score: number, team: string }>>({});
  const [latestActivity, setLatestActivity] = useState<string>('');

  // Hosting Music State
  const hostingAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isHostingMusicMuted, setIsHostingMusicMuted] = useState(false);

  // Ref to track game status inside event listeners
  const hasStartedGameRef = useRef(false);

  useEffect(() => {
    loadData();
    return () => {
        // Cleanup P2P on unmount
        p2pService.destroy();
    }
  }, []);

  // Sync ref
  useEffect(() => {
      hasStartedGameRef.current = hasStartedGame;
  }, [hasStartedGame]);


  // Handle Hosting Audio Playback
  useEffect(() => {
      // Only play music if hosting AND game started
      if (isHosting && hasStartedGame && hostingExam?.musicUri) {
          const playMusic = async () => {
              if (!hostingAudioRef.current) {
                  hostingAudioRef.current = new Audio();
                  hostingAudioRef.current.loop = true;
              }

              let src = hostingExam.musicUri || '';
              if (src.startsWith('local-db:')) {
                  const dbKey = src.split(':')[1];
                  try {
                      const blob = await getAudioFromDB(dbKey);
                      if (blob) {
                          src = URL.createObjectURL(blob);
                      }
                  } catch(e) { console.error("Error loading hosting audio", e); return; }
              }

              hostingAudioRef.current.src = src;
              hostingAudioRef.current.play().catch(e => console.log("Autoplay blocked:", e));
          }
          playMusic();
      } else {
          // Cleanup/Pause
          if (hostingAudioRef.current) {
              hostingAudioRef.current.pause();
          }
      }
  }, [isHosting, hasStartedGame, hostingExam]);

  // Handle Mute/Unmute
  useEffect(() => {
      if (hostingAudioRef.current) {
          hostingAudioRef.current.muted = isHostingMusicMuted;
      }
  }, [isHostingMusicMuted]);


  const loadData = () => {
    setExams(getExams());
    setTeamsList(getTeams());
  };

  const handleCreateExam = () => {
    setCurrentExam({
      id: crypto.randomUUID(),
      code: generateExamCode(),
      title: '',
      description: '',
      teacherName: 'Giáo Viên',
      createdAt: Date.now(),
      questions: [],
      isPublished: false,
    });
    setView('CREATE');
  };

  const handleEditExam = async (exam: Exam) => {
    setCurrentExam(exam);
    setView('EDIT');
  };

  const handleDeleteExam = async (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xoá đề thi này? Dữ liệu bài làm của học sinh cũng sẽ bị xoá.')) {
      await deleteExam(id);
      loadData();
    }
  };

  const handleSaveExam = async () => {
    if (!currentExam || !currentExam.title) {
      alert('Vui lòng nhập tên đề thi!');
      return;
    }

    setIsLoading(true);
    try {
        saveExam(currentExam);
        loadData();
        setView('LIST');
    } catch (e) {
        console.error(e);
        alert('Lỗi khi lưu đề thi. Vui lòng thử lại.');
    } finally {
        setIsLoading(false);
    }
  };

  // --- MUSIC MANAGEMENT HANDLERS ---
  const openMusicModal = async (exam: Exam) => {
      setMusicModalExamId(exam.id);
      setMusicFile(null);
      setMusicPreviewUrl(null);

      // Load existing music if available
      if (exam.musicUri && exam.musicUri.startsWith('local-db:')) {
          const dbKey = exam.musicUri.split(':')[1];
          try {
              const blob = await getAudioFromDB(dbKey);
              if (blob) {
                  setMusicPreviewUrl(URL.createObjectURL(blob));
              }
          } catch(e) { console.error("Error loading audio", e); }
      }
  };

  const closeMusicModal = () => {
      setMusicModalExamId(null);
      setMusicFile(null);
      setMusicPreviewUrl(null);
  };

  const handleMusicFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          setMusicFile(file);
          setMusicPreviewUrl(URL.createObjectURL(file));
      }
  };

  const saveMusicChanges = async () => {
      if (!musicModalExamId) return;

      const examToUpdate = exams.find(e => e.id === musicModalExamId);
      if (!examToUpdate) return;

      setIsLoading(true);
      try {
          let musicUri = examToUpdate.musicUri;

          if (musicFile) {
              // Delete old if exists
              try { await deleteAudioFromDB(musicModalExamId); } catch(e){}
              
              // Save new
              await saveAudioToDB(musicModalExamId, musicFile);
              musicUri = `local-db:${musicModalExamId}`;
          } else if (musicPreviewUrl === null) {
              // User deleted music
               try { await deleteAudioFromDB(musicModalExamId); } catch(e){}
               musicUri = undefined;
          }

          const updatedExam = { ...examToUpdate, musicUri };
          saveExam(updatedExam);
          loadData();
          closeMusicModal();
          alert("Đã cập nhật nhạc nền thành công!");
      } catch (e) {
          console.error(e);
          alert("Lỗi khi lưu nhạc.");
      } finally {
          setIsLoading(false);
      }
  };
  
  const removeMusic = () => {
      setMusicFile(null);
      setMusicPreviewUrl(null); // This signals deletion on save
  };


  // --- IMPORT HANDLERS ---

  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const content = event.target?.result as string;
              const data = JSON.parse(content);
              let newQuestions: Question[] = [];

              if (Array.isArray(data)) {
                  newQuestions = data;
              } else if (data.questions && Array.isArray(data.questions)) {
                  newQuestions = data.questions;
              } else {
                  throw new Error("Format không hợp lệ");
              }

              const sanitizedQuestions: Question[] = newQuestions.map(q => ({
                  ...q,
                  id: crypto.randomUUID(),
                  points: q.points || 10,
                  timeLimit: q.timeLimit || 60
              }));

              if (currentExam && sanitizedQuestions.length > 0) {
                  setCurrentExam(prev => prev ? ({ ...prev, questions: [...prev.questions, ...sanitizedQuestions] }) : null);
                  alert(`Đã nhập thành công ${sanitizedQuestions.length} câu hỏi!`);
              } else {
                  alert("Không tìm thấy câu hỏi hợp lệ trong file.");
              }

          } catch (err) {
              console.error(err);
              alert("Lỗi đọc file JSON. Vui lòng kiểm tra định dạng.");
          } finally {
               if(jsonInputRef.current) jsonInputRef.current.value = '';
          }
      };
      reader.readAsText(file);
  };

  const handleWordUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
          setIsLoading(true);
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.convertToHtml({ arrayBuffer });
          const html = result.value;

          const newQuestions = parseWordHtmlToQuestions(html);
          
          if (newQuestions.length > 0) {
               setCurrentExam(prev => prev ? ({ ...prev, questions: [...prev.questions, ...newQuestions] }) : null);
                alert(`Đã tìm thấy ${newQuestions.length} câu hỏi trắc nghiệm!`);
          } else {
               alert("Không tìm thấy câu hỏi trắc nghiệm nào. Vui lòng đảm bảo file Word có dạng:\nCâu 1: Nội dung...\nA. ... B. ...\nĐáp án: A");
          }

      } catch (err) {
          console.error(err);
          alert("Lỗi khi đọc file Word. Hãy thử file khác.");
      } finally {
          setIsLoading(false);
          if (wordInputRef.current) wordInputRef.current.value = '';
      }
  }

  // --- HOSTING SETUP LOGIC ---
  const initiateHosting = (exam: Exam) => {
      setHostingExam(exam);
      setRoomId(generateRoomId()); // Default random ID
      setIsSettingUpHosting(true);
  }

  const launchHosting = async () => {
      if(!hostingExam || !roomId.trim()) return;

      try {
          setIsLoading(true);
          // 1. Close setup modal
          setIsSettingUpHosting(false);
          
          // 2. Init Live State
          setLiveStudentScores({}); 
          setLatestActivity("Đang đợi học sinh...");
          setIsHostingMusicMuted(false); 
          setShowStopConfirm(false);
          setHasStartedGame(false); // Reset start state
          setConnectedStudents({}); // Reset connected
          
          const qrData = await QRCode.toDataURL(roomId);
          setQrCodeUrl(qrData);

          // 3. Start P2P
          await p2pService.initialize("EQ-" + roomId.trim());

          p2pService.onConnection((conn) => {
             // connection logic
          });

          p2pService.onData((msg, conn) => {
              if (msg.type === 'STUDENT_JOIN') {
                  const studentName = msg.payload.name;
                  // Only add to connected list if they have selected a team (PLAYER_READY)
                  // For STUDENT_JOIN (Initial connect), just send them data
                  
                  // SYNC DATA: Send Exam AND Teams to the student
                  p2pService.send({ 
                      type: 'SYNC_EXAM', 
                      payload: { 
                          exam: hostingExam,
                          teams: teams // Send current teams from teacher to student
                      } 
                  }, conn);
              }

              if (msg.type === 'PLAYER_READY') {
                  const { name, team } = msg.payload;
                   setConnectedStudents(prev => ({
                      ...prev,
                      [name]: { name, team }
                   }));
                   
                   // IMPORTANT: If game already started, send START command to late joiner
                   if (hasStartedGameRef.current) {
                        setTimeout(() => {
                            p2pService.send({ type: 'START_EXAM', payload: {} }, conn);
                        }, 500);
                   }
              }

              if (msg.type === 'LIVE_SCORE_UPDATE') {
                  const { studentName, team, currentScore } = msg.payload;
                  setLiveStudentScores(prev => {
                      const oldScore = prev[studentName]?.score || 0;
                      if (currentScore > oldScore) {
                           setLatestActivity(`${studentName} (${team}) vừa ghi điểm! Tổng: ${currentScore}`);
                      }
                      return { ...prev, [studentName]: { score: currentScore, team } };
                  });
              }

              if (msg.type === 'SUBMIT_EXAM') {
                  const submission = msg.payload as Submission;
                  saveSubmission(submission);
                  setLiveStudentScores(prev => ({
                      ...prev,
                      [submission.studentName]: { score: submission.score, team: submission.team }
                  }));
                  setLatestActivity(`${submission.studentName} đã nộp bài hoàn tất!`);
              }
          });

          setIsHosting(true);
      } catch (e) {
          console.error(e);
          alert("Không thể khởi tạo phòng thi Online. Mã phòng có thể đã tồn tại.");
          setIsSettingUpHosting(true); // Reopen setup on failure
      } finally {
          setIsLoading(false);
      }
  }

  const startGame = () => {
      p2pService.send({ type: 'START_EXAM', payload: {} });
      setHasStartedGame(true);
  }

  const handleStopClick = () => {
      setShowStopConfirm(true); // Show custom modal instead of window.confirm
  }

  const confirmStopHosting = () => {
    // 1. Notify students to submit immediately
    p2pService.send({ type: 'HOST_ENDED', payload: {} });

    // 2. Stop Music immediately
    if (hostingAudioRef.current) {
        hostingAudioRef.current.pause();
    }

    // 3. Cleanup after short delay to ensure message sent
    setTimeout(() => {
        p2pService.destroy();
        setIsHosting(false);
        setConnectedStudents({});
        setHostingExam(null);
        setLiveStudentScores({});
        setShowStopConfirm(false);
        setHasStartedGame(false);
    }, 500);
  }

  // --- LIVE SCORE CALCULATION ---
  const liveTeamStats = useMemo(() => {
      const stats: Record<string, number> = {};
      teams.forEach(t => stats[t.name] = 0);
      Object.values(liveStudentScores).forEach(({ score, team }) => {
          const tName = team || 'Khác';
          stats[tName] = (stats[tName] || 0) + score;
      });
      return Object.entries(stats).sort(([,a], [,b]) => b - a);
  }, [liveStudentScores, teams]);

  const maxTeamScore = useMemo(() => {
      if(liveTeamStats.length === 0) return 100;
      return Math.max(...liveTeamStats.map(([, s]) => s), 100); 
  }, [liveTeamStats]);


  // --- TEAMS LOGIC ---
  const handleAddTeam = () => {
      const newTeam: Team = {
          id: `team_${Date.now()}`,
          name: `Đội Mới ${teams.length + 1}`,
          color: 'bg-gray-500 text-white'
      };
      setTeamsList([...teams, newTeam]);
  }

  const updateTeam = (id: string, updates: Partial<Team>) => {
      setTeamsList(teams.map(t => t.id === id ? { ...t, ...updates } : t));
  }

  const deleteTeam = (id: string) => {
      if(confirm("Xoá đội này?")) {
          setTeamsList(teams.filter(t => t.id !== id));
      }
  }

  const saveTeamsChanges = () => {
      saveTeams(teams);
      alert("Đã lưu danh sách đội!");
      setView('LIST');
  }

  if (view === 'REPORT' && currentExam) {
      return <ExamReport exam={currentExam} onBack={() => setView('LIST')} />;
  }

  if (view === 'TEAMS') {
      return (
        <div className="max-w-4xl mx-auto p-6 min-h-screen">
            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => setView('LIST')} className="p-2 hover:bg-gray-100 rounded-full">
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <h1 className="text-2xl font-bold text-gray-800">Quản Lý Đội Thi</h1>
            </div>
            
            <div className="bg-white p-6 rounded-3xl shadow-lg border border-indigo-100 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {teams.map((team) => (
                        <div key={team.id} className="flex items-center gap-3 p-4 border border-slate-200 rounded-2xl bg-slate-50">
                            <input 
                                value={team.name}
                                onChange={(e) => updateTeam(team.id, { name: e.target.value })}
                                className="flex-1 font-bold text-slate-700 bg-transparent border-none focus:ring-0"
                            />
                            <select 
                                value={COLOR_OPTIONS.find(c => c.value === team.color)?.value || team.color}
                                onChange={(e) => updateTeam(team.id, { color: e.target.value })}
                                className="text-xs p-2 rounded-lg border-slate-200"
                            >
                                {COLOR_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                            <div className={`w-8 h-8 rounded-full shadow-sm ${team.color}`}></div>
                            <button onClick={() => deleteTeam(team.id)} className="text-rose-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
                        </div>
                    ))}
                </div>
                <button onClick={handleAddTeam} className="mt-6 w-full py-3 border-2 border-dashed border-slate-300 rounded-2xl text-slate-500 font-bold hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2">
                    <Plus className="w-5 h-5" /> Thêm Đội
                </button>
            </div>
            
            <button onClick={saveTeamsChanges} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg flex items-center gap-2 mx-auto">
                <Save className="w-5 h-5" /> Lưu Thay Đổi
            </button>
        </div>
      )
  }

  if (view === 'CREATE' || view === 'EDIT') {
    if (!currentExam) return null;

    return (
      <div className="max-w-5xl mx-auto p-6 pb-20">
        <div className="flex items-center justify-between mb-8 sticky top-0 bg-white/90 backdrop-blur-md z-20 py-4 px-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
            <button onClick={() => setView('LIST')} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <ChevronLeft className="w-6 h-6 text-slate-600" />
            </button>
            <h1 className="text-xl font-bold text-slate-800 hidden sm:block">
              {view === 'CREATE' ? 'Tạo Đề Thi Mới' : 'Chỉnh Sửa Đề Thi'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
             {/* IMPORT BUTTONS */}
             <div className="flex bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
                <button
                    onClick={() => wordInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-1.5 text-slate-600 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition-all text-xs font-bold"
                    title="Nhập câu hỏi từ file Word (.docx)"
                >
                    <FileText className="w-4 h-4" />
                    <span className="hidden md:inline">Word</span>
                    <input 
                        type="file" 
                        ref={wordInputRef} 
                        onChange={handleWordUpload} 
                        accept=".docx" 
                        className="hidden" 
                    />
                </button>
                <div className="w-px bg-slate-200 my-1"></div>
                <button
                    onClick={() => jsonInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-1.5 text-slate-600 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition-all text-xs font-bold"
                    title="Nhập câu hỏi từ file JSON"
                >
                    <FileJson className="w-4 h-4" />
                    <span className="hidden md:inline">JSON</span>
                    <input 
                        type="file" 
                        ref={jsonInputRef} 
                        onChange={handleJsonUpload} 
                        accept=".json,.txt" 
                        className="hidden" 
                    />
                </button>
             </div>

            <button
              onClick={handleSaveExam}
              disabled={isLoading}
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 disabled:opacity-50 transition-all hover:scale-105 text-sm"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Lưu Đề</span>
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Exam Info Card */}
          <div className="bg-white p-6 rounded-[2rem] shadow-lg shadow-indigo-100/50 border border-slate-100">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                    <label className="block text-sm font-bold text-slate-500 mb-2 ml-1">Tên bài thi</label>
                    <input
                      type="text"
                      value={currentExam.title}
                      onChange={(e) => setCurrentExam({ ...currentExam, title: e.target.value })}
                      className="w-full p-4 text-lg font-bold bg-slate-50 border-2 border-slate-100 rounded-2xl focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all placeholder-slate-300"
                      placeholder="VD: Kiểm tra 15 phút..."
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-bold text-slate-500 mb-2 ml-1">Mã tham gia (Tự động)</label>
                    <div className="w-full p-4 text-lg font-mono font-bold bg-slate-100 text-slate-500 border-2 border-slate-100 rounded-2xl select-all">
                        {currentExam.code}
                    </div>
                 </div>
             </div>
             
             <div className="mt-6">
                 <label className="block text-sm font-bold text-slate-500 mb-2 ml-1">Mô tả / Lời nhắn</label>
                 <textarea
                    value={currentExam.description}
                    onChange={(e) => setCurrentExam({ ...currentExam, description: e.target.value })}
                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-medium h-24 resize-none"
                    placeholder="Nhập lời dặn dò cho học sinh..."
                 />
             </div>
          </div>

          <div className="border-t border-slate-200 my-8"></div>
          
          {isLoading ? (
             <div className="py-20 flex justify-center"><LoadingSpinner /></div>
          ) : (
             <QuestionBuilder
                questions={currentExam.questions}
                onChange={(questions) => setCurrentExam({ ...currentExam, questions })}
            />
          )}
        </div>
      </div>
    );
  }

  // LIST VIEW
  return (
    <div className="max-w-6xl mx-auto p-6 min-h-screen">
      
      {/* MUSIC SETTINGS MODAL */}
      {musicModalExamId && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl animate-slide-up border border-white/20 relative">
                  <button onClick={closeMusicModal} className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                      <X className="w-6 h-6" />
                  </button>
                  
                  <h3 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2">
                      <Music className="w-6 h-6 text-indigo-500" /> Cài Đặt Nhạc Nền
                  </h3>
                  <p className="text-sm text-slate-500 mb-6">Tải nhạc nền MP3 để phát tự động khi học sinh làm bài.</p>

                  <div className="space-y-4">
                      {/* Audio Player */}
                      {musicPreviewUrl ? (
                          <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                              <p className="text-xs font-bold text-indigo-400 uppercase mb-2">Đang phát:</p>
                              <audio src={musicPreviewUrl} controls className="w-full h-10 mb-3" />
                              <button 
                                  onClick={removeMusic} 
                                  className="w-full py-2 bg-white text-rose-500 border border-rose-200 rounded-xl text-sm font-bold hover:bg-rose-50 transition-colors flex items-center justify-center gap-2"
                              >
                                  <VolumeX className="w-4 h-4" /> Tắt / Xoá Nhạc
                              </button>
                          </div>
                      ) : (
                          <div className="bg-slate-50 p-6 rounded-2xl border-2 border-dashed border-slate-200 text-center">
                              <VolumeX className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                              <p className="text-slate-400 text-sm font-medium">Chưa có nhạc nền</p>
                          </div>
                      )}

                      {/* Upload Button */}
                      <button 
                          onClick={() => musicInputRef.current?.click()} 
                          className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                      >
                          <Upload className="w-5 h-5" /> Tải Nhạc Lên (MP3)
                      </button>
                      <input 
                          type="file" 
                          accept="audio/mp3,audio/mpeg" 
                          ref={musicInputRef} 
                          onChange={handleMusicFileSelect} 
                          className="hidden" 
                      />
                  </div>

                  <div className="mt-8 flex gap-3">
                      <button onClick={closeMusicModal} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors">Hủy</button>
                      <button onClick={saveMusicChanges} className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2">
                          <Save className="w-5 h-5" /> Lưu Cài Đặt
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* STOP CONFIRMATION MODAL - High Z-Index to override everything */}
      {showStopConfirm && (
          <div className="fixed inset-0 z-[10001] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white p-6 rounded-3xl max-w-sm w-full shadow-2xl animate-scale-up border-2 border-rose-100">
                  <div className="flex items-center gap-3 mb-4 text-rose-600">
                      <LogOut className="w-8 h-8" />
                      <h3 className="text-xl font-black">Kết thúc bài thi?</h3>
                  </div>
                  <p className="text-slate-600 mb-6 font-medium">
                      Hành động này sẽ:
                      <ul className="list-disc ml-5 mt-2 text-sm text-slate-500 space-y-1">
                          <li>Tự động thu bài của tất cả học sinh.</li>
                          <li>Tắt nhạc nền (nếu có).</li>
                          <li>Đóng phòng thi trực tuyến.</li>
                      </ul>
                  </p>
                  <div className="flex gap-3">
                      <button onClick={() => setShowStopConfirm(false)} className="flex-1 py-3 bg-slate-100 font-bold rounded-xl text-slate-600 hover:bg-slate-200 transition-colors">Huỷ Bỏ</button>
                      <button onClick={confirmStopHosting} className="flex-1 py-3 bg-rose-500 font-bold rounded-xl text-white hover:bg-rose-600 shadow-lg shadow-rose-200 transition-colors">Xác Nhận</button>
                  </div>
              </div>
          </div>
      )}
      
      {/* ROOM SETUP MODAL - For creating a room with custom ID */}
      {isSettingUpHosting && hostingExam && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white p-8 rounded-[2rem] w-full max-w-md shadow-2xl animate-scale-up border border-white/20">
                <h3 className="text-2xl font-black text-slate-800 mb-2 flex items-center gap-2">
                    <MonitorPlay className="w-8 h-8 text-indigo-600" />
                    Thiết lập Phòng Thi
                </h3>
                <p className="text-slate-500 mb-6 font-medium">Bạn đang tổ chức thi cho đề: <span className="text-indigo-600 font-bold">{hostingExam.title}</span></p>
                
                <div className="mb-6">
                    <label className="block text-sm font-bold text-slate-400 uppercase mb-2">Đặt tên Mã Phòng (Tùy chọn)</label>
                    <div className="relative">
                        <input 
                            type="text" 
                            value={roomId}
                            onChange={(e) => setRoomId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                            placeholder="VD: LOP5A"
                            maxLength={10}
                            className="w-full p-4 pl-12 bg-slate-50 border-2 border-indigo-100 rounded-2xl text-2xl font-black text-indigo-600 tracking-widest uppercase focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all placeholder-slate-300"
                        />
                        <Wifi className="w-6 h-6 text-indigo-300 absolute left-4 top-1/2 -translate-y-1/2" />
                    </div>
                    <p className="text-xs text-slate-400 mt-2 ml-1">Học sinh sẽ nhập mã này để vào phòng.</p>
                </div>

                <div className="flex flex-col gap-3">
                    <button 
                        onClick={launchHosting} 
                        disabled={!roomId.trim() || isLoading}
                        className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-200 hover:shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                       {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Zap className="w-6 h-6 text-yellow-300 fill-current" />}
                       {isLoading ? 'Đang tạo phòng...' : 'Tạo Phòng (Vào Lobby)'}
                    </button>
                    <button 
                        onClick={() => {
                            setIsSettingUpHosting(false);
                            setHostingExam(null);
                        }}
                        className="w-full py-3 text-slate-400 font-bold hover:text-slate-600 transition-colors"
                    >
                        Huỷ bỏ
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* HOSTING MODAL / LIVE LEADERBOARD */}
      {isHosting && hostingExam && (
        <div className="fixed inset-0 bg-slate-900 z-[9999] flex flex-col animate-fade-in">
            {/* HEADER BAR - High Z-Index */}
            <div className="bg-slate-800/90 backdrop-blur-xl p-4 border-b border-white/10 flex justify-between items-center shadow-2xl z-[10000] sticky top-0">
                <div className="flex items-center gap-4">
                    <div className="bg-indigo-600 p-2 rounded-lg shadow-lg shadow-indigo-500/30">
                        <Wifi className="w-6 h-6 text-white animate-pulse" />
                    </div>
                    <div>
                        <h2 className="text-white font-bold text-lg leading-tight">{hostingExam.title}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-indigo-300 text-xs font-mono">ID:</span>
                            <span className="text-yellow-400 font-mono text-xl font-black tracking-wider">{roomId}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* START BUTTON (Visible only when not started) */}
                    {!hasStartedGame && (
                        <button 
                            onClick={startGame}
                            className="bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-2 rounded-xl font-black text-sm shadow-lg shadow-emerald-500/20 animate-pulse hover:scale-105 transition-all flex items-center gap-2 border border-emerald-400/50"
                        >
                            <Play className="w-5 h-5 fill-current" /> BẮT ĐẦU LÀM BÀI
                        </button>
                    )}

                    {/* Music Button: Always show, dim if no music */}
                    <button 
                        onClick={() => {
                            if(!hostingExam.musicUri) return alert("Bài thi này chưa cài đặt nhạc nền. Hãy vào 'Cài đặt' để thêm nhạc.");
                            setIsHostingMusicMuted(!isHostingMusicMuted);
                        }}
                        className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all border border-transparent ${
                            !hostingExam.musicUri 
                            ? 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-60' 
                            : isHostingMusicMuted 
                                ? 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white border-slate-600' 
                                : 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-400 hover:shadow-indigo-500/40'
                        }`}
                        title={!hostingExam.musicUri ? "Chưa có nhạc" : "Bật/Tắt Nhạc"}
                    >
                        {isHostingMusicMuted || !hostingExam.musicUri ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                        <span className="hidden md:inline text-xs uppercase tracking-wider">{!hostingExam.musicUri ? 'No Music' : isHostingMusicMuted ? 'Đã Tắt' : 'Đang Phát'}</span>
                    </button>

                    {/* End Exam Button - Triggers Custom Modal */}
                    <button 
                        onClick={handleStopClick}
                        className="bg-rose-600 hover:bg-rose-500 text-white px-5 py-2 rounded-xl font-bold shadow-lg shadow-rose-900/30 flex items-center gap-2 transition-all active:scale-95 border border-rose-500/50 hover:border-rose-400 group"
                    >
                        <Power className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        <span className="hidden md:inline text-sm">KẾT THÚC</span>
                    </button>
                    
                    {/* Simple Close X Button - Triggers Custom Modal */}
                    <button 
                        onClick={handleStopClick}
                        className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-700/50 text-slate-400 hover:bg-slate-600 hover:text-white transition-colors border border-white/5"
                        title="Đóng cửa sổ"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* CONTENT AREA */}
            <div className="flex-1 overflow-hidden relative p-4 md:p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex flex-col z-10">
              <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden max-w-7xl mx-auto w-full">
                  
                  {/* Left: Team Race Chart */}
                  <div className="flex-1 bg-white/5 rounded-3xl border border-white/10 p-6 flex flex-col relative overflow-hidden backdrop-blur-sm shadow-2xl">
                       <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2 z-10">
                           <Trophy className="w-6 h-6 text-yellow-400" /> Đường Đua Điểm Số
                       </h3>
                       
                       {/* Chart Area */}
                       <div className="flex-1 flex flex-col justify-center gap-4 z-10 overflow-y-auto custom-scrollbar pr-2">
                           {liveTeamStats.map(([teamName, score], idx) => {
                               const teamInfo = COLOR_OPTIONS.find(c => c.label === teamName.replace('Đội ', '')) || { bar: 'bg-gray-500', icon: '🛡️', label: teamName };
                               const percentage = Math.min((score / maxTeamScore) * 100, 100);
                               
                               return (
                                   <div key={teamName} className="relative group">
                                       <div className="flex justify-between text-white text-sm font-bold mb-1 pl-1">
                                           <span className="flex items-center gap-2">{idx === 0 && <Crown className="w-4 h-4 text-yellow-400" />} {teamInfo.icon} {teamName}</span>
                                           <span>{score} điểm</span>
                                       </div>
                                       <div className="h-8 bg-white/5 rounded-full overflow-hidden backdrop-blur-sm border border-white/5 relative shadow-inner">
                                           <div 
                                                className={`h-full ${teamInfo.bar} transition-all duration-1000 ease-out relative shadow-lg group-hover:brightness-110`} 
                                                style={{ width: `${Math.max(percentage, 2)}%` }}
                                           >
                                                <div className="absolute top-0 right-0 bottom-0 w-10 bg-gradient-to-l from-white/30 to-transparent"></div>
                                           </div>
                                       </div>
                                   </div>
                               )
                           })}
                           {liveTeamStats.length === 0 && (
                               <div className="text-center text-white/30 py-10 italic flex flex-col items-center">
                                   <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-2">
                                       <Trophy className="w-8 h-8 opacity-20" />
                                   </div>
                                   Chưa có điểm số nào...
                               </div>
                           )}
                       </div>

                       {/* Background decoration */}
                       <div className="absolute bottom-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -z-0 pointer-events-none"></div>
                  </div>

                  {/* Right: Feed & Stats */}
                  <div className="w-full md:w-96 flex flex-col gap-4">
                      {/* Connected Count & QR */}
                      <div className="bg-white/5 border border-white/10 p-4 rounded-3xl flex items-center gap-4 backdrop-blur-sm">
                          <div className="bg-white p-2 rounded-xl shadow-lg shrink-0">
                              {qrCodeUrl && <img src={qrCodeUrl} alt="QR Code" className="w-20 h-20" />}
                          </div>
                          <div className="flex-1">
                               <div className="text-white/60 text-xs font-bold uppercase mb-1">Đã kết nối</div>
                               <div className="text-3xl font-black text-white flex items-center gap-2">
                                   <Users className="w-6 h-6 text-indigo-400" />
                                   {Object.keys(connectedStudents).length}
                               </div>
                               <div className="text-white/40 text-[10px] mt-1">Quét mã để tham gia</div>
                          </div>
                      </div>

                      {/* Live Feed */}
                      <div className="flex-1 bg-white/5 rounded-3xl border border-white/10 p-5 flex flex-col overflow-hidden backdrop-blur-sm min-h-[300px]">
                           <h4 className="text-sm font-bold text-white/50 uppercase mb-3 flex items-center gap-2">
                               <Zap className="w-4 h-4 text-yellow-400" /> Hoạt động mới nhất
                           </h4>
                           <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                               {latestActivity ? (
                                   <div className="p-3 bg-emerald-500/20 border-l-4 border-emerald-500 rounded-r-xl text-emerald-100 text-sm font-medium animate-slide-up shadow-lg">
                                       {latestActivity}
                                   </div>
                               ) : (
                                   <div className="text-white/30 text-xs italic text-center mt-10">Đang chờ học sinh làm bài...</div>
                               )}
                               
                               {/* Render real-time contributors */}
                               {Object.entries(connectedStudents).length > 0 && !latestActivity && (
                                   <div className="space-y-2">
                                       {Object.values(connectedStudents).map((s: { name: string, team: string }, idx) => (
                                           <div key={idx} className="p-2 bg-white/5 rounded-lg flex justify-between items-center text-xs text-white/70 animate-fade-in">
                                               <span>{s.name}</span>
                                               <span className="opacity-50">{s.team}</span>
                                           </div>
                                       ))}
                                   </div>
                               )}

                               {/* Render real-time contributors with score */}
                               {Object.entries(liveStudentScores).slice(-5).reverse().map(([name, rawData]) => {
                                   const data = rawData as { score: number, team: string };
                                   return data.score > 0 && (
                                       <div key={name} className="p-3 bg-white/5 rounded-xl text-white/80 text-xs flex justify-between items-center animate-fade-in border border-white/5 hover:bg-white/10 transition-colors">
                                           <div className="font-bold">{name} <span className="text-white/40 font-normal">({data.team})</span></div>
                                           <span className="font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded text-[10px]">{data.score}đ</span>
                                       </div>
                                   );
                               })}
                           </div>
                      </div>
                  </div>
              </div>
            </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                <LayoutDashboard className="w-8 h-8 text-indigo-600" /> Bảng Giáo Viên
            </h1>
            <p className="text-slate-500 font-medium">Quản lý đề thi và theo dõi kết quả</p>
        </div>
        
        <div className="flex gap-3">
            <button
                onClick={() => setView('TEAMS')}
                className="px-5 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-2xl hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm flex items-center gap-2"
            >
                <Users className="w-5 h-5" /> Đội Thi
            </button>
            <button
                onClick={handleCreateExam}
                className="px-5 py-3 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:scale-105 transition-all flex items-center gap-2"
            >
                <Plus className="w-5 h-5" /> Tạo Đề Mới
            </button>
            <button onClick={onBack} className="px-5 py-3 bg-rose-50 text-rose-600 font-bold rounded-2xl hover:bg-rose-100 transition-all">
                Thoát
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {exams.map((exam) => (
          <div key={exam.id} className="bg-white p-6 rounded-[2rem] shadow-xl shadow-slate-100 border border-slate-100 relative group hover:border-indigo-100 transition-all hover:-translate-y-1">

            <div className="mb-4 pr-4">
                 <h3 className="font-bold text-lg text-slate-800 line-clamp-1 mb-1" title={exam.title}>{exam.title}</h3>
                 <p className="text-xs text-slate-400 font-medium">{exam.questions.length} câu hỏi • Tạo {new Date(exam.createdAt).toLocaleDateString('vi-VN')}</p>
            </div>
            
            <div className="flex flex-col gap-3 mt-4">
                <button
                    onClick={() => initiateHosting(exam)}
                    className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-200 hover:shadow-xl hover:scale-[1.02]"
                >
                    <Wifi className="w-5 h-5" /> TỔ CHỨC THI (LIVE)
                </button>

                 <div className="flex gap-2">
                     <button
                        onClick={() => openMusicModal(exam)}
                        className={`flex-1 p-2.5 rounded-xl transition-colors font-bold text-xs flex items-center justify-center gap-1 ${exam.musicUri ? 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                        title="Cài đặt nhạc nền"
                     >
                        <Music className="w-4 h-4" /> {exam.musicUri ? 'Có nhạc' : 'Nhạc'}
                    </button>
                     <button
                        onClick={() => {
                            setCurrentExam(exam);
                            setView('REPORT');
                        }}
                        className="flex-1 p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors font-bold text-xs flex items-center justify-center gap-1"
                        title="Xem báo cáo"
                     >
                        <BarChart2 className="w-4 h-4" /> Báo Cáo
                    </button>
                    <button
                        onClick={() => handleEditExam(exam)}
                        className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors"
                        title="Chỉnh sửa"
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                     <button
                        onClick={() => handleDeleteExam(exam.id)}
                        className="p-2.5 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100 transition-colors"
                        title="Xoá"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                 </div>
            </div>
            
            <div className="mt-4 pt-3 border-t border-slate-50 flex justify-end">
                <button 
                    onClick={() => {
                        const data = exportExamData(exam);
                        navigator.clipboard.writeText(data);
                        alert("Đã copy dữ liệu đề thi vào clipboard. Bạn có thể gửi cho giáo viên khác import.");
                    }}
                    className="text-[10px] font-bold text-slate-300 hover:text-indigo-400 flex items-center gap-1 uppercase tracking-wide"
                >
                    <Share2 className="w-3 h-3" /> Backup Đề
                </button>
            </div>

          </div>
        ))}
        
        {/* Empty State */}
        {exams.length === 0 && (
            <div className="col-span-full py-20 text-center bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                    <BookOpen className="w-10 h-10 text-slate-300" />
                </div>
                <h3 className="text-xl font-bold text-slate-700 mb-2">Chưa có đề thi nào</h3>
                <p className="text-slate-400 mb-6">Tạo đề thi mới để bắt đầu ngay nhé!</p>
                <button onClick={handleCreateExam} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700">
                    + Tạo Đề Thi Đầu Tiên
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default TeacherDashboard;